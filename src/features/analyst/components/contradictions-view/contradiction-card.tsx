"use client"

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FileText,
  History,
  Layers,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ContradictionConflictType,
  ContradictionStatus,
  KnowledgeContradiction,
} from "../../types"

export interface ContradictionCardProps {
  contradiction: KnowledgeContradiction
  onResolveClick: (contradiction: KnowledgeContradiction) => void
  className?: string
}

function extractFactValue(fact: Record<string, unknown> | undefined): string {
  if (!fact) return "—"
  if (typeof fact.value === "string" && fact.value) return fact.value
  if (typeof fact.object_text === "string" && fact.object_text)
    return fact.object_text
  if (typeof fact.val === "string" && fact.val) return fact.val
  if (typeof fact.text === "string" && fact.text) return fact.text
  return Object.keys(fact).length > 0 ? JSON.stringify(fact) : "—"
}

function extractFactSource(fact: Record<string, unknown> | undefined): string {
  if (!fact) return "Unknown source"
  if (typeof fact.documentTitle === "string" && fact.documentTitle)
    return fact.documentTitle
  if (typeof fact.sourceName === "string" && fact.sourceName)
    return fact.sourceName
  if (typeof fact.sourceTitle === "string" && fact.sourceTitle)
    return fact.sourceTitle
  if (typeof fact.document_name === "string" && fact.document_name)
    return fact.document_name
  if (typeof fact.source === "string" && fact.source) return fact.source
  if (typeof fact.extractor === "string" && fact.extractor)
    return fact.extractor
  return "Unknown source"
}

function extractFactQuote(
  fact: Record<string, unknown> | undefined
): string | null {
  if (!fact) return null
  if (typeof fact.quoteText === "string" && fact.quoteText)
    return fact.quoteText
  if (typeof fact.quote_text === "string" && fact.quote_text)
    return fact.quote_text
  if (typeof fact.quote === "string" && fact.quote) return fact.quote
  if (typeof fact.anchor === "string" && fact.anchor) return fact.anchor
  return null
}

function getConflictTypeBadge(conflictType: ContradictionConflictType) {
  switch (conflictType) {
    case "value_mismatch":
      return {
        label: "Value Mismatch",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        icon: AlertTriangle,
      }
    case "temporal_drift":
      return {
        label: "Temporal Drift",
        className:
          "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
        icon: History,
      }
    case "negation":
      return {
        label: "Negation / Direct Contradiction",
        className:
          "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
        icon: AlertCircle,
      }
    default:
      return {
        label: conflictType,
        className: "border-border bg-muted text-muted-foreground",
        icon: AlertCircle,
      }
  }
}

function getStatusBadge(status: ContradictionStatus) {
  switch (status) {
    case "open":
      return {
        label: "Open",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      }
    case "resolved":
      return {
        label: "Resolved",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      }
    case "dismissed":
      return {
        label: "Dismissed",
        className: "border-border bg-muted text-muted-foreground",
      }
    default:
      return {
        label: status,
        className: "border-border bg-muted text-muted-foreground",
      }
  }
}

export function ContradictionCard({
  contradiction,
  onResolveClick,
  className,
}: ContradictionCardProps) {
  const conflictTypeBadge = getConflictTypeBadge(contradiction.conflictType)
  const statusBadge = getStatusBadge(contradiction.status)
  const isResolvedOrDismissed = contradiction.status !== "open"

  const factAValue = extractFactValue(contradiction.factA)
  const factASource = extractFactSource(contradiction.factA)
  const factAQuote = extractFactQuote(contradiction.factA)

  const factBValue = extractFactValue(contradiction.factB)
  const factBSource = extractFactSource(contradiction.factB)
  const factBQuote = extractFactQuote(contradiction.factB)

  const ConflictIcon = conflictTypeBadge.icon

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs transition-shadow hover:shadow-sm",
        isResolvedOrDismissed && "opacity-85",
        className
      )}
      data-testid="contradiction-card"
      data-contradiction-id={contradiction.id}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="text-sm font-semibold">
              {contradiction.entityLabel}
            </span>
            <span className="text-muted-foreground">→</span>
            <Badge
              variant="outline"
              className="font-mono text-[11px] tracking-tight"
            >
              {contradiction.relationName}
            </Badge>
          </div>

          {/* Conflict Type Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              conflictTypeBadge.className
            )}
            data-testid="conflict-type-badge"
          >
            <ConflictIcon className="h-3 w-3" />
            <span>{conflictTypeBadge.label}</span>
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
              statusBadge.className
            )}
            data-testid="contradiction-status-badge"
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Side-by-Side Statements Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Statement A */}
        <div className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground/80">
              Statement A
            </span>
            <div
              className="flex max-w-[200px] items-center gap-1 truncate text-muted-foreground"
              title={factASource}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{factASource}</span>
            </div>
          </div>

          <div className="mt-0.5 text-xs font-medium text-foreground">
            {factAValue}
          </div>

          {factAQuote && (
            <blockquote className="mt-1 border-l-2 border-primary/40 pl-2 text-[11px] leading-relaxed text-muted-foreground italic">
              &quot;{factAQuote}&quot;
            </blockquote>
          )}
        </div>

        {/* Statement B */}
        <div className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground/80">
              Statement B
            </span>
            <div
              className="flex max-w-[200px] items-center gap-1 truncate text-muted-foreground"
              title={factBSource}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{factBSource}</span>
            </div>
          </div>

          <div className="mt-0.5 text-xs font-medium text-foreground">
            {factBValue}
          </div>

          {factBQuote && (
            <blockquote className="mt-1 border-l-2 border-primary/40 pl-2 text-[11px] leading-relaxed text-muted-foreground italic">
              &quot;{factBQuote}&quot;
            </blockquote>
          )}
        </div>
      </div>

      {/* Explanation Box */}
      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p className="flex-1 leading-relaxed">{contradiction.explanation}</p>
      </div>

      {/* Resolution Notes (if present) */}
      {contradiction.resolutionAction && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
          <span className="font-medium">Resolution: </span>
          {contradiction.resolutionAction}
        </div>
      )}

      {/* Footer / Action */}
      <div className="flex items-center justify-end border-t pt-2.5">
        <Button
          size="sm"
          variant={isResolvedOrDismissed ? "outline" : "default"}
          onClick={() => onResolveClick(contradiction)}
          data-testid="resolve-conflict-button"
          className="gap-1.5 text-xs"
        >
          {isResolvedOrDismissed ? (
            <>
              <Layers className="h-3.5 w-3.5" />
              <span>Resolution Details</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Resolve Conflict</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
