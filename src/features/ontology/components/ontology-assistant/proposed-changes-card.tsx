"use client"

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProposalStatus, ProposedChangePlan } from "./types"

export interface ProposedChangesCardProps {
  proposal: ProposedChangePlan
  status: ProposalStatus
  appliedCount?: number
  isApplying: boolean
  applyError?: string | null
  onApply: () => void
  onDiscard: () => void
}

const KIND_BADGE_STYLES: Record<string, string> = {
  create:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  update: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  rename:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  delete: "bg-destructive/10 text-destructive border-destructive/30",
  cq: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  dependency:
    "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
}

export function ProposedChangesCard({
  proposal,
  status,
  appliedCount,
  isApplying,
  applyError,
  onApply,
  onDiscard,
}: ProposedChangesCardProps) {
  const destructiveWarnings = proposal.operations
    .filter((op) => op.isDestructive && op.blastRadiusWarning)
    .map((op) => op.blastRadiusWarning as string)

  const hasValidationErrors = proposal.validationErrors.length > 0

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border bg-card p-3 text-xs shadow-xs",
        proposal.hasDestructiveChanges && status === "pending"
          ? "border-destructive/40"
          : "border-border"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          Proposed Changes ({proposal.operations.length})
        </span>
        {status === "applied" ? (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-3 w-3" />
            Applied ({appliedCount ?? proposal.operations.length})
          </Badge>
        ) : status === "discarded" ? (
          <Badge variant="outline" className="text-muted-foreground">
            Discarded
          </Badge>
        ) : (
          <Badge variant="secondary">Pending review</Badge>
        )}
      </div>

      {proposal.hasDestructiveChanges && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">Destructive changes included</p>
            {destructiveWarnings.length > 0 ? (
              <ul className="list-disc pl-4 text-[11px]">
                {destructiveWarnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px]">
                Review carefully before applying. All changes run in a single
                atomic transaction.
              </p>
            )}
          </div>
        </div>
      )}

      {hasValidationErrors && (
        <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
          <p className="font-medium">Validation errors:</p>
          <ul className="mt-1 list-disc pl-4 text-[11px]">
            {proposal.validationErrors.map((err) => (
              <li key={`${err.index}-${err.tool}`}>
                {err.tool}: {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-1.5">
        {proposal.operations.map((op) => (
          <li
            key={`${op.index}-${op.tool}`}
            className="flex items-start gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1.5"
          >
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 px-1.5 py-0 text-[10px] uppercase",
                KIND_BADGE_STYLES[op.kind] ?? ""
              )}
            >
              {op.kind}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="leading-snug text-foreground">{op.summary}</p>
              {op.blastRadiusWarning && !proposal.hasDestructiveChanges && (
                <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                  {op.blastRadiusWarning}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {applyError && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-[11px] leading-snug">{applyError}</p>
        </div>
      )}

      {status === "pending" && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={isApplying}
            onClick={onDiscard}
          >
            Discard
          </Button>
          <Button
            type="button"
            variant={proposal.hasDestructiveChanges ? "destructive" : "default"}
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={
              isApplying ||
              hasValidationErrors ||
              proposal.operations.length === 0
            }
            onClick={onApply}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Applying...
              </>
            ) : (
              "Apply Changes"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
