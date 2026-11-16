"use client"

import { useState, type KeyboardEvent } from "react"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export interface AssistantInputBarProps {
  isSending: boolean
  disabled?: boolean
  onSend: (text: string) => void
}

export function AssistantInputBar({
  isSending,
  disabled = false,
  onSend,
}: AssistantInputBarProps) {
  const [value, setValue] = useState("")

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isSending || disabled) return
    onSend(trimmed)
    setValue("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="shrink-0 border-t bg-background p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about CQs, structure, or propose ontology edits..."
          disabled={isSending || disabled}
          rows={2}
          className="max-h-32 min-h-[3.25rem] resize-none text-xs"
        />
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={isSending || disabled || value.trim().length === 0}
          onClick={handleSubmit}
          title="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
