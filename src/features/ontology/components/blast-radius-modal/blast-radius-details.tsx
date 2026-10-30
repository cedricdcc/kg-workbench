import { ScrollArea } from "@/components/ui/scroll-area"
import type { BlastRadiusReport } from "../../server/blast-radius/types"

interface BlastRadiusDetailsProps {
  details: BlastRadiusReport["details"]
  targetType: "class" | "relation"
}

export function BlastRadiusDetails({
  details,
  targetType,
}: BlastRadiusDetailsProps) {
  const hasItems =
    details.competencyQuestions.length > 0 ||
    details.relations.length > 0 ||
    details.subclasses.length > 0 ||
    details.attributes.length > 0

  if (!hasItems) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        No formal dependents detected. This entity can be deleted safely with
        zero downstream blast radius.
      </div>
    )
  }

  return (
    <ScrollArea className="h-60 rounded-md border p-3">
      <div className="space-y-4 text-xs">
        {details.competencyQuestions.length > 0 && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground">
              <span>
                Competency Questions ({details.competencyQuestions.length})
              </span>
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {details.competencyQuestions.map((cq) => (
                <li key={cq.id}>
                  <span className="font-medium text-foreground">
                    {cq.question}
                  </span>{" "}
                  <span className="text-[10px] text-muted-foreground">
                    ({cq.roles.join(", ")})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {targetType === "class" && details.relations.length > 0 && (
          <div>
            <h4 className="mb-1.5 font-semibold text-foreground">
              Connected Relations ({details.relations.length})
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {details.relations.map((rel) => (
                <li key={rel.id}>
                  <span className="font-mono text-foreground">{rel.name}</span>{" "}
                  <span>
                    ({rel.direction === "outgoing" ? "to" : "from"}{" "}
                    <span className="font-medium text-foreground">
                      {rel.otherClassName}
                    </span>
                    )
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {targetType === "class" && details.subclasses.length > 0 && (
          <div>
            <h4 className="mb-1.5 font-semibold text-foreground">
              Orphaned Subclasses ({details.subclasses.length})
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {details.subclasses.map((sub) => (
                <li key={sub.id}>
                  <span className="font-medium text-foreground">
                    {sub.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {details.attributes.length > 0 && (
          <div>
            <h4 className="mb-1.5 font-semibold text-foreground">
              Associated Attributes ({details.attributes.length})
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {details.attributes.map((attr) => (
                <li key={attr.id}>
                  <span className="font-mono text-foreground">{attr.name}</span>{" "}
                  <span className="text-[10px] text-muted-foreground">
                    ({attr.dataType})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
