"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  Compass,
  ExternalLink,
  GitFork,
  Loader2,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { OntologyRelation } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import { AdoptClassReconciliationDialog } from "@/features/ontology/components/dialogs/adopt-class-reconciliation-dialog/adopt-class-reconciliation-dialog"
import {
  findNearestStandardTerms,
  mapClassToStandardParent,
  type TermAlignmentCandidate,
} from "@/features/ontology/server/actions/reference-vocabularies"
import { updateClass } from "@/features/ontology/server/actions/classes"
import { updateRelation } from "@/features/ontology/server/actions/relations"
import { resolveExternalUri } from "@/features/ontology/utils/external-uri"

interface SemanticAlignmentsCardProps {
  ontologyId: string
  entityId: string
  entityName: string
  entityType: "class" | "relation"
  cls?: OntologyClassWithAttributes
  allClasses?: OntologyClassWithAttributes[]
  relations?: OntologyRelation[]
}

export function SemanticAlignmentsCard({
  ontologyId,
  entityId,
  entityName,
  entityType,
  cls,
  allClasses,
  relations,
}: SemanticAlignmentsCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [reconcileCandidate, setReconcileCandidate] =
    useState<TermAlignmentCandidate | null>(null)
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false)

  const { data: candidates = [], isLoading } = useQuery<
    TermAlignmentCandidate[]
  >({
    queryKey: ["semantic-alignments", entityType, entityId, entityName],
    queryFn: () =>
      findNearestStandardTerms(
        entityName,
        entityType === "class" ? "class" : "property",
        3
      ),
    enabled: Boolean(entityName.trim()),
    staleTime: 60000,
  })

  async function handleMapSubClass(candidate: TermAlignmentCandidate) {
    setActiveActionId(`subclass-${candidate.curie}`)
    try {
      await mapClassToStandardParent(ontologyId, entityId, {
        curie: candidate.curie,
        label: candidate.label,
        description: candidate.description,
      })
      toast.success(`Mapped "${entityName}" as subClassOf ${candidate.curie}`)
      await queryClient.invalidateQueries()
      router.refresh()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to map parent class."
      toast.error(msg)
    } finally {
      setActiveActionId(null)
    }
  }

  async function handleAdoptTerm(candidate: TermAlignmentCandidate) {
    if (entityType === "class" && cls) {
      setReconcileCandidate(candidate)
      setIsReconcileDialogOpen(true)
      return
    }

    setActiveActionId(`adopt-${candidate.curie}`)
    try {
      const newName = candidate.curie || candidate.label
      if (entityType === "class") {
        await updateClass(entityId, {
          name: newName,
          ...(candidate.description
            ? { description: candidate.description }
            : {}),
        })
      } else {
        await updateRelation(entityId, {
          name: newName,
          ...(candidate.description
            ? { description: candidate.description }
            : {}),
        })
      }
      toast.success(`Adopted standard term "${candidate.curie}"`)
      await queryClient.invalidateQueries()
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to adopt term."
      toast.error(msg)
    } finally {
      setActiveActionId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/20 p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Searching reference vocabularies...</span>
        </div>
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium">
          <Compass className="h-3.5 w-3.5 opacity-60" />
          <span>Standard Vocabulary Alignments</span>
        </div>
        <p className="mt-1 text-[11px] opacity-75">
          No matching standard terms found in workspace library. Use the
          Reference Vocabularies button in the header to index ontologies like
          SOSA, ENVO, or Schema.org.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Standard Vocabulary Alignments
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-primary/30 bg-background text-[10px] text-primary"
        >
          Local Vector Match
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Nearest standard candidates discovered via local embeddings. Align this{" "}
        {entityType} to reuse established domain standards:
      </p>

      <div className="space-y-2">
        {candidates.map((cand) => {
          const isSubclassPending = activeActionId === `subclass-${cand.curie}`
          const isAdoptPending = activeActionId === `adopt-${cand.curie}`
          const scorePercent = Math.round(cand.similarity * 100)

          const externalUri = resolveExternalUri(cand.curie, cand.iri)

          return (
            <div
              key={cand.curie}
              className="space-y-2 rounded-md border bg-background/80 p-2.5 text-xs shadow-xs transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {externalUri ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help font-mono font-semibold text-foreground underline decoration-muted-foreground/40 decoration-dotted underline-offset-2">
                            {cand.curie}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs font-mono text-[11px] break-all"
                        >
                          {externalUri}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="font-mono font-semibold text-foreground">
                        {cand.curie}
                      </span>
                    )}
                    <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                      {scorePercent}% match
                    </Badge>
                  </div>
                  {cand.label &&
                    cand.label !== cand.curie &&
                    (externalUri ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help text-[11px] text-muted-foreground underline decoration-muted-foreground/40 decoration-dotted underline-offset-2">
                            {cand.label}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs font-mono text-[11px] break-all"
                        >
                          {externalUri}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        {cand.label}
                      </div>
                    ))}
                </div>

                {externalUri && (
                  <a
                    href={externalUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title={externalUri}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {cand.description && (
                <p className="line-clamp-2 text-[11px] text-muted-foreground/90">
                  {cand.description}
                </p>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                {entityType === "class" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(activeActionId)}
                    onClick={() => handleMapSubClass(cand)}
                    className="h-6 gap-1 px-2 text-[10px]"
                  >
                    {isSubclassPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <GitFork className="h-3 w-3 text-amber-500" />
                    )}
                    Map via subClassOf
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(activeActionId)}
                  onClick={() => handleAdoptTerm(cand)}
                  className="h-6 gap-1 px-2 text-[10px]"
                >
                  {isAdoptPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3 text-emerald-500" />
                  )}
                  Adopt Standard Term
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {cls && (
        <AdoptClassReconciliationDialog
          open={isReconcileDialogOpen}
          onOpenChange={setIsReconcileDialogOpen}
          ontologyId={ontologyId}
          cls={cls}
          allClasses={allClasses ?? []}
          relations={relations ?? []}
          standardTerm={reconcileCandidate}
        />
      )}
    </div>
  )
}
