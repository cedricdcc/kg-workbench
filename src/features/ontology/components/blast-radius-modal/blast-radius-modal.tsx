"use client"

import { useEffect, useState, useTransition } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getClassBlastRadiusAction,
  getRelationBlastRadiusAction,
} from "../../server/actions/blast-radius"
import type { BlastRadiusReport } from "../../server/blast-radius/types"
import { BlastRadiusBadge } from "./blast-radius-badge"
import { BlastRadiusMetrics } from "./blast-radius-metrics"
import { BlastRadiusDetails } from "./blast-radius-details"

export interface BlastRadiusTarget {
  type: "class" | "relation"
  id: string
  name: string
  ontologyId: string
}

interface BlastRadiusModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: BlastRadiusTarget | null
  onConfirmDelete: () => Promise<void>
}

interface BlastRadiusModalContentProps {
  target: BlastRadiusTarget
  onClose: () => void
  onConfirmDelete: () => Promise<void>
}

function BlastRadiusModalContent({
  target,
  onClose,
  onConfirmDelete,
}: BlastRadiusModalContentProps) {
  const [report, setReport] = useState<BlastRadiusReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  useEffect(() => {
    let isMounted = true

    async function loadReport() {
      try {
        const res =
          target.type === "class"
            ? await getClassBlastRadiusAction(target.ontologyId, target.id)
            : await getRelationBlastRadiusAction(target.ontologyId, target.id)

        if (isMounted) {
          setReport(res)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(
            (err as Error).message || "Failed to calculate blast radius."
          )
          setLoading(false)
        }
      }
    }

    void loadReport()

    return () => {
      isMounted = false
    }
  }, [target.id, target.ontologyId, target.type])

  const isCritical = report?.severity === "critical"
  const canDelete = !isCritical || acknowledged

  function handleConfirm() {
    startDeleteTransition(async () => {
      await onConfirmDelete()
      onClose()
    })
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <div className="flex items-center justify-between gap-4 pr-6">
          <DialogTitle className="text-base font-semibold">
            Pre-Flight Blast Radius Analysis
          </DialogTitle>
          {report && (
            <BlastRadiusBadge
              severity={report.severity}
              score={report.riskScore}
            />
          )}
        </div>
        <DialogDescription className="text-xs">
          Review downstream dependencies and broken contracts before deleting{" "}
          <span className="font-semibold text-foreground">
            {target.type}: &quot;{target.name}&quot;
          </span>
          .
        </DialogDescription>
      </DialogHeader>

      {loading && (
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Analyzing downstream dependencies and competency questions...
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          <p className="font-semibold">Failed to evaluate blast radius</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {report && !loading && (
        <div className="space-y-4 py-2">
          <BlastRadiusMetrics
            summary={report.summary}
            targetType={report.targetType}
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">
              Downstream Dependency Breakdown
            </p>
            <BlastRadiusDetails
              details={report.details}
              targetType={report.targetType}
            />
          </div>

          {isCritical && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded border-destructive text-destructive focus:ring-destructive"
                />
                <span>
                  I acknowledge that this action will break downstream
                  competency questions, relations, and extracted facts.
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleConfirm}
          disabled={loading || !canDelete || isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Confirm Deletion
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function BlastRadiusModal({
  open,
  onOpenChange,
  target,
  onConfirmDelete,
}: BlastRadiusModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && target ? (
        <BlastRadiusModalContent
          key={`${target.type}-${target.id}`}
          target={target}
          onClose={() => onOpenChange(false)}
          onConfirmDelete={onConfirmDelete}
        />
      ) : null}
    </Dialog>
  )
}
