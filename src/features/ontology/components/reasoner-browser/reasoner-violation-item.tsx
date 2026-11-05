"use client"

import { AlertTriangle, Focus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReasonerJobViolation } from "@/features/ontology/server/actions/run-ontology-reasoning"
import { formatReasonerSeverityPill } from "./types"

interface ReasonerViolationItemProps {
  violation: ReasonerJobViolation
  onSelectClass?: (classId: string) => void
}

export function ReasonerViolationItem({
  violation,
  onSelectClass,
}: ReasonerViolationItemProps) {
  const pill = formatReasonerSeverityPill(violation.severity || "Warning")

  return (
    <div className="rounded-md border p-2.5 text-xs transition-colors hover:bg-muted/40">
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${pill.bgClass} ${pill.textClass} ${pill.borderClass}`}
        >
          <AlertTriangle className="h-3 w-3" />
          {pill.label}
        </span>
        <span className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground">
          {violation.source || "OWL-RL"}
        </span>
      </div>

      <p className="line-clamp-3 leading-relaxed text-foreground">
        {violation.message}
      </p>

      {violation.focusNode && onSelectClass && (
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => onSelectClass(violation.focusNode)}
          >
            <Focus className="h-3 w-3" />
            Focus on canvas
          </Button>
        </div>
      )}
    </div>
  )
}
