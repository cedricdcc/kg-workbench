"use client"

import { useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import type {
  AnalystCitation,
  AnalystMessage,
  AnalystSubgraph,
} from "../../types"
import { ChatMessageItem } from "./chat-message-item"

export interface ChatMessageListProps {
  messages?: AnalystMessage[]
  isLoading?: boolean
  onSelectCitation?: (citation: AnalystCitation) => void
  onViewSubgraph?: (subgraph: AnalystSubgraph) => void
  onSelectSuggestion?: (question: string) => void
  defaultTraceOpen?: boolean
  className?: string
}

export function ChatMessageList({
  messages = [],
  isLoading = false,
  onSelectCitation,
  onViewSubgraph,
  defaultTraceOpen = false,
  className,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [messages.length, isLoading])

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center p-8 text-center select-none",
          className
        )}
        data-testid="chat-empty-state"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          Start Knowledge Graph Query
        </h3>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Ask natural language questions about your ontology, accepted facts,
          and mapped tabular datasets. The analyst will extract multi-hop paths,
          verify paragraph citations, and detect semantic drift.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn("flex-1 space-y-4 overflow-y-auto p-4", className)}
      data-testid="chat-message-list"
    >
      {messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          onSelectCitation={onSelectCitation}
          onViewSubgraph={onViewSubgraph}
          defaultTraceOpen={defaultTraceOpen}
        />
      ))}

      {isLoading && (
        <div
          className="flex max-w-md animate-pulse items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary"
          data-testid="analyst-thinking-indicator"
        >
          <Sparkles className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span className="font-medium">
            Analyst is reasoning over graph paths &amp; verifying citations...
          </span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
