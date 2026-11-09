"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Network,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { routes } from "@/lib/routes"
import type { SystemServiceDisplay } from "@/features/settings/server/queries/get-system-services"
import type {
  AnalystCitation,
  AnalystConversation,
  AnalystSubgraph,
} from "../../types"
import { createConversationAction } from "../../server/actions/create-conversation"
import { sendQueryAction } from "../../server/actions/send-query"
import { getMessagesQuery } from "../../server/queries/get-messages"
import { ConversationSidebar } from "../conversation-sidebar/conversation-sidebar"
import { ChatMessageList } from "../chat-view/chat-message-list"
import { ChatInputBar } from "../chat-view/chat-input-bar"
import { CitationInspector } from "../citation-drawer/citation-inspector"

export interface AnalystShellContextValue {
  selectedConversationId: string | null
  activeTab: "chat" | "contradictions"
  setActiveTab: (tab: "chat" | "contradictions") => void
  openCitation: (citation: AnalystCitation) => void
  openSubgraph: (subgraph: AnalystSubgraph) => void
}

export const AnalystShellContext =
  createContext<AnalystShellContextValue | null>(null)

export function useAnalystShell(): AnalystShellContextValue {
  const context = useContext(AnalystShellContext)
  if (!context) {
    throw new Error("useAnalystShell must be used within an AnalystShell")
  }
  return context
}

export interface AnalystShellProps {
  ontologyId: string
  ontologyDocuments?: Array<{ id: string; name: string }>
  initialConversations: AnalystConversation[]
  initialConversationId?: string | null
  services?: SystemServiceDisplay[]
}

