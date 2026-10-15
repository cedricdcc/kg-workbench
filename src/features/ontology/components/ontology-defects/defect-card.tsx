"use client"

import {
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  RotateCcw,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OntologyDefect } from "@/features/ontology/utils/linter"

interface DefectCardProps {
  defect: OntologyDefect
  isSuppressed?: boolean
  onSelectEntity?: (id: string, kind: "class" | "relation") => void
  onSuppress?: (defectId: string) => void
  onRestore?: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
}

export function DefectCard({
  defect,
  isSuppressed = false,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
}: DefectCardProps) {
  const severityBadge =
    defect.severity === "error" ? (
      <Badge
        variant="destructive"
        className="gap-1 px-1.5 py-0 text-[10px] font-semibold tracking-wider uppercase"
      >
        <AlertCircle className="size-3" /> Error
      </Badge>
    ) : defect.severity === "warning" ? (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-400"
      >
        <AlertTriangle className="size-3" /> Warning
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="gap-1 border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] font-semibold tracking-wider text-sky-700 uppercase dark:text-sky-400"
      >
        <Info className="size-3" /> Info
      </Badge>
    )

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-muted-foreground/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {severityBadge}
          {defect.oopsPitfallId && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-muted-foreground"
            >
              OOPS! {defect.oopsPitfallId}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="text-[11px] font-normal">
          {defect.targetType === "class" ? "Class: " : "Relation: "}
          <strong className="ml-1 font-semibold">{defect.targetName}</strong>
        </Badge>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-foreground">
          {defect.title}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {defect.description}
        </p>
      </div>

      {defect.suggestedAction && (
        <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Suggestion: </span>
          {defect.suggestedAction}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectEntity?.(defect.targetId, defect.targetType)}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Eye className="size-3.5" />
          View Entity
        </Button>

        <div className="flex items-center gap-1.5">
          {!isSuppressed && defect.quickFixType && onQuickFix && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onQuickFix(defect)}
              className="h-7 gap-1 px-2 text-xs font-medium"
            >
              <Wrench className="size-3.5" />
              {defect.quickFixType === "clear_parent"
                ? "Clear Parent"
                : defect.quickFixType === "delete_relation"
                ? "Delete Relation"
                : "Fix"}
            </Button>
          )}

          {isSuppressed ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRestore?.(defect.id)}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Restore
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSuppress?.(defect.id)}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <EyeOff className="size-3.5" />
              Suppress
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
