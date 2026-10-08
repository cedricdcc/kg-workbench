"use client"

import { useState } from "react"
import { BookOpen, Loader2, RefreshCw, Trash2 } from "lucide-react"
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
}

export function VocabularyLibraryTab({
  vocabularies,
  isLoading,
  onRefresh,
}: VocabularyLibraryTabProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleSync(vocab: ReferenceOntologySummary) {
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

  async function handleDelete(vocab: ReferenceOntologySummary) {
    if (!confirm(`Remove "${vocab.name}" from workspace reference ontologies?`)) {
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
      <div className="flex h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="pt-2">
      <ScrollArea className="h-[320px] rounded-md border p-3">
        {vocabularies.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
            <BookOpen className="mb-2 h-8 w-8 opacity-40" />
            <p className="font-medium">No reference vocabularies in workspace yet.</p>
            <p className="text-[11px] opacity-75">
              Switch to the &quot;Search &amp; Add&quot; tab to search OLS4 or LOV and add standard ontologies.
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
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {v.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {v.prefix}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {v.termCount} terms
                      </Badge>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      {v.baseIri}
                    </div>
                    <div className="text-[10px] text-muted-foreground/80">
                      {v.syncedAt
                        ? `Last synced: ${new Date(v.syncedAt).toLocaleDateString()} ${new Date(v.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : "Not synced yet"}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSyncing || isDeleting}
                      onClick={() => handleSync(v)}
                      className="gap-1.5 text-xs h-8"
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
                      onClick={() => handleDelete(v)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
