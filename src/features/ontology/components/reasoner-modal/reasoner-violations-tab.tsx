import { Badge } from "@/components/ui/badge"
import type { ReasonerJobViolation } from "../../server/actions/run-ontology-reasoning"
import { formatViolationBadge } from "./formatters"

export { formatViolationBadge }

interface ReasonerViolationsTabProps {
  violations: ReasonerJobViolation[]
}

export function ReasonerViolationsTab({ violations }: ReasonerViolationsTabProps) {
  if (violations.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No semantic violations detected. All classes, relations, and instance shapes conform.
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
      {violations.map((v, idx) => {
        const badge = formatViolationBadge(v.severity)
        return (
          <div
            key={idx}
            className="flex items-start justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {v.source}
                </span>
              </div>
              <p className="text-foreground">{v.message}</p>
              {v.focusNode && (
                <p className="font-mono text-xs text-muted-foreground">
                  Focus Node: {v.focusNode}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
