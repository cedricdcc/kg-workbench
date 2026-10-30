import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { BlastRadiusSeverity } from "../../server/blast-radius/types"

interface BlastRadiusBadgeProps {
  severity: BlastRadiusSeverity
  score: number
}

export function BlastRadiusBadge({ severity, score }: BlastRadiusBadgeProps) {
  switch (severity) {
    case "critical":
      return (
        <Badge
          variant="destructive"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Critical Impact ({score}/100)
        </Badge>
      )
    case "high":
      return (
        <Badge
          variant="secondary"
          className="flex items-center gap-1.5 border-orange-300 bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          High Impact ({score}/100)
        </Badge>
      )
    case "medium":
      return (
        <Badge
          variant="secondary"
          className="flex items-center gap-1.5 border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Medium Impact ({score}/100)
        </Badge>
      )
    default:
      return (
        <Badge
          variant="secondary"
          className="flex items-center gap-1.5 border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Low Impact ({score}/100)
        </Badge>
      )
  }
}