export function AnalystShell({
  ontologyId,
  ontologyDocuments = [],
  initialConversations = [],
  initialConversationId = null,
  services = [],
}: AnalystShellProps) {
  const router = useRouter()
  const [conversations, setConversations] =
    useState<AnalystConversation[]>(initialConversations)
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId ?? initialConversations[0]?.id ?? null)

  const [activeTab, setActiveTab] = useState<"chat" | "contradictions">("chat")
  const [activeCitation, setActiveCitation] = useState<AnalystCitation | null>(
    null
  )
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false)
  const [activeSubgraph, setActiveSubgraph] = useState<AnalystSubgraph | null>(
    null
  )
  const [isSubgraphModalOpen, setIsSubgraphModalOpen] = useState(false)
  const [isCreatingQuick, setIsCreatingQuick] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Polling / fetching conversation messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["analyst-messages", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return []
      return await getMessagesQuery(selectedConversationId)
    },
    enabled: Boolean(selectedConversationId),
    refetchInterval: (query) => {
      const list = query.state.data ?? []
      const lastMessage = list[list.length - 1]
      if (lastMessage && lastMessage.sender === "user") {
        return 2000
      }
      return false
    },
  })

  const isAssistantThinking = useMemo(() => {
    if (!messages.length) return false
    return messages[messages.length - 1]?.sender === "user"
  }, [messages])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  )

  const analystService = useMemo(
    () => services.find((s) => s.id === "analyst"),
    [services]
  )
  const isAnalystOnline = analystService?.status === "online"

  const currentDocument = useMemo(
    () => ontologyDocuments.find((d) => d.id === ontologyId),
    [ontologyDocuments, ontologyId]
  )

  function handleSelectConversation(id: string) {
    setSelectedConversationId(id)
    router.replace(routes.analyst.conversation(id))
  }

  function handleConversationCreated(conversation: AnalystConversation) {
    setConversations((prev) => [conversation, ...prev])
    setSelectedConversationId(conversation.id)
    router.replace(routes.analyst.conversation(conversation.id))
  }

  function handleConversationDeleted(deletedId: string) {
    setConversations((prev) => prev.filter((c) => c.id !== deletedId))
    if (selectedConversationId === deletedId) {
      const remaining = conversations.filter((c) => c.id !== deletedId)
      const nextId = remaining[0]?.id ?? null
      setSelectedConversationId(nextId)
      if (nextId) {
        router.replace(routes.analyst.conversation(nextId))
      } else {
        router.replace(routes.analyst.root)
      }
    }
  }

  function handleOpenCitation(citation: AnalystCitation) {
    setActiveCitation(citation)
    setIsCitationDrawerOpen(true)
  }

  function handleOpenSubgraph(subgraph: AnalystSubgraph) {
    setActiveSubgraph(subgraph)
    setIsSubgraphModalOpen(true)
  }

  async function handleQuickNewAnalysis() {
    if (!ontologyId || isCreatingQuick) return
    setIsCreatingQuick(true)
    try {
      const newConv = await createConversationAction({
        ontologyId,
        title: "New Analysis",
      })
      handleConversationCreated(newConv)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create new analysis"
      )
    } finally {
      setIsCreatingQuick(false)
    }
  }

  async function handleSendMessage(queryText: string) {
    if (!selectedConversationId || !ontologyId || isSending) return
    setIsSending(true)
    try {
      await sendQueryAction({
        conversationId: selectedConversationId,
        ontologyId,
        query: queryText,
      })
      await refetchMessages()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to dispatch graph query"
      )
    } finally {
      setIsSending(false)
    }
  }

  const contextValue: AnalystShellContextValue = useMemo(
    () => ({
      selectedConversationId,
      activeTab,
      setActiveTab,
      openCitation: handleOpenCitation,
      openSubgraph: handleOpenSubgraph,
    }),
    [selectedConversationId, activeTab]
  )

  return (
    <AnalystShellContext.Provider value={contextValue}>
      <div
        className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground"
        data-testid="analyst-shell"
      >
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/60 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight">
                  Graph Analyst
                </h1>
                {currentDocument && (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {currentDocument.name}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Conversational multi-hop reasoning and contradiction detector
              </p>
            </div>
          </div>

          {/* Center Tab Switcher */}
          <div className="flex items-center">
            <Tabs
              value={activeTab}
              onValueChange={(val) =>
                setActiveTab(val as "chat" | "contradictions")
              }
            >
              <TabsList className="h-8">
                <TabsTrigger
                  value="chat"
                  className="gap-1.5 text-xs data-[state=active]:font-medium"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Chat & QA</span>
                </TabsTrigger>
                <TabsTrigger
                  value="contradictions"
                  className="gap-1.5 text-xs data-[state=active]:font-medium"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Contradictions & Drift</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Microservice Health Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isAnalystOnline
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}
              title={
                isAnalystOnline
                  ? "Analyst daemon online and polling outbox"
                  : "Analyst daemon offline. Queries will queue in outbox until worker starts."
              }
            >
              {isAnalystOnline ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="capitalize">
                {analystService ? analystService.status : "offline"}
              </span>
            </div>
          </div>
        </header>

        {/* Main Shell Body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <ConversationSidebar
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            ontologyId={ontologyId}
            onSelectConversation={handleSelectConversation}
            onConversationCreated={handleConversationCreated}
            onConversationDeleted={handleConversationDeleted}
          />

          {/* Center Main Panel */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            {activeTab === "chat" ? (
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                data-testid="analyst-chat-view"
              >
                {selectedConversation ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex h-11 shrink-0 items-center justify-between border-b bg-muted/20 px-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <h2 className="truncate text-xs font-medium">
                          {selectedConversation.title}
                        </h2>
                      </div>
                    </div>

                    {/* Chat Messages Thread */}
                    <ChatMessageList
                      messages={messages}
                      isLoading={isSending || isAssistantThinking}
                      onSelectCitation={handleOpenCitation}
                      onViewSubgraph={handleOpenSubgraph}
                    />

                    {/* Chat Input Bar */}
                    <ChatInputBar
                      onSubmit={handleSendMessage}
                      isLoading={isSending}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold">
                      No Analysis Selected
                    </h3>
                    <p className="mb-4 max-w-sm text-xs text-muted-foreground">
                      Select an existing analysis from the sidebar or start a
                      new one to query the graph.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={handleQuickNewAnalysis}
                      disabled={isCreatingQuick || !ontologyId}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Start New Analysis</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex min-h-0 flex-1 flex-col overflow-auto p-6"
                data-testid="analyst-contradictions-view"
              >
                {/* Contradictions Slot (Task 9 will mount ContradictionsTab here) */}
                <div className="max-w-4xl space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <h2 className="text-sm font-semibold">
                        Knowledge Contradictions &amp; Semantic Drift
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Inspect conflicting facts detected across documents,
                      extractors, and tabular mappings. Resolve drift by
                      selecting the authoritative statement.
                    </p>
                  </div>

                  <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                    Run drift analysis to verify consistency across accepted
                    triples.
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Citation Drawer / Sheet */}
        <CitationInspector
          data-testid="analyst-citation-drawer"
          citation={activeCitation}
          open={isCitationDrawerOpen}
          onOpenChange={setIsCitationDrawerOpen}
        />

        {/* Subgraph Visualizer Modal */}
        <Dialog
          open={isSubgraphModalOpen}
          onOpenChange={setIsSubgraphModalOpen}
        >
          <DialogContent
            className="max-w-3xl"
            data-testid="analyst-subgraph-modal"
          >
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-primary" />
                <DialogTitle className="text-sm">
                  Reasoning Subgraph
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                Entities and relations traversed to answer this query.
              </DialogDescription>
            </DialogHeader>

            {activeSubgraph && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Subgraph preview with {activeSubgraph.nodes.length} nodes and{" "}
                {activeSubgraph.edges.length} edges.
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AnalystShellContext.Provider>
  )
}
