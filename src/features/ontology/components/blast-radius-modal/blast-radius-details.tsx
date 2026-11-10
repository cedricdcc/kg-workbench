import { FileQuestion, GitBranch, Network, TableProperties } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  BlastRadiusReport,
  ImpactedSubclass,
} from "../../server/blast-radius/types"

interface BlastRadiusDetailsProps {
  details: BlastRadiusReport["details"] & {
    orphanedSubclasses?: ImpactedSubclass[]
    affectedFactsCount?: number
  }
  targetType: "class" | "relation"
  summary?: BlastRadiusReport["summary"]
}

export function BlastRadiusDetails({
  details,
  targetType,
  summary,
}: BlastRadiusDetailsProps) {
  const subclasses = details.orphanedSubclasses ?? details.subclasses ?? []
  const affectedFactsCount =
    details.affectedFactsCount ?? summary?.affectedFactsCount ?? 0

  const cqsCount = details.competencyQuestions.length
  const relationsCount = targetType === "class" ? details.relations.length : 0
  const subclassesCount = targetType === "class" ? subclasses.length : 0
  const attributesCount = details.attributes.length

  const hasItems =
    cqsCount > 0 ||
    relationsCount > 0 ||
    subclassesCount > 0 ||
    attributesCount > 0 ||
    affectedFactsCount > 0

  if (!hasItems) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
        No formal downstream dependents detected. This entity can be deleted
        safely with zero downstream blast radius.
      </div>
    )
  }

  return (
    <div
      data-slot="blast-radius-dashboard"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      {/* Card 1: Broken Competency Questions */}
      <div
        data-card="competency-questions"
        className="flex flex-col rounded-lg border bg-card p-3 shadow-xs"
      >
        <div className="mb-2 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileQuestion className="h-4 w-4 text-primary" />
            <span>Broken Competency Questions</span>
          </div>
          <Badge
            variant={cqsCount > 0 ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {cqsCount}
          </Badge>
        </div>

        <ScrollArea className="h-56 pr-2">
          {cqsCount === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No broken competency questions.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {details.competencyQuestions.map((cq) => (
                <li
                  key={cq.id}
                  className="rounded-md border border-border/60 bg-muted/30 p-2"
                >
                  <p className="font-medium text-foreground">{cq.question}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cq.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="outline"
                        className="text-[9px] uppercase"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Card 2: Affected Relations & Orphaned Subclasses */}
      <div
        data-card="relations-subclasses"
        className="flex flex-col rounded-lg border bg-card p-3 shadow-xs"
      >
        <div className="mb-2 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Network className="h-4 w-4 text-primary" />
            <span>Affected Relations & Orphaned Subclasses</span>
          </div>
          <Badge
            variant={
              relationsCount + subclassesCount > 0 ? "default" : "secondary"
            }
            className="text-[10px]"
          >
            {relationsCount + subclassesCount}
          </Badge>
        </div>

        <ScrollArea className="h-56 pr-2">
          {relationsCount === 0 && subclassesCount === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No affected relations or subclasses.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              {relationsCount > 0 && (
                <div>
                  <h4 className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                    Connected Relations ({relationsCount})
                  </h4>
                  <ul className="space-y-1">
                    {details.relations.map((rel) => (
                      <li
                        key={rel.id}
                        className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 font-mono text-[11px]"
                      >
                        <span className="font-semibold text-foreground">
                          {rel.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {rel.direction === "outgoing" ? "→ to " : "← from "}
                          <span className="font-medium text-foreground">
                            {rel.otherClassName}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {subclassesCount > 0 && (
                <div>
                  <h4 className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                    <GitBranch className="h-3 w-3" />
                    <span>Orphaned Subclasses ({subclassesCount})</span>
                  </h4>
                  <ul className="space-y-1">
                    {subclasses.map((sub) => (
                      <li
                        key={sub.id}
                        className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] font-medium text-foreground"
                      >
                        {sub.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Card 3: Affected Attributes & Summary of Facts */}
      <div
        data-card="attributes-facts"
        className="flex flex-col rounded-lg border bg-card p-3 shadow-xs"
      >
        <div className="mb-2 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <TableProperties className="h-4 w-4 text-primary" />
            <span>Affected Attributes & Summary of Facts</span>
          </div>
          <Badge
            variant={attributesCount > 0 ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {attributesCount}
          </Badge>
        </div>

        <ScrollArea className="h-56 pr-2">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 p-2.5">
              <span className="text-muted-foreground">
                Affected Extracted Facts
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                {affectedFactsCount}
              </span>
            </div>

            <div>
              <h4 className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                Associated Attributes ({attributesCount})
              </h4>
              {attributesCount === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No attributes attached.
                </p>
              ) : (
                <ul className="space-y-1">
                  {details.attributes.map((attr) => (
                    <li
                      key={attr.id}
                      className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 font-mono text-[11px]"
                    >
                      <span className="font-semibold text-foreground">
                        {attr.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {attr.dataType}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
