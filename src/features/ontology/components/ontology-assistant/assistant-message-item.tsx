"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Wrench } from "lucide-react"

import { cn } from "@/lib/utils"
import { ProposedChangesCard } from "./proposed-changes-card"
import type { OntologyAssistantMessage } from "./types"

export interface AssistantMessageItemProps {
  message: OntologyAssistantMessage
  isApplyingProposal: boolean
  onApplyProposal: (messageId: string) => void
  onDiscardProposal: (messageId: string) => void
}

export function AssistantMessageItem({
  message,
  isApplyingProposal,
  onApplyProposal,
  onDiscardProposal,
}: AssistantMessageItemProps) {
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const isUser = message.role === "user"
  const inspectedTools = message.inspectedTools ?? []

  return (
    <div
      data-role={message.role}
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border/60 bg-muted/30 text-foreground"
        )}
      >
        {!isUser && inspectedTools.length > 0 && (
          <div className="mb-1.5">
            <button
              type="button"
              onClick={() => setToolsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              {toolsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Wrench className="h-3 w-3" />
              <span>
                Inspected {inspectedTools.length}{" "}
                {inspectedTools.length === 1 ? "tool" : "tools"}
              </span>
            </button>
            {toolsExpanded && (
              <ul className="mt-1 space-y-1 rounded border border-border/50 bg-background/70 p-2 text-[11px] text-muted-foreground">
                {inspectedTools.map((record, idx) => (
                  <li key={`${record.tool}-${idx}`} className="truncate">
                    <span className="font-mono font-medium text-foreground">
                      {record.tool}
                    </span>
                    {record.summary ? ` — ${record.summary}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="break-words whitespace-pre-wrap">{message.content}</p>

        {!isUser && message.proposal && (
          <ProposedChangesCard
            proposal={message.proposal}
            status={message.proposalStatus ?? "pending"}
            appliedCount={message.appliedCount}
            isApplying={isApplyingProposal}
            applyError={message.applyError}
            onApply={() => onApplyProposal(message.id)}
            onDiscard={() => onDiscardProposal(message.id)}
          />
        )}
      </div>
    </div>
  )
}
