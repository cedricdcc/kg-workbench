"use client"

import { useMemo } from "react"
import {
  FileText,
  Network,
  Sparkles,
  Table as TableIcon,
  User,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  AnalystCitation,
  AnalystMessage,
  AnalystSubgraph,
} from "../../types"
import { ReasoningTraceCard } from "./reasoning-trace-card"

export interface ChatMessageItemProps {
  message: AnalystMessage
  onSelectCitation?: (citation: AnalystCitation) => void
  onViewSubgraph?: (subgraph: AnalystSubgraph) => void
  defaultTraceOpen?: boolean
  className?: string
}

const CITATION_REGEX =
  /\[(Doc|Table):\s*([^\]#§\n]+?)(?:\s*(?:§|#)\s*([^\]\n]+))?\]/gi

interface ContentToken {
  key: string
  type: "text" | "citation"
  text: string
  citation?: AnalystCitation
}

function parseContentWithCitations(
  content: string,
  citations: AnalystCitation[] = []
): ContentToken[] {
  const tokens: ContentToken[] = []
  let lastIndex = 0
  const regex = new RegExp(CITATION_REGEX.source, "gi")
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        key: `txt-${lastIndex}`,
        type: "text",
        text: content.slice(lastIndex, match.index),
      })
    }

    const rawType = match[1]?.toLowerCase()
    const kind: "document" | "table" =
      rawType === "table" ? "table" : "document"
    const rawName = match[2]?.trim() ?? ""
    const rawAnchor = match[3]?.trim()

    // Match with message.citations if provided
    let matched = citations.find((c) => {
      if (c.sourceType !== kind) return false
      if (c.sourceName.toLowerCase() !== rawName.toLowerCase()) return false
      if (rawAnchor) {
        if (kind === "document") {
          return c.paragraphIndex === parseInt(rawAnchor, 10)
        } else {
          return c.tableRowKey === rawAnchor
        }
      }
      return true
    })

    if (!matched) {
      matched = citations.find(
        (c) =>
          c.sourceType === kind &&
          c.sourceName.toLowerCase() === rawName.toLowerCase()
      )
    }

    const effectiveCitation: AnalystCitation = matched ?? {
      sourceType: kind,
      sourceId: rawName,
      sourceName: rawName,
      paragraphIndex:
        kind === "document" && rawAnchor && !isNaN(Number(rawAnchor))
          ? Number(rawAnchor)
          : undefined,
      tableRowKey: kind === "table" && rawAnchor ? rawAnchor : undefined,
    }

    tokens.push({
      key: `cit-${match.index}`,
      type: "citation",
      text: match[0],
      citation: effectiveCitation,
    })

    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    tokens.push({
      key: `txt-${lastIndex}`,
      type: "text",
      text: content.slice(lastIndex),
    })
  }

  return tokens
}

export function ChatMessageItem({
  message,
  onSelectCitation,
  onViewSubgraph,
  defaultTraceOpen = false,
  className,
}: ChatMessageItemProps) {
  const isUser = message.sender === "user"

  const parsedTokens = useMemo(() => {
    if (isUser) return []
    return parseContentWithCitations(message.content, message.citations ?? [])
  }, [message.content, message.citations, isUser])

  if (isUser) {
    return (
      <div
        className={cn("flex justify-end gap-3", className)}
        data-sender="user"
        data-testid="chat-message-user"
      >
        <div className="flex max-w-2xl flex-col items-end">
          <div className="rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-xs text-primary-foreground shadow-xs">
            <p className="leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
          <span className="mt-1 text-[10px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary select-none">
          <User className="h-4 w-4" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn("flex items-start gap-3", className)}
      data-sender="assistant"
      data-testid="chat-message-assistant"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary select-none">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="flex max-w-3xl min-w-0 flex-1 flex-col gap-3">
        <div className="rounded-2xl rounded-tl-xs border bg-card p-4 text-xs text-card-foreground shadow-xs">
          {/* Formatted Text Content with parsed citation pills */}
          <div className="leading-relaxed whitespace-pre-wrap text-foreground">
            {parsedTokens.map((token) => {
              if (token.type === "text") {
                return <span key={token.key}>{token.text}</span>
              }

              const cit = token.citation!
              const isTable = cit.sourceType === "table"

              return (
                <button
                  key={token.key}
                  type="button"
                  onClick={() => onSelectCitation?.(cit)}
                  className="mx-1 inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 align-baseline font-mono text-[11px] font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/20"
                  data-testid="citation-pill"
                  data-citation-source={cit.sourceName}
                  title={`Inspect citation: ${cit.sourceName}`}
                >
                  {isTable ? (
                    <TableIcon className="h-3 w-3 shrink-0" />
                  ) : (
                    <FileText className="h-3 w-3 shrink-0" />
                  )}
                  <span>{cit.sourceName}</span>
                  {cit.paragraphIndex !== undefined && (
                    <span className="opacity-80">§{cit.paragraphIndex}</span>
                  )}
                  {cit.tableRowKey && (
                    <span className="opacity-80">#{cit.tableRowKey}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Additional Sources List if citations provided */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5 text-[11px]">
              <span className="mr-1 flex items-center gap-1 font-medium text-muted-foreground">
                <FileText className="h-3 w-3" /> Sources:
              </span>
              {message.citations.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectCitation?.(c)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 font-mono text-[10px] transition-colors hover:bg-primary/10 hover:text-primary"
                  data-testid="citation-pill"
                >
                  <span>{c.sourceName}</span>
                  {c.paragraphIndex !== undefined && (
                    <span>§{c.paragraphIndex}</span>
                  )}
                  {c.tableRowKey && <span>#{c.tableRowKey}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Subgraph button */}
          {message.subgraph && (
            <div className="mt-3 border-t border-border/40 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewSubgraph?.(message.subgraph!)}
                className="h-7 gap-1.5 text-xs"
                data-testid="view-subgraph-btn"
              >
                <Network className="h-3.5 w-3.5 text-primary" />
                <span>View Reasoning Subgraph</span>
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 px-1 text-[10px] font-normal"
                >
                  {message.subgraph.nodes.length} nodes
                </Badge>
              </Button>
            </div>
          )}
        </div>

        {/* Embedded Reasoning Trace Card */}
        {message.reasoningTrace && message.reasoningTrace.length > 0 && (
          <ReasoningTraceCard
            steps={message.reasoningTrace}
            defaultOpen={defaultTraceOpen}
          />
        )}

        <span className="px-1 text-[10px] text-muted-foreground">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
