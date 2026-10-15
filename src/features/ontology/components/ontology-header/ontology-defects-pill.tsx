"use client"

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { OntologyDefectReport } from "@/features/ontology/utils/linter"

interface OntologyDefectsPillProps {
  report: OntologyDefectReport
  onClick?: () => void
  disabled?: boolean
}

export function OntologyDefectsPill({
  report,
  onClick,
  disabled,
}: OntologyDefectsPillProps) {
  let content = null

  if (report.hasErrors) {
    const errorText = `${report.counts.error} ${
      report.counts.error === 1 ? "Error" : "Errors"
    }`
    const warningText =
      report.counts.warning > 0
        ? ` · ${report.counts.warning} ${
            report.counts.warning === 1 ? "Warning" : "Warnings"
          }`
        : ""

    content = (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onClick}
        className="h-8 gap-1.5 border border-destructive/20 bg-destructive/10 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/20"
      >
        <AlertCircle className="size-3.5 shrink-0" />
        <span>
          {errorText}
          {warningText}
        </span>
      </Button>
    )
  } else if (report.hasWarnings) {
    content = (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onClick}
        className="h-8 gap-1.5 border border-amber-500/20 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>
          {report.counts.warning}{" "}
          {report.counts.warning === 1 ? "Warning" : "Warnings"}
        </span>
      </Button>
    )
  } else if (report.counts.info > 0) {
    content = (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onClick}
        className="h-8 gap-1.5 border border-sky-500/20 bg-sky-500/10 px-2.5 text-xs font-medium text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
      >
        <Info className="size-3.5 shrink-0" />
        <span>{report.counts.info} Info</span>
      </Button>
    )
  } else {
    content = (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onClick}
        className="h-8 gap-1.5 border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
      >
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span>Clean</span>
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        {report.total === 0
          ? "Ontology structure is clean. Click to view defect inspector."
          : `${report.total} defect(s) detected. Click to view details and quick fixes.`}
      </TooltipContent>
    </Tooltip>
  )
}
