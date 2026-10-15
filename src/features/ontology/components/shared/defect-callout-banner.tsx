"use client"

import { AlertCircle, AlertTriangle, Info, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OntologyDefect } from "@/features/ontology/utils/linter"

interface DefectCalloutBannerProps {
  defects: OntologyDefect[]
  onQuickFix?: (defect: OntologyDefect) => void
}

export function DefectCalloutBanner({
  defects,
  onQuickFix,
}: DefectCalloutBannerProps) {
  if (!defects || defects.length === 0) return null

  const hasError = defects.some((d) => d.severity === "error")
  const hasWarning = defects.some((d) => d.severity === "warning")

  const containerClass = hasError
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : hasWarning
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"

  const Icon = hasError ? AlertCircle : hasWarning ? AlertTriangle : Info

  return (
    <div
      className={`rounded-lg border p-3.5 space-y-2.5 text-xs ${containerClass}`}
    >
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 shrink-0" />
        <span>
          {defects.length}{" "}
          {defects.length === 1 ? "Active Defect" : "Active Defects"} Detected
        </span>
      </div>

      <div className="space-y-2">
        {defects.map((defect) => (
          <div
            key={defect.id}
            className="flex flex-col gap-1.5 rounded-md bg-background/60 p-2.5 text-foreground shadow-2xs sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium">
                {defect.oopsPitfallId && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] px-1 py-0"
                  >
                    OOPS! {defect.oopsPitfallId}
                  </Badge>
                )}
                <span>{defect.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                {defect.description}
              </p>
            </div>

            {defect.quickFixType && onQuickFix && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuickFix(defect)}
                className="h-7 shrink-0 gap-1 text-xs self-start sm:self-auto"
              >
                <Wrench className="size-3" />
                {defect.quickFixType === "clear_parent"
                  ? "Clear Parent"
                  : defect.quickFixType === "delete_relation"
                  ? "Delete Relation"
                  : "Quick Fix"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
