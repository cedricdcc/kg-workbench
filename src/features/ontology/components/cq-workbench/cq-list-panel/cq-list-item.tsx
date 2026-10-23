"use client"

import { useMemo } from "react"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MoreVertical,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { OntologyCQWithModules } from "@/features/ontology/server/queries"
import type { EvaluatedCqCoverage } from "@/features/ontology/utils/cq-coverage"

interface CqListItemProps {
  cq: OntologyCQWithModules
  coverage: EvaluatedCqCoverage
  isSelected: boolean
  searchQuery?: string
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) {
    return <span>{text || "(Empty question)"}</span>
  }

  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  )

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-xs bg-amber-500/25 px-0.5 text-inherit dark:bg-amber-500/35"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  )
}

export function CqListItem({
  cq,
  coverage,
  isSelected,
  searchQuery,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: CqListItemProps) {
  const coveragePill = useMemo(() => {
    if (coverage.status === "full") {
      if (coverage.totalTriples > 1) {
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="rounded bg-emerald-500/20 px-1 py-0 text-[10px] font-semibold">
              {coverage.totalTriples} hops
            </span>
            <span className="max-w-[220px] truncate">
              {coverage.subjectClassName} → … → {coverage.objectClassName}
            </span>
          </span>
        )
      }

      return (
        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="max-w-[260px] truncate">
            {coverage.subjectClassName} → {coverage.predicateRelationName} →{" "}
            {coverage.objectClassName}
          </span>
        </span>
      )
    }

    if (coverage.status === "partial") {
      const parts = [
        coverage.subjectClassName ?? "—",
        coverage.predicateRelationName ?? "—",
        coverage.objectClassName ?? "—",
      ].join(" → ")

      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {coverage.totalTriples > 1 && (
            <span className="rounded bg-amber-500/20 px-1 py-0 text-[10px] font-semibold">
              {coverage.mappedTriples}/{coverage.totalTriples} hops
            </span>
          )}
          <span className="max-w-[220px] truncate">Partial: {parts}</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 rounded border border-border/50 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        <span>Unmapped</span>
      </span>
    )
  }, [coverage])

  return (
    <div
      onClick={onSelect}
      className={`group relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
          : "border-border/60 bg-card hover:border-border hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Question Text */}
        <p className="flex-1 text-sm leading-snug font-medium text-foreground">
          <HighlightedText text={cq.question} query={searchQuery} />
        </p>

        {/* Action Controls */}
        <div
          className="flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveUp && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Move Up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          )}

          {onMoveDown && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Move Down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={onDuplicate} className="gap-2">
                <Copy className="h-3.5 w-3.5" />
                <span>Duplicate Question</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Meta Row: Concept Mapping & Modules */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-1">
        <div>{coveragePill}</div>

        {/* Module Tags */}
        {cq.modules && cq.modules.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {cq.modules.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {m.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
