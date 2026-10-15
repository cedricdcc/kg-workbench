"use client"

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getOntologyIssuesSummary,
  type IssuesCounts,
} from "@/features/ontology/utils/issues-summary"

export interface OntologyIssuesPillProps {
  counts: IssuesCounts
  onClick?: () => void
  disabled?: boolean
}

export function OntologyIssuesPill({
  counts,
  onClick,
  disabled,
}: OntologyIssuesPillProps) {
  const summary = getOntologyIssuesSummary(counts)

  let variantStyles = ""
  let icon = null

  switch (summary.variant) {
    case "error":
      variantStyles =
        "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
      icon = <AlertCircle className="size-3.5 shrink-0" />
      break
    case "warning":
      variantStyles =
        "border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
      icon = <AlertTriangle className="size-3.5 shrink-0" />
      break
    case "suggestion":
      variantStyles =
        "border-sky-500/20 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
      icon = <Sparkles className="size-3.5 shrink-0" />
      break
    case "info":
      variantStyles =
        "border-sky-500/20 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
      icon = <Info className="size-3.5 shrink-0" />
      break
    case "clean":
    default:
      variantStyles =
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
      icon = <CheckCircle2 className="size-3.5 shrink-0" />
      break
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onClick}
          className={`h-8 gap-1.5 border px-2.5 text-xs font-medium ${variantStyles}`}
        >
          {icon}
          <span>{summary.label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{summary.tooltip}</TooltipContent>
    </Tooltip>
  )
}
