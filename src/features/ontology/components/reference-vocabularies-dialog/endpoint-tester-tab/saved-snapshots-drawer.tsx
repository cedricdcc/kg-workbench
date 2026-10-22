"use client"

import { useState } from "react"
import { Clock, Eye, History, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  deleteEndpointSnapshot,
  type SnapshotSummary,
} from "@/features/ontology/server/actions/reference-vocabularies"

interface SavedSnapshotsDrawerProps {
  snapshots: SnapshotSummary[]
  isLoading: boolean
  onRefresh: () => void
  onSelectSnapshot: (snapshot: SnapshotSummary) => void
}

export function SavedSnapshotsDrawer({
  snapshots,
  isLoading,
  onRefresh,
  onSelectSnapshot,
}: SavedSnapshotsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await deleteEndpointSnapshot(id)
      toast.success("Snapshot deleted.")
      onRefresh()
    } catch {
      toast.error("Failed to delete snapshot.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-2.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" />
          <span>Saved Diagnostic Snapshots ({snapshots.length})</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isOpen ? "Hide" : "View Past Runs"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t p-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading snapshots...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No saved snapshots yet. Run a probe and click &quot;Save Snapshot&quot; to record diagnostic payloads.
            </div>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-1.5">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    onClick={() => onSelectSnapshot(snap)}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Badge
                        variant={snap.statusCode === 200 ? "outline" : "destructive"}
                        className="text-[10px] font-mono"
                      >
                        {snap.statusCode}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                        {snap.providerId}
                      </Badge>
                      <span className="truncate text-muted-foreground text-[11px]">
                        {snap.endpointUrl}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{snap.latencyMs}ms</span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onSelectSnapshot(snap)}
                        title="View payload"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        disabled={deletingId === snap.id}
                        onClick={(e) => handleDelete(snap.id, e)}
                        title="Delete snapshot"
                      >
                        {deletingId === snap.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
