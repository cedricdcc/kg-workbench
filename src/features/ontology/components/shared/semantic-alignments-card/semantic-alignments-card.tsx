"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Compass, ExternalLink, GitFork, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  findNearestStandardTerms,
  mapClassToStandardParent,
  type TermAlignmentCandidate,
} from "@/features/ontology/server/actions/reference-vocabularies"
import { updateClass } from "@/features/ontology/server/actions/classes"
import { updateRelation } from "@/features/ontology/server/actions/relations"

interface SemanticAlignmentsCardProps {
  ontologyId: string
  entityId: string
  entityName: string
  entityType: "class" | "relation"
}

export function SemanticAlignmentsCard({
  ontologyId,
  entityId,
  entityName,
  entityType,
}: SemanticAlignmentsCardProps) {
  const queryClient = useQueryClient()
  const [activeActionId, setActiveActionId] = useState<string | null>(null)

  const { data: candidates = [], isLoading } = useQuery<TermAlignmentCandidate[]>({
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
      toast.success(
        `Mapped "${entityName}" as subClassOf ${candidate.curie}`
      )
      await queryClient.invalidateQueries()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to map parent class."
      toast.error(msg)
    } finally {
      setActiveActionId(null)
    }
  }

  async function handleAdoptTerm(candidate: TermAlignmentCandidate) {
    setActiveActionId(`adopt-${candidate.curie}`)
    try {
      const newName = candidate.label || candidate.curie
      if (entityType === "class") {
        await updateClass(entityId, {
          name: newName,
          ...(candidate.description ? { description: candidate.description } : {}),
        })
      } else {
        await updateRelation(entityId, {
          name: newName,
          ...(candidate.description ? { description: candidate.description } : {}),
        })
      }
      toast.success(`Adopted standard term "${candidate.curie}"`)
      await queryClient.invalidateQueries()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to adopt term."
      toast.error(msg)
    } finally {
      setActiveActionId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
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
          No matching standard terms found in workspace library. Use the Reference Vocabularies button in the header to index ontologies like SOSA, ENVO, or Schema.org.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Standard Vocabulary Alignments
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] bg-background border-primary/30 text-primary">
          Local Vector Match
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Nearest standard candidates discovered via local embeddings. Align this {entityType} to reuse established domain standards:
      </p>

      <div className="space-y-2">
        {candidates.map((cand) => {
          const isSubclassPending = activeActionId === `subclass-${cand.curie}`
          const isAdoptPending = activeActionId === `adopt-${cand.curie}`
          const scorePercent = Math.round(cand.similarity * 100)

          return (
            <div
              key={cand.curie}
              className="rounded-md border bg-background/80 p-2.5 space-y-2 text-xs transition-colors hover:border-primary/40 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground font-mono">
                      {cand.curie}
                    </span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {scorePercent}% match
                    </Badge>
                  </div>
                  {cand.label && cand.label !== cand.curie && (
                    <div className="text-[11px] text-muted-foreground">
                      {cand.label}
                    </div>
                  )}
                </div>

                {cand.iri && (
                  <a
                    href={cand.iri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title={cand.iri}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {cand.description && (
                <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
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
    </div>
  )
}
