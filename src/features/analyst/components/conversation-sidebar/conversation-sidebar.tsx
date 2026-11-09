"use client"

import { useMemo, useState } from "react"
import { Loader2, MessageSquare, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { AnalystConversation } from "../../types"
import { createConversationAction } from "../../server/actions/create-conversation"
import { deleteConversationAction } from "../../server/actions/delete-conversation"

export interface ConversationSidebarProps {
  conversations: AnalystConversation[]
  selectedConversationId: string | null
  ontologyId: string
  onSelectConversation: (id: string) => void
  onConversationCreated?: (conversation: AnalystConversation) => void
  onConversationDeleted?: (id: string) => void
  className?: string
}

function formatConversationDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export function ConversationSidebar({
  conversations,
  selectedConversationId,
  ontologyId,
  onSelectConversation,
  onConversationCreated,
  onConversationDeleted,
  className,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase().trim()
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }, [conversations, searchQuery])

  async function handleNewAnalysis() {
    if (!ontologyId || !ontologyId.trim()) {
      toast.error("Please select an ontology document first.")
      return
    }
    setIsCreating(true)
    try {
      const newConv = await createConversationAction({
        ontologyId,
        title: "New Analysis",
      })
      onConversationCreated?.(newConv)
      onSelectConversation(newConv.id)
      toast.success("New analysis started")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create analysis"
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await deleteConversationAction(id)
      onConversationDeleted?.(id)
      toast.success("Analysis deleted")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete analysis"
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <aside
      className={cn(
        "flex h-full w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground select-none",
        className
      )}
      data-testid="analyst-conversation-sidebar"
    >
      <div className="space-y-3 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Analyses
          </span>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 text-xs font-medium"
            onClick={handleNewAnalysis}
            disabled={isCreating || !ontologyId}
          >
            {isCreating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>New Analysis</span>
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search analyses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 bg-background/50 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        {filteredConversations.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {searchQuery
              ? "No matching analyses found"
              : "No analyses yet. Click 'New Analysis' to begin."}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((c) => {
              const isSelected = c.id === selectedConversationId
              const isDeleting = deletingId === c.id

              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectConversation(c.id)
                    }
                  }}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                    isSelected
                      ? "border-border/80 bg-accent font-medium text-accent-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  )}
                  data-active={isSelected ? "true" : undefined}
                >
                  <div className="mr-2 flex min-w-0 flex-1 items-center gap-2.5">
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs leading-snug">{c.title}</p>
                      <span className="text-[10px] leading-none text-muted-foreground">
                        {formatConversationDate(c.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDelete(c.id, e)}
                    disabled={isDeleting}
                    title="Delete analysis"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
