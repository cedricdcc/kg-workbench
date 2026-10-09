"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RelationReconciliationDecision } from "@/features/ontology/schemas/reconciliation"
import {
  reconcileAndAdoptClass,
  suggestRelationRemappingsAction,
} from "@/features/ontology/server/actions/classes"
import { getAvailableGeminiModels } from "@/features/ontology/server/actions/generate-ontology"
import type { TermAlignmentCandidate } from "@/features/ontology/server/actions/reference-vocabularies"
import type {
  AiRelationProvenance,
  AiRelationSuggestion,
} from "@/features/ontology/server/services/ai-relation-reconciliation"
import { RelationReconciliationRow } from "./relation-reconciliation-row"
import type { AdoptClassReconciliationDialogProps, ConnectedRelationItem } from "./types"

interface DialogBodyProps extends Omit<AdoptClassReconciliationDialogProps, "standardTerm"> {
  standardTerm: TermAlignmentCandidate
}

function AdoptClassReconciliationDialogBody({
  onOpenChange,
  ontologyId,
  cls,
  allClasses,
  relations,
  standardTerm,
  onSuccess,
}: DialogBodyProps) {
  const queryClient = useQueryClient()

  // Available Gemini models for fallback & model selector
  const { data: availableModels = [] } = useQuery({
    queryKey: ["gemini-models-list"],
    queryFn: () => getAvailableGeminiModels(),
    staleTime: 5 * 60 * 1000,
  })

  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash")

  // Map connected relations
  const connectedRelations = useMemo<ConnectedRelationItem[]>(() => {
    if (!cls) return []
    const classMap = new Map(allClasses.map((c) => [c.id, c.name]))
    return relations
      .filter((r) => r.domain_class_id === cls.id || r.range_class_id === cls.id)
      .map((r) => {
        const isOutgoing = r.domain_class_id === cls.id
        return {
          relation: r,
          direction: isOutgoing ? "outgoing" : "incoming",
          otherClassName:
            classMap.get(isOutgoing ? r.range_class_id : r.domain_class_id) ||
            "Unknown Class",
        }
      })
  }, [cls, relations, allClasses])

  const [selectedAttributeIds, setSelectedAttributeIds] = useState<Set<string>>(
    () => new Set(cls.attributes.map((a) => a.id))
  )

  const [decisions, setDecisions] = useState<
    Record<string, RelationReconciliationDecision>
  >(() => {
    const init: Record<string, RelationReconciliationDecision> = {}
    for (const item of connectedRelations) {
      init[item.relation.id] = {
        relationId: item.relation.id,
        action: "keep",
      }
    }
    return init
  })

  const [aiSuggestions, setAiSuggestions] = useState<
    Record<string, AiRelationSuggestion>
  >({})
  const [provenance, setProvenance] = useState<AiRelationProvenance | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search filters per column
  const [incomingSearch, setIncomingSearch] = useState("")
  const [outgoingSearch, setOutgoingSearch] = useState("")
  const [attributeSearch, setAttributeSearch] = useState("")
  const [incomingFilter, setIncomingFilter] = useState<
    "all" | "keep" | "remap" | "delete"
  >("all")
  const [outgoingFilter, setOutgoingFilter] = useState<
    "all" | "keep" | "remap" | "delete"
  >("all")

  const outgoingRelations = useMemo(
    () =>
      connectedRelations
        .filter((r) => r.direction === "outgoing")
        .filter((r) => {
          const dec = decisions[r.relation.id]?.action || "keep"
          if (outgoingFilter !== "all" && dec !== outgoingFilter) return false
          if (!outgoingSearch.trim()) return true
          const q = outgoingSearch.toLowerCase()
          return (
            r.relation.name.toLowerCase().includes(q) ||
            r.otherClassName.toLowerCase().includes(q)
          )
        }),
    [connectedRelations, outgoingSearch, outgoingFilter, decisions]
  )

  const incomingRelations = useMemo(
    () =>
      connectedRelations
        .filter((r) => r.direction === "incoming")
        .filter((r) => {
          const dec = decisions[r.relation.id]?.action || "keep"
          if (incomingFilter !== "all" && dec !== incomingFilter) return false
          if (!incomingSearch.trim()) return true
          const q = incomingSearch.toLowerCase()
          return (
            r.relation.name.toLowerCase().includes(q) ||
            r.otherClassName.toLowerCase().includes(q)
          )
        }),
    [connectedRelations, incomingSearch, incomingFilter, decisions]
  )

  const filteredAttributes = useMemo(() => {
    if (!attributeSearch.trim()) return cls.attributes
    const q = attributeSearch.toLowerCase()
    return cls.attributes.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.data_type.toLowerCase().includes(q)
    )
  }, [cls.attributes, attributeSearch])

  // Real-time impact counts
  const impactCounts = useMemo(() => {
    let kept = 0
    let remapped = 0
    let deleted = 0
    for (const d of Object.values(decisions)) {
      if (d.action === "keep") kept++
      else if (d.action === "remap") remapped++
      else if (d.action === "delete") deleted++
    }
    return { kept, remapped, deleted }
  }, [decisions])

  function toggleAttribute(attrId: string) {
    setSelectedAttributeIds((prev) => {
      const next = new Set(prev)
      if (next.has(attrId)) {
        next.delete(attrId)
      } else {
        next.add(attrId)
      }
      return next
    })
  }

  function handleSelectAllAttributes() {
    setSelectedAttributeIds(new Set(cls.attributes.map((a) => a.id)))
  }

  function handleDeselectAllAttributes() {
    setSelectedAttributeIds(new Set())
  }

  function handleKeepAll() {
    setDecisions((prev) => {
      const next = { ...prev }
      for (const item of connectedRelations) {
        next[item.relation.id] = {
          relationId: item.relation.id,
          action: "keep",
        }
      }
      return next
    })
    toast.info("Reset all relation decisions to Keep.")
  }

  async function handleEnhanceWithAi() {
    if (connectedRelations.length === 0) return
    setIsAiLoading(true)
    try {
      const candidateModelsList =
        availableModels.length > 0
          ? [selectedModel, ...availableModels.map((m) => m.id)]
          : [selectedModel, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"]

      const result = await suggestRelationRemappingsAction({
        ontologyId,
        oldClassName: cls.name,
        standardTermCurie: standardTerm.curie,
        standardTermDescription: standardTerm.description,
        relations: connectedRelations.map((item) => ({
          id: item.relation.id,
          name: item.relation.name,
          domainClassName:
            item.direction === "outgoing" ? cls.name : item.otherClassName,
          rangeClassName:
            item.direction === "outgoing" ? item.otherClassName : cls.name,
          direction: item.direction,
        })),
        model: selectedModel,
        candidateModels: candidateModelsList,
      })

      const map: Record<string, AiRelationSuggestion> = {}
      for (const s of result.suggestions) {
        map[s.relationId] = s
      }
      setAiSuggestions(map)
      setProvenance(result.provenance)

      const failovers = result.provenance.attempts.filter(
        (a) => a.status === "failed"
      )
      if (failovers.length > 0) {
        toast.warning(
          `AI Generated via ${result.provenance.successfulModel} (${failovers.length} previous models failed over).`
        )
      } else {
        toast.success(
          `Generated ${result.suggestions.length} suggestions using ${result.provenance.successfulModel}.`
        )
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate AI suggestions."
      toast.error(msg)
    } finally {
      setIsAiLoading(false)
    }
  }

  function handleApplyAllAiSuggestions() {
    setDecisions((prev) => {
      const next = { ...prev }
      for (const [relId, suggestion] of Object.entries(aiSuggestions)) {
        next[relId] = {
          relationId: relId,
          action: suggestion.suggestedAction,
          remappedName: suggestion.suggestedName || next[relId]?.remappedName,
        }
      }
      return next
    })
    toast.success("Applied all AI suggestions.")
  }

  async function handleConfirm() {
    setIsSubmitting(true)
    try {
      const res = await reconcileAndAdoptClass({
        ontologyId,
        classId: cls.id,
        standardTerm: {
          curie: standardTerm.curie,
          label: standardTerm.label || standardTerm.curie,
          description: standardTerm.description,
          iri: standardTerm.iri,
        },
        retainedAttributeIds: Array.from(selectedAttributeIds),
        relationDecisions: Object.values(decisions),
      })

      toast.success(
        `Adopted "${standardTerm.curie}" (${res.updatedRelations} remapped, ${res.deletedRelations} deleted).`
      )
      await queryClient.invalidateQueries()
      onSuccess?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to apply refactoring."
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const failoverAttempts = provenance?.attempts.filter((a) => a.status === "failed") ?? []

  return (
    <DialogContent
      showCloseButton={false}
      className="fixed inset-0 top-0 left-0 z-50 flex h-dvh w-screen max-w-none max-h-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-background p-0 sm:max-w-none sm:w-screen sm:h-dvh shadow-none ring-0 duration-100"
    >
      {/* Top Header Bar */}
      <header className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">
                Adopt Reference Ontology Term
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-mono bg-background">
                {cls.name} ➔ {standardTerm.curie}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Full-screen reconciliation workbench: re-anchor entity identity, review connected edges, and adjust schema constraints.
            </p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-1">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-6 text-xs border-0 p-0 shadow-none focus:ring-0 w-[140px] font-mono">
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                      {m.displayName || m.id}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="gemini-2.5-flash" className="text-xs font-mono">
                      gemini-2.5-flash
                    </SelectItem>
                    <SelectItem value="gemini-2.5-pro" className="text-xs font-mono">
                      gemini-2.5-pro
                    </SelectItem>
                    <SelectItem value="gemini-1.5-flash" className="text-xs font-mono">
                      gemini-1.5-flash
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleEnhanceWithAi}
            disabled={isAiLoading || connectedRelations.length === 0}
          >
            {isAiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span>Enhance with AI</span>
          </Button>

          {Object.keys(aiSuggestions).length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs text-primary"
              onClick={handleApplyAllAiSuggestions}
            >
              Apply AI Suggestions
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground"
            onClick={handleKeepAll}
          >
            Keep All
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground ml-1"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Failover / Provenance Notice Banner */}
      {failoverAttempts.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 px-5 py-2 text-xs flex items-center justify-between text-amber-700 dark:text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Model Failover:</strong> Initial model returned 503/error. Automatically fell back through:{" "}
              {failoverAttempts.map((a) => `${a.model} (${a.statusCode || a.error})`).join(" ➔ ")} ➔{" "}
              <strong>{provenance?.successfulModel}</strong> (Succeeded).
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] border-amber-500/40 font-mono">
            Provenance Logged
          </Badge>
        </div>
      )}

      {/* 3-Column Main Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* ================= COLUMN 1: INCOMING RELATIONS ================= */}
        <section className="flex flex-col h-full overflow-hidden bg-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Incoming Relations
              </h3>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {connectedRelations.filter((r) => r.direction === "incoming").length}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              [Source] ➔ [This Class]
            </span>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={incomingSearch}
                onChange={(e) => setIncomingSearch(e.target.value)}
                placeholder="Filter incoming relations..."
                className="h-8 text-xs pl-8 font-mono"
              />
            </div>
            <div className="flex items-center gap-1 bg-background border rounded-md p-1">
              {(["all", "keep", "remap", "delete"] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={incomingFilter === filter ? "secondary" : "ghost"}
                  className="h-6 text-[10px] px-2 flex-1 capitalize font-mono"
                  onClick={() => setIncomingFilter(filter)}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2.5 pb-2">
              {incomingRelations.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground italic">
                  {connectedRelations.filter((r) => r.direction === "incoming").length === 0
                    ? "No incoming relations point to this class."
                    : "No incoming relations match your filter."}
                </div>
              ) : (
                incomingRelations.map((item) => (
                  <RelationReconciliationRow
                    key={item.relation.id}
                    item={item}
                    currentClassName={cls.name}
                    decision={
                      decisions[item.relation.id] || {
                        relationId: item.relation.id,
                        action: "keep",
                      }
                    }
                    onChangeDecision={(decision) =>
                      setDecisions((prev) => ({
                        ...prev,
                        [item.relation.id]: decision,
                      }))
                    }
                    aiSuggestion={aiSuggestions[item.relation.id]}
                    onApplyAiSuggestion={() => {
                      const sug = aiSuggestions[item.relation.id]
                      if (!sug) return
                      setDecisions((prev) => ({
                        ...prev,
                        [item.relation.id]: {
                          relationId: item.relation.id,
                          action: sug.suggestedAction,
                          remappedName:
                            sug.suggestedName ||
                            prev[item.relation.id]?.remappedName,
                        },
                      }))
                    }}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </section>

        {/* ================= COLUMN 2: CONCEPT DIFF & ATTRIBUTES ================= */}
        <section className="flex flex-col h-full overflow-hidden p-4 space-y-4 bg-background">
          <div className="flex items-center gap-2 shrink-0">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Adopted Class & Schema
            </h3>
          </div>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-5 pb-2">
              {/* Concept Identity Transformation Diff */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Entity Transformation
                </span>

                <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold line-through text-muted-foreground truncate">
                      {cls.name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                    <Badge className="text-xs bg-primary text-primary-foreground font-mono shrink-0">
                      {standardTerm.curie}
                    </Badge>
                    <span className="text-sm font-bold text-foreground truncate">
                      {standardTerm.label || standardTerm.curie}
                    </span>
                  </div>

                  {standardTerm.iri && (
                    <a
                      href={standardTerm.iri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                    >
                      <span className="font-mono text-[11px]">IRI</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {standardTerm.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {standardTerm.description}
                  </p>
                )}
              </div>

              {/* Attributes Retention Section */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Retained Attributes
                    </span>
                    <Badge variant="secondary" className="text-[11px] font-mono">
                      {selectedAttributeIds.size} / {cls.attributes.length}
                    </Badge>
                  </div>

                  {cls.attributes.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAllAttributes}
                        className="text-primary hover:underline text-[11px]"
                      >
                        Select all
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllAttributes}
                        className="text-muted-foreground hover:underline text-[11px]"
                      >
                        Deselect all
                      </button>
                    </div>
                  )}
                </div>

                {cls.attributes.length > 6 && (
                  <div className="relative">
                    <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      value={attributeSearch}
                      onChange={(e) => setAttributeSearch(e.target.value)}
                      placeholder="Search attributes..."
                      className="h-7 text-xs pl-7"
                    />
                  </div>
                )}

                {cls.attributes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic bg-muted/20 rounded p-2.5">
                    No attributes attached to this class.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filteredAttributes.map((attr) => {
                      const isChecked = selectedAttributeIds.has(attr.id)
                      return (
                        <label
                          key={attr.id}
                          className={`flex items-center gap-2.5 rounded-lg border p-2 text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-muted/20 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAttribute(attr.id)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground block truncate">
                              {attr.name}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                            {attr.data_type}
                          </Badge>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </section>

        {/* ================= COLUMN 3: OUTGOING RELATIONS ================= */}
        <section className="flex flex-col h-full overflow-hidden bg-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Outgoing Relations
              </h3>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {connectedRelations.filter((r) => r.direction === "outgoing").length}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              [This Class] ➔ [Target]
            </span>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={outgoingSearch}
                onChange={(e) => setOutgoingSearch(e.target.value)}
                placeholder="Filter outgoing relations..."
                className="h-8 text-xs pl-8 font-mono"
              />
            </div>
            <div className="flex items-center gap-1 bg-background border rounded-md p-1">
              {(["all", "keep", "remap", "delete"] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={outgoingFilter === filter ? "secondary" : "ghost"}
                  className="h-6 text-[10px] px-2 flex-1 capitalize font-mono"
                  onClick={() => setOutgoingFilter(filter)}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2.5 pb-2">
              {outgoingRelations.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground italic">
                  {connectedRelations.filter((r) => r.direction === "outgoing").length === 0
                    ? "No outgoing relations originate from this class."
                    : "No outgoing relations match your filter."}
                </div>
              ) : (
                outgoingRelations.map((item) => (
                  <RelationReconciliationRow
                    key={item.relation.id}
                    item={item}
                    currentClassName={cls.name}
                    decision={
                      decisions[item.relation.id] || {
                        relationId: item.relation.id,
                        action: "keep",
                      }
                    }
                    onChangeDecision={(decision) =>
                      setDecisions((prev) => ({
                        ...prev,
                        [item.relation.id]: decision,
                      }))
                    }
                    aiSuggestion={aiSuggestions[item.relation.id]}
                    onApplyAiSuggestion={() => {
                      const sug = aiSuggestions[item.relation.id]
                      if (!sug) return
                      setDecisions((prev) => ({
                        ...prev,
                        [item.relation.id]: {
                          relationId: item.relation.id,
                          action: sug.suggestedAction,
                          remappedName:
                            sug.suggestedName ||
                            prev[item.relation.id]?.remappedName,
                        },
                      }))
                    }}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </section>
      </div>

      {/* Sticky Bottom Footer */}
      <footer className="px-5 py-3 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Transformation Summary:</span>
          <div className="flex items-center gap-2 font-mono">
            <Badge variant="outline" className="text-[11px] bg-background">
              1 Class Adopted
            </Badge>
            <Badge variant="outline" className="text-[11px] bg-background">
              {selectedAttributeIds.size}/{cls.attributes.length} Attributes Retained
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {impactCounts.remapped} Remapped
            </Badge>
            <Badge
              variant={impactCounts.deleted > 0 ? "destructive" : "secondary"}
              className="text-[11px]"
            >
              {impactCounts.deleted} Deleted
            </Badge>
            <Badge variant="outline" className="text-[11px] bg-background">
              {impactCounts.kept} Kept
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Applying Refactoring...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Apply Refactoring</span>
              </>
            )}
          </Button>
        </div>
      </footer>
    </DialogContent>
  )
}

export function AdoptClassReconciliationDialog(props: AdoptClassReconciliationDialogProps) {
  if (!props.standardTerm) return null

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && (
        <AdoptClassReconciliationDialogBody
          key={`${props.cls.id}-${props.standardTerm.curie}`}
          {...props}
          standardTerm={props.standardTerm}
        />
      )}
    </Dialog>
  )
}
