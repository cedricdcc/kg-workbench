"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Check, ChevronDown, ChevronRight, Layers, Link2, Loader2, Network, Sparkles, Tag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { EntityAlignment, GeneratedOntologyDraft } from "@/features/ontology/schemas/ai-generation"
import { ContextualExpansionSection } from "./contextual-expansion-section"

interface ReviewStepProps {
  draft: GeneratedOntologyDraft
  isApplying: boolean
  onBack: () => void
  onApply: (filteredDraft: GeneratedOntologyDraft) => void
}

function AlignmentBadgeView({ alignment }: { alignment?: EntityAlignment }) {
  const [showRationale, setShowRationale] = useState(false)

  if (!alignment) return null

  const isReuse = alignment.mode === "reuse"
  const isSubClassOf = alignment.mode === "subClassOf"

  return (
    <div className="space-y-1 pt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={isReuse ? "secondary" : "outline"}
          className={`gap-1 font-mono text-[10px] ${
            isReuse
              ? "border-primary/30 bg-primary/10 text-primary"
              : isSubClassOf
                ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          <Sparkles className="h-2.5 w-2.5" />
          {isReuse && `re-uses ${alignment.targetCurie}`}
          {isSubClassOf && `subClassOf ${alignment.targetCurie}`}
          {alignment.mode === "equivalentClass" && `≡ ${alignment.targetCurie}`}
        </Badge>

        {typeof alignment.similarityScore === "number" && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {Math.round(alignment.similarityScore * 100)}% match
          </span>
        )}

        {alignment.rationale && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowRationale(!showRationale)
            }}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
          >
            {showRationale ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Rationale
          </button>
        )}
      </div>

      {showRationale && alignment.rationale && (
        <div className="rounded border-l-2 border-primary/40 bg-muted/40 p-1.5 text-[11px] italic text-muted-foreground">
          {alignment.rationale}
        </div>
      )}
    </div>
  )
}

export function AiGenerateReviewStep({
  draft,
  isApplying,
  onBack,
  onApply,
}: ReviewStepProps) {
  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    () => new Set(draft.modules.map((m) => m.name.toLowerCase()))
  )
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
    () => new Set(draft.classes.map((c) => c.name.toLowerCase()))
  )
  const [selectedRelations, setSelectedRelations] = useState<Set<string>>(
    () =>
      new Set(
        draft.relations.map(
          (r) =>
            `${r.name.toLowerCase()}:${r.domainClassName.toLowerCase()}:${r.rangeClassName.toLowerCase()}`
        )
      )
  )
  const [selectedCQs, setSelectedCQs] = useState<Set<string>>(
    () => new Set(draft.cqMappings.map((m) => m.cqId))
  )
  const [selectedContextualCuries, setSelectedContextualCuries] = useState<Set<string>>(
    () => new Set((draft.suggestedContext || []).map((c) => c.curie.toLowerCase()))
  )

  const [activeTab, setActiveTab] = useState("modules")

  function toggleModule(name: string) {
    const key = name.toLowerCase()
    const next = new Set(selectedModules)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedModules(next)
  }

  function toggleClass(name: string) {
    const key = name.toLowerCase()
    const next = new Set(selectedClasses)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedClasses(next)
  }

  function toggleRelation(key: string) {
    const next = new Set(selectedRelations)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedRelations(next)
  }

  function toggleCQ(cqId: string) {
    const next = new Set(selectedCQs)
    if (next.has(cqId)) next.delete(cqId)
    else next.add(cqId)
    setSelectedCQs(next)
  }

  function toggleContextual(curie: string) {
    const key = curie.toLowerCase()
    const next = new Set(selectedContextualCuries)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedContextualCuries(next)
  }

  function toggleAllContextual() {
    const all = draft.suggestedContext || []
    if (selectedContextualCuries.size === all.length) {
      setSelectedContextualCuries(new Set())
    } else {
      setSelectedContextualCuries(new Set(all.map((c) => c.curie.toLowerCase())))
    }
  }

  const filteredDraft = useMemo<GeneratedOntologyDraft>(() => {
    return {
      modules: draft.modules.filter((m) =>
        selectedModules.has(m.name.toLowerCase())
      ),
      classes: draft.classes.filter((c) =>
        selectedClasses.has(c.name.toLowerCase())
      ),
      relations: draft.relations.filter((r) => {
        const key = `${r.name.toLowerCase()}:${r.domainClassName.toLowerCase()}:${r.rangeClassName.toLowerCase()}`
        return selectedRelations.has(key)
      }),
      cqMappings: draft.cqMappings.filter((m) => selectedCQs.has(m.cqId)),
      suggestedContext: (draft.suggestedContext || []).filter((ctx) =>
        selectedContextualCuries.has(ctx.curie.toLowerCase())
      ),
    }
  }, [
    draft,
    selectedModules,
    selectedClasses,
    selectedRelations,
    selectedCQs,
    selectedContextualCuries,
  ])

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
        <span>Review and adjust the proposed elements before saving.</span>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {filteredDraft.modules.length} Modules
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {filteredDraft.classes.length} Classes
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {filteredDraft.relations.length} Relations
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {filteredDraft.cqMappings.length} CQ Links
          </Badge>
          {filteredDraft.suggestedContext && filteredDraft.suggestedContext.length > 0 && (
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[11px] text-primary">
              +{filteredDraft.suggestedContext.length} Contextual
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="modules" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            Modules ({draft.modules.length})
          </TabsTrigger>
          <TabsTrigger value="classes" className="gap-1.5 text-xs">
            <Tag className="h-3.5 w-3.5" />
            Classes ({draft.classes.length})
          </TabsTrigger>
          <TabsTrigger value="relations" className="gap-1.5 text-xs">
            <Network className="h-3.5 w-3.5" />
            Relations ({draft.relations.length})
          </TabsTrigger>
          <TabsTrigger value="cqs" className="gap-1.5 text-xs">
            <Link2 className="h-3.5 w-3.5" />
            CQ Links ({draft.cqMappings.length})
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules" className="mt-3">
          <ScrollArea className="h-[280px] rounded-md border p-3">
            <div className="space-y-2">
              {draft.modules.map((m) => {
                const isSelected = selectedModules.has(m.name.toLowerCase())
                return (
                  <div
                    key={m.name}
                    onClick={() => toggleModule(m.name)}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors ${
                      isSelected
                        ? "border-primary/40 bg-accent/30"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModule(m.name)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="text-sm font-semibold text-foreground">
                        {m.name}
                      </div>
                      {m.description && (
                        <div className="text-xs text-muted-foreground">
                          {m.description}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="mt-3">
          <ScrollArea className="h-[280px] rounded-md border p-3">
            <div className="space-y-2">
              {draft.classes.map((cls) => {
                const isSelected = selectedClasses.has(cls.name.toLowerCase())
                return (
                  <div
                    key={cls.name}
                    onClick={() => toggleClass(cls.name)}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors ${
                      isSelected
                        ? "border-primary/40 bg-accent/30"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleClass(cls.name)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {cls.name}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {cls.moduleName}
                        </Badge>
                      </div>
                      {cls.description && (
                        <div className="text-xs text-muted-foreground">
                          {cls.description}
                        </div>
                      )}
                      {cls.attributes && cls.attributes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {cls.attributes.map((attr) => (
                            <span
                              key={attr.name}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {attr.name}: {attr.dataType.replace("xsd:", "")}
                            </span>
                          ))}
                        </div>
                      )}
                      <AlignmentBadgeView alignment={cls.alignment} />
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Relations Tab */}
        <TabsContent value="relations" className="mt-3">
          <ScrollArea className="h-[280px] rounded-md border p-3">
            <div className="space-y-2">
              {draft.relations.map((rel) => {
                const key = `${rel.name.toLowerCase()}:${rel.domainClassName.toLowerCase()}:${rel.rangeClassName.toLowerCase()}`
                const isSelected = selectedRelations.has(key)
                return (
                  <div
                    key={key}
                    onClick={() => toggleRelation(key)}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors ${
                      isSelected
                        ? "border-primary/40 bg-accent/30"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRelation(key)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-foreground">
                          {rel.domainClassName}
                        </span>
                        <span className="font-mono text-primary">
                          --[{rel.name}]--&gt;
                        </span>
                        <span className="font-semibold text-foreground">
                          {rel.rangeClassName}
                        </span>
                      </div>
                      {rel.description && (
                        <div className="text-xs text-muted-foreground">
                          {rel.description}
                        </div>
                      )}
                      <AlignmentBadgeView alignment={rel.alignment} />
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* CQ Mappings Tab */}
        <TabsContent value="cqs" className="mt-3">
          <ScrollArea className="h-[280px] rounded-md border p-3">
            <div className="space-y-2">
              {draft.cqMappings.map((mapping, idx) => {
                const isSelected = selectedCQs.has(mapping.cqId)
                return (
                  <div
                    key={mapping.cqId}
                    onClick={() => toggleCQ(mapping.cqId)}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors ${
                      isSelected
                        ? "border-primary/40 bg-accent/30"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCQ(mapping.cqId)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-medium text-foreground">
                        Question #{idx + 1}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Subject:</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {mapping.subjectClassName}
                        </Badge>
                        <span>Predicate:</span>
                        <Badge variant="outline" className="text-[10px]">
                          {mapping.predicateRelationName}
                        </Badge>
                        <span>Object:</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {mapping.objectClassName}
                        </Badge>
                        {mapping.moduleNames.length > 0 && (
                          <>
                            <span className="ml-1">Modules:</span>
                            {mapping.moduleNames.map((m) => (
                              <Badge
                                key={m}
                                variant="outline"
                                className="bg-muted/50 text-[10px]"
                              >
                                {m}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Option B: Contextual Expansion Section */}
      <ContextualExpansionSection
        items={draft.suggestedContext || []}
        selectedCurieSet={selectedContextualCuries}
        onToggle={toggleContextual}
        onToggleAll={toggleAllContextual}
      />

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isApplying}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Settings
        </Button>

        <Button
          type="button"
          disabled={
            isApplying ||
            (filteredDraft.modules.length === 0 &&
              filteredDraft.classes.length === 0)
          }
          onClick={() => onApply(filteredDraft)}
          className="gap-2"
        >
          {isApplying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying to Ontology...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Apply Selected to Ontology
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
