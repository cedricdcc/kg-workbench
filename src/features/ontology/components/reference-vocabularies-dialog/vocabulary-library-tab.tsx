"use client"

import { useState } from "react"
import {
  BookOpen,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  deleteReferenceOntology,
  syncReferenceOntology,
} from "@/features/ontology/server/actions/reference-vocabularies"
import type { ReferenceOntologySummary } from "@/features/ontology/server/queries/reference-vocabularies"

interface VocabularyLibraryTabProps {
  vocabularies: ReferenceOntologySummary[]
  isLoading: boolean
  onRefresh: () => void
  onSelectVocabulary: (vocab: ReferenceOntologySummary) => void
}

export function VocabularyLibraryTab({
  vocabularies,
  isLoading,
  onRefresh,
  onSelectVocabulary,
}: VocabularyLibraryTabProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleSync(
    e: React.MouseEvent,
    vocab: ReferenceOntologySummary
  ) {
    e.stopPropagation()
    setSyncingId(vocab.id)
    try {
      const res = await syncReferenceOntology(vocab.id)
      toast.success(
        `Successfully re-synced "${vocab.prefix.toUpperCase()}": ${res.termsSynced} terms indexed.`
      )
      onRefresh()
    } catch {
      toast.error(`Failed to sync vocabulary ${vocab.prefix}.`)
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDelete(
    e: React.MouseEvent,
    vocab: ReferenceOntologySummary
  ) {
    e.stopPropagation()
    if (
      !confirm(`Remove "${vocab.name}" from workspace reference ontologies?`)
    ) {
      return
    }

    setDeletingId(vocab.id)
    try {
      await deleteReferenceOntology(vocab.id)
      toast.success(`Removed "${vocab.prefix.toUpperCase()}".`)
      onRefresh()
    } catch {
      toast.error("Failed to remove reference vocabulary.")
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col pt-1">
      <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
        {vocabularies.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground">
            <BookOpen className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">
              No reference vocabularies in workspace yet.
            </p>
            <p className="mt-1 max-w-sm text-xs opacity-75">
              Switch to the &quot;Search &amp; Add&quot; tab to search OLS4 or
              LOV and add standard ontologies.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {vocabularies.map((v) => {
              const isSyncing = syncingId === v.id
              const isDeleting = deletingId === v.id

              return (
                <div
                  key={v.id}
                  onClick={() => onSelectVocabulary(v)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 transition-all hover:border-primary/30 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {v.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-muted/30 font-mono text-[10px] uppercase"
                      >
                        {v.prefix}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {v.termCount} terms
                      </Badge>
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {v.baseIri}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {v.syncedAt
                        ? `Last synced: ${new Date(v.syncedAt).toLocaleDateString()} ${new Date(v.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "Not synced yet"}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSyncing || isDeleting}
                      onClick={(e) => handleSync(e, v)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                      />
                      Refetch
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isSyncing || isDeleting}
                      onClick={(e) => handleDelete(e, v)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex items-center pl-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                      <span className="mr-0.5 hidden text-[11px] font-medium sm:inline">
                        Explore
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
