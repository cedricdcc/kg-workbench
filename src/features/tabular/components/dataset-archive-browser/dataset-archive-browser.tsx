"use client"

import { useMemo, useState } from "react"
import { Database, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DatasetArchiveCard } from "./dataset-archive-card"
import type { DatasetArchiveBrowserProps } from "./types"

export function DatasetArchiveBrowser({
  datasets,
  onOpenUpload,
  onInspectProfile,
  onOpenMappingWizard,
  onDeleteDataset,
}: DatasetArchiveBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter((d) => d.sourceName.toLowerCase().includes(q))
  }, [datasets, searchQuery])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header & Upload Button */}
      <div className="space-y-2.5 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Dataset Archive ({datasets.length})
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={onOpenUpload}
          >
            <Plus className="h-3 w-3" />
            Add source
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Dataset List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {filtered.length > 0 ? (
            filtered.map((d) => (
              <DatasetArchiveCard
                key={d.id}
                dataset={d}
                onInspectProfile={onInspectProfile}
                onOpenMappingWizard={onOpenMappingWizard}
                onDeleteDataset={onDeleteDataset}
              />
            ))
          ) : (
            <div className="space-y-2 py-8 text-center text-xs text-muted-foreground">
              <Database className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <div>
                {searchQuery
                  ? "No datasets matching query."
                  : "No archived datasets yet."}
              </div>
              {!searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary underline"
                  onClick={onOpenUpload}
                >
                  Upload your first dataset
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
