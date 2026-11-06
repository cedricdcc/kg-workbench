"use client"

import { useState } from "react"
import { Database, Eye, FileSpreadsheet, Network, RotateCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ArchivedDatasetSource, TabularProfileResult } from "@/features/tabular/types"
import { formatDatasetFormatBadge } from "./types"

interface DatasetArchiveCardProps {
  dataset: ArchivedDatasetSource
  onInspectProfile: (dataset: ArchivedDatasetSource) => void
  onOpenMappingWizard: (dataset: ArchivedDatasetSource) => void
  onDeleteDataset: (id: string) => Promise<void>
  onResyncComplete?: (profile: TabularProfileResult) => void
}

export function DatasetArchiveCard({
  dataset,
  onInspectProfile,
  onOpenMappingWizard,
  onDeleteDataset,
  onResyncComplete,
}: DatasetArchiveCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResyncing, setIsResyncing] = useState(false)
  const queryClient = useQueryClient()
  const formatBadge = formatDatasetFormatBadge(dataset.fileFormat)
  const isMapped = Boolean(dataset.mappingSpec?.targetClassName)

  const normalizedFormat = dataset.fileFormat?.toLowerCase()
  const isSqlSource =
    normalizedFormat === "postgres" ||
    normalizedFormat === "mysql" ||
    normalizedFormat === "postgresql"

  const hasConnectionConfig = Boolean(
    dataset.connectionConfig ||
      (dataset as unknown as { connection_config?: Record<string, unknown> }).connection_config
  )

  const handleResync = async () => {
    setIsResyncing(true)
    try {
      const { resyncDatabaseSourceAction } = await import(
        "../../server/actions/remote-database"
      )
      const res = await resyncDatabaseSourceAction(dataset.id)
      if (res.success) {
        toast.success(`Re-synced "${dataset.sourceName}"`)
        queryClient.invalidateQueries({
          queryKey: ["dataset-sources", dataset.ontologyId],
        })
        onResyncComplete?.(res.profile)
      } else {
        toast.error(res.error || "Failed to re-sync dataset")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setIsResyncing(false)
    }
  }

  const handleDelete = async () => {
    if (confirm(`Remove "${dataset.sourceName}" from archive?`)) {
      setIsDeleting(true)
      try {
        await onDeleteDataset(dataset.id)
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-2.5 text-xs transition-colors hover:bg-muted/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isSqlSource ? (
              <Database className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span
              className="truncate font-medium text-foreground"
              title={dataset.sourceName}
            >
              {dataset.sourceName}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {dataset.rowCount.toLocaleString()} rows • {dataset.columnCount}{" "}
            cols
            {dataset.lastSyncedAt && (
              <span className="ml-1 text-[9px] text-muted-foreground/75">
                • synced {new Date(dataset.lastSyncedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <span
          className={`py-0.2 inline-flex shrink-0 items-center gap-1 rounded border px-1.5 text-[9px] font-semibold ${formatBadge.bgClass} ${formatBadge.textClass} ${formatBadge.borderClass}`}
        >
          {isSqlSource && <Database className="h-2.5 w-2.5" />}
          {formatBadge.label}
        </span>
      </div>

      {/* Mapping Status */}
      <div className="flex items-center justify-between text-[11px]">
        {isMapped ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Mapped: {dataset.mappingSpec!.targetClassName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Unmapped
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 border-t pt-1">
        {hasConnectionConfig && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px]"
            onClick={handleResync}
            disabled={isResyncing}
          >
            <RotateCw className={`h-3 w-3 ${isResyncing ? "animate-spin" : ""}`} />
            Re-sync
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => onInspectProfile(dataset)}
        >
          <Eye className="h-3 w-3" />
          Profile
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={() => onOpenMappingWizard(dataset)}
        >
          <Network className="h-3 w-3" />
          {isMapped ? "Re-map" : "Map to KG"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
