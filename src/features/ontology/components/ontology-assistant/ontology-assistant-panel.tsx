"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AssistantInputBar } from "./assistant-input-bar"
import { AssistantMessageItem } from "./assistant-message-item"
import type {
  ApplyProposalResult,
  AssistantTurnResponse,
  OntologyAssistantMessage,
  ProposedChangePlan,
} from "./types"

export interface OntologyAssistantPanelProps {
  ontologyId: string
  ontologyName: string
  onAppliedChanges?: () => void
}

const STARTER_PROMPTS = [
  "Audit competency question coverage and identify unmapped concepts",
  "Propose classes and relations to cover unmapped CQs",
  "Check for structural defects and suggest fixes",
  "Summarize the current ontology modules and key classes",
]

function createMessageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function OntologyAssistantPanel({
  ontologyId,
  ontologyName,
  onAppliedChanges,
}: OntologyAssistantPanelProps) {
  const [messages, setMessages] = useState<OntologyAssistantMessage[]>([])
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(
    null
  )
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const sendTurnMutation = useMutation({
    mutationFn: async (
      nextMessages: Array<{ role: "user" | "assistant"; content: string }>
    ): Promise<AssistantTurnResponse> => {
      const response = await fetch("/api/ontology/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ontologyId,
          messages: nextMessages,
        }),
      })
      const payload = (await response.json()) as
        AssistantTurnResponse | { error?: string }
      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : `Assistant request failed (${response.status})`
        )
      }
      return payload as AssistantTurnResponse
    },
    onSuccess: (data) => {
      const assistantMessage: OntologyAssistantMessage = {
        id: createMessageId(),
        role: "assistant",
        content: data.reply,
        inspectedTools: data.inspectedTools,
        proposal: data.proposal,
        proposalStatus: data.proposal ? "pending" : undefined,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to reach ontology assistant"
      toast.error(message)
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: `Error: ${message}`,
          createdAt: new Date().toISOString(),
        },
      ])
    },
  })

  const applyProposalMutation = useMutation({
    mutationFn: async ({
      messageId,
      proposal,
    }: {
      messageId: string
      proposal: ProposedChangePlan
    }): Promise<{ messageId: string; result: ApplyProposalResult }> => {
      setApplyingMessageId(messageId)
      const response = await fetch("/api/ontology/assistant/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ontologyId,
          operations: proposal.operations.map((op) => ({
            tool: op.tool,
            args: op.args,
          })),
        }),
      })

      const payload = (await response.json()) as
        ApplyProposalResult | { error?: string }

      if (!response.ok) {
        if ("ok" in payload && payload.ok === false) {
          throw new Error(payload.error)
        }
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : `Apply failed (${response.status})`
        )
      }

      const result = payload as ApplyProposalResult
      if (!result.ok) {
        throw new Error(result.error)
      }

      return { messageId, result }
    },
    onSuccess: ({ messageId, result }) => {
      const count = result.ok ? result.appliedCount : 0
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                proposalStatus: "applied",
                appliedCount: count,
                applyError: null,
              }
            : msg
        )
      )
      toast.success(
        `Applied ${count} ontology ${count === 1 ? "change" : "changes"}`
      )
      onAppliedChanges?.()
    },
    onError: (err, variables) => {
      const message =
        err instanceof Error ? err.message : "Failed to apply proposed changes"
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === variables.messageId ? { ...msg, applyError: message } : msg
        )
      )
      toast.error(message)
    },
    onSettled: () => {
      setApplyingMessageId(null)
    },
  })

  function handleSend(text: string) {
    const userMsg: OntologyAssistantMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }
    const updated = [...messages, userMsg]
    setMessages(updated)
    sendTurnMutation.mutate(
      updated.map((m) => ({ role: m.role, content: m.content }))
    )
  }

  function handleApplyProposal(messageId: string) {
    const target = messages.find((m) => m.id === messageId)
    if (!target?.proposal || applyProposalMutation.isPending) return
    applyProposalMutation.mutate({
      messageId,
      proposal: target.proposal,
    })
  }

  function handleDiscardProposal(messageId: string) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, proposalStatus: "discarded", applyError: null }
          : msg
      )
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-1.5">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {ontologyName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setMessages([])}
            disabled={
              sendTurnMutation.isPending || applyProposalMutation.isPending
            }
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {messages.length === 0 ? (
            <div className="space-y-3 py-4">
              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-foreground">
                    Ontology Assistant for {ontologyName}
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    Inspect competency questions, detect structural gaps, or
                    propose edits. Every write operation is previewed before
                    applying.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Starter prompts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={sendTurnMutation.isPending}
                      onClick={() => handleSend(prompt)}
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-[11px] text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <AssistantMessageItem
                key={message.id}
                message={message}
                isApplyingProposal={applyingMessageId === message.id}
                onApplyProposal={handleApplyProposal}
                onDiscardProposal={handleDiscardProposal}
              />
            ))
          )}

          {sendTurnMutation.isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
              <span>Analyzing ontology...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <AssistantInputBar
        isSending={sendTurnMutation.isPending}
        onSend={handleSend}
      />
    </div>
  )
}
