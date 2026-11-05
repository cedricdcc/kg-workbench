"use client"

import { useState } from "react"
import { Eye, FileSpreadsheet, Network, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ArchivedDatasetSource } from "@/features/tabular/types"
import { formatDatasetFormatBadge } from "./types"

interface DatasetArchiveCardProps {
  dataset: ArchivedDatasetSource
  onInspectProfile: (dataset: ArchivedDatasetSource) => void
  onOpenMappingWizard: (dataset: ArchivedDatasetSource) => void
  onDeleteDataset: (id: string) => Promise<void>
}

export function DatasetArchiveCard({
  dataset,
  onInspectProfile,
  onOpenMappingWizard,
  onDeleteDataset,
}: DatasetArchiveCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const formatBadge = formatDatasetFormatBadge(dataset.fileFormat)
  const isMapped = Boolean(dataset.mappingSpec?.targetClassName)

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
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
          </div>
        </div>

        <span
          className={`py-0.2 inline-flex shrink-0 items-center rounded border px-1.5 text-[9px] font-semibold ${formatBadge.bgClass} ${formatBadge.textClass} ${formatBadge.borderClass}`}
        >
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
