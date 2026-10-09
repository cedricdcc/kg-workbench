"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { RelationReconciliationDecision } from "@/features/ontology/schemas/reconciliation"
import {
  reconcileAndAdoptClass,
  suggestRelationRemappingsAction,
} from "@/features/ontology/server/actions/classes"
import type { TermAlignmentCandidate } from "@/features/ontology/server/actions/reference-vocabularies"
import type { AiRelationSuggestion } from "@/features/ontology/server/services/ai-relation-reconciliation"
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
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const outgoingRelations = useMemo(
    () => connectedRelations.filter((r) => r.direction === "outgoing"),
    [connectedRelations]
  )
  const incomingRelations = useMemo(
    () => connectedRelations.filter((r) => r.direction === "incoming"),
    [connectedRelations]
  )

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

  async function handleEnhanceWithAi() {
    if (connectedRelations.length === 0) return
    setIsAiLoading(true)
    try {
      const suggestions = await suggestRelationRemappingsAction({
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
      })

      const map: Record<string, AiRelationSuggestion> = {}
      for (const s of suggestions) {
        map[s.relationId] = s
      }
      setAiSuggestions(map)
      toast.success(`Generated ${suggestions.length} AI relation suggestions.`)
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

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <DialogTitle>Adopt Reference Ontology Term</DialogTitle>
        </div>
        <DialogDescription>
          Reconcile entity identity, review connected relations, and adjust attribute constraints.
        </DialogDescription>
      </DialogHeader>

      {/* Concept Transformation Diff Card */}
      <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-background">
              Current Class:
            </Badge>
            <span className="font-semibold text-sm line-through text-muted-foreground">
              {cls.name}
            </span>
            <ArrowRight className="h-4 w-4 text-primary" />
            <Badge className="text-xs bg-primary text-primary-foreground font-mono">
              {standardTerm.curie}
            </Badge>
            <span className="text-sm font-semibold text-foreground">
              {standardTerm.label || standardTerm.curie}
            </span>
          </div>

          {standardTerm.iri && (
            <a
              href={standardTerm.iri}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <span>IRI</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {standardTerm.description && (
          <p className="text-xs text-muted-foreground">
            {standardTerm.description}
          </p>
        )}
      </div>

      <ScrollArea className="flex-1 pr-3 -mr-3 max-h-[50vh]">
        <div className="space-y-6 py-2">
          {/* Attribute Retention Section */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Attributes ({selectedAttributeIds.size}/{cls.attributes.length} Retained)
                </h4>
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

            {cls.attributes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/20 rounded p-2.5">
                No attributes are attached to this class.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cls.attributes.map((attr) => {
                  const isChecked = selectedAttributeIds.has(attr.id)
                  return (
                    <label
                      key={attr.id}
                      className={`flex items-center gap-2.5 rounded-md border p-2 text-xs cursor-pointer transition-colors ${
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
          </section>

          <Separator />

          {/* Connected Relations Refactoring Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Connected Relations ({connectedRelations.length})
                </h4>
              </div>

              {connectedRelations.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleEnhanceWithAi}
                    disabled={isAiLoading}
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
                      variant="ghost"
                      className="h-7 text-xs text-primary"
                      onClick={handleApplyAllAiSuggestions}
                    >
                      Apply all suggestions
                    </Button>
                  )}
                </div>
              )}
            </div>

            {connectedRelations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/20 rounded p-2.5">
                This class has no connected relations. Adopting the standard term will update its identity directly.
              </p>
            ) : (
              <div className="space-y-4">
                {outgoingRelations.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Outgoing Relations ({outgoingRelations.length})
                    </h5>
                    {outgoingRelations.map((item) => (
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
                    ))}
                  </div>
                )}

                {incomingRelations.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Incoming Relations ({incomingRelations.length})
                    </h5>
                    {incomingRelations.map((item) => (
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
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      <DialogFooter className="gap-2 sm:gap-0 mt-4 pt-3 border-t">
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
              <Sparkles className="h-4 w-4" />
              <span>Confirm & Apply Refactoring</span>
            </>
          )}
        </Button>
      </DialogFooter>
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
