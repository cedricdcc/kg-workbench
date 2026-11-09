"use client"

import { useState, useRef, type KeyboardEvent } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export const DEFAULT_SUGGESTED_QUESTIONS = [
  "Find all organizations located in Finland",
  "What relationships connect marine ecology research?",
  "Detect conflicting facts or semantic drift across datasets",
]

export interface ChatInputBarProps {
  onSubmit: (query: string) => void | Promise<void>
  isLoading?: boolean
  disabled?: boolean
  suggestedQuestions?: string[]
  placeholder?: string
  className?: string
}

export function ChatInputBar({
  onSubmit,
  isLoading = false,
  disabled = false,
  suggestedQuestions = DEFAULT_SUGGESTED_QUESTIONS,
  placeholder = "Ask a question about your knowledge graph, accepted facts, or mapped tables...",
  className,
}: ChatInputBarProps) {
  const [query, setQuery] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = query.trim()
    if (!trimmed || isLoading || disabled) return
    onSubmit(trimmed)
    setQuery("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSelectChip(suggestion: string) {
    setQuery(suggestion)
    textareaRef.current?.focus()
  }

  return (
    <div
      className={cn(
        "space-y-2.5 border-t bg-card/80 p-3 backdrop-blur-sm",
        className
      )}
      data-testid="chat-input-bar"
    >
      {/* Suggested Question Chips */}
      {suggestedQuestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase">
            <Sparkles className="h-3 w-3 text-primary" /> Suggestions:
          </span>
          {suggestedQuestions.map((question, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectChip(question)}
              disabled={isLoading || disabled}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:bg-muted hover:text-foreground disabled:opacity-50"
              data-testid="suggested-chip"
            >
              <span>{question}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Textarea & Submit */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="relative flex items-end gap-2"
      >
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={2}
            className="max-h-32 min-h-[56px] resize-none pr-12 text-xs leading-relaxed focus-visible:ring-primary/40"
            data-testid="chat-input-textarea"
          />
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={!query.trim() || isLoading || disabled}
          className="h-9 w-9 shrink-0 rounded-lg"
          data-testid="chat-submit-btn"
          title={isLoading ? "Analyzing..." : "Send query (Enter)"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send query</span>
        </Button>
      </form>
    </div>
  )
}
