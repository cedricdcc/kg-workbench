"use client"

import { ArrowRight } from "lucide-react"

import type { OntologyRelation } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import { cn } from "@/lib/utils"

interface ClassDetailRelationsProps {
  classId: string
  relations: OntologyRelation[]
  inheritedRelations?: Array<
    OntologyRelation & {
      inheritedFromClassName: string
      inheritedFromClassId: string
      role: "domain" | "range"
    }
  >
  classMap: Map<string, OntologyClassWithAttributes>
  onNavigateToRelation: (relationId: string) => void
}

export function ClassDetailRelations({
  classId,
  relations,
  inheritedRelations = [],
  classMap,
  onNavigateToRelation,
}: ClassDetailRelationsProps) {
  const relevant = relations.filter(
    (r) => r.domain_class_id === classId || r.range_class_id === classId
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Direct Relations ({relevant.length})
        </p>
        {relevant.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No direct relations involve this class.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {relevant.map((rel) => {
              const isDomain = rel.domain_class_id === classId
              const otherClass = classMap.get(
                isDomain ? rel.range_class_id : rel.domain_class_id
              )

              return (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => onNavigateToRelation(rel.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  )}
                >
                  <span className="font-medium">{rel.name}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {isDomain ? "→" : "←"} {otherClass?.name ?? "Unknown"}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {inheritedRelations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Inherited Relations ({inheritedRelations.length})
          </p>
          <div className="flex flex-col gap-1">
            {inheritedRelations.map((rel) => {
              const isDomain = rel.role === "domain"
              const otherClass = classMap.get(
                isDomain ? rel.range_class_id : rel.domain_class_id
              )

              return (
                <button
                  key={`inherited-${rel.id}`}
                  type="button"
                  onClick={() => onNavigateToRelation(rel.id)}
                  className={cn(
                    "flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-left text-xs hover:bg-muted/70"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rel.name}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {isDomain ? "→" : "←"} {otherClass?.name ?? "Unknown"}
                    </span>
                  </div>
                  <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Inherited from {rel.inheritedFromClassName}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
