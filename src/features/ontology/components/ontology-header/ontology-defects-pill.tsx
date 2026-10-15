"use client"

import type { OntologyDefectReport } from "@/features/ontology/utils/linter"
import { OntologyIssuesPill } from "./ontology-issues-pill"

export interface OntologyDefectsPillProps {
  report: OntologyDefectReport
  onClick?: () => void
  disabled?: boolean
}

export function OntologyDefectsPill({
  report,
  onClick,
  disabled,
}: OntologyDefectsPillProps) {
  return (
    <OntologyIssuesPill
      counts={report.counts}
      onClick={onClick}
      disabled={disabled}
    />
  )
}
