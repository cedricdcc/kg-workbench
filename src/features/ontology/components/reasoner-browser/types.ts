import type { ReasonerResultPayload } from "@/features/ontology/server/actions/run-ontology-reasoning"

export interface FormattedSeverityPill {
  label: string
  bgClass: string
  textClass: string
  borderClass: string
}

export function formatReasonerSeverityPill(
  severity: string
): FormattedSeverityPill {
  const norm = severity.toLowerCase()
  if (norm === "critical" || norm === "error" || norm === "violation") {
    return {
      label: "CRITICAL",
      bgClass: "bg-red-500/10",
      textClass: "text-red-700 dark:text-red-400",
      borderClass: "border-red-500/30",
    }
  }
  if (norm === "warning") {
    return {
      label: "WARNING",
      bgClass: "bg-amber-500/10",
      textClass: "text-amber-700 dark:text-amber-400",
      borderClass: "border-amber-500/30",
    }
  }
  return {
    label: "INFO",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-500/30",
  }
}

export interface ReasonerBrowserProps {
  ontologyId: string
  latestRun: {
    status: string
    createdAt: string
    result: ReasonerResultPayload | null
  } | null
  isLoading?: boolean
  onRunReasoner: () => void
  onOpenFullReport?: () => void
  onSelectClass?: (classId: string) => void
}
