"use client"

import {
  AlertCircle,
  AlertTriangle,
  Eye,
  Info,
  RotateCcw,
  VolumeX,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OntologyDefect } from "@/features/ontology/utils/linter"

export interface DefectCardProps {
  defect: OntologyDefect
  isSuppressed?: boolean
  isSelected?: boolean
  onCardClick?: () => void
  onSelectEntity: (id: string, kind: "class" | "relation") => void
  onSuppress: (defectId: string) => void
  onRestore: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
}

export function DefectCard({
  defect,
  isSuppressed = false,
  isSelected = false,
  onCardClick,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
}: DefectCardProps) {
  const isError = defect.severity === "error"
  const isWarning = defect.severity === "warning"

  return (
    <div
      onClick={onCardClick}
      className={`rounded-lg border p-3.5 transition-all ${
        onCardClick ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
          : isSuppressed
            ? "border-dashed bg-muted/20 opacity-75"
            : isError
              ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
              : isWarning
                ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                : "border-sky-500/30 bg-sky-500/5 hover:border-sky-500/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isError ? (
            <AlertCircle className="size-4 shrink-0 text-destructive" />
          ) : isWarning ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Info className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          )}
          <span className="text-xs font-semibold text-foreground">
            {defect.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {defect.oopsPitfallId && (
            <Badge
              variant="outline"
              className="px-1.5 py-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
            >
              {defect.oopsPitfallId}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`px-1.5 py-0 text-[10px] font-medium capitalize ${
              isError
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : isWarning
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            }`}
          >
            {defect.severity}
          </Badge>
        </div>
      </div>

      <div className="mt-2 text-xs">
        <p className="font-medium text-foreground">
          Target: <span className="font-semibold">{defect.targetName}</span>{" "}
          <span className="text-[11px] text-muted-foreground">
            ({defect.targetType})
          </span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {defect.description}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-2.5">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => onSelectEntity(defect.targetId, defect.targetType)}
          >
            <Eye className="size-3" />
            View
          </Button>

          {defect.quickFixType && onQuickFix && !isSuppressed && (
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => onQuickFix(defect)}
            >
              <Wrench className="size-3" />
              {defect.suggestedAction ?? "Quick Fix"}
            </Button>
          )}
        </div>

        <div>
          {isSuppressed ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onRestore(defect.id)}
            >
              <RotateCcw className="size-3" />
              Restore
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onSuppress(defect.id)}
            >
              <VolumeX className="size-3" />
              Mute
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
