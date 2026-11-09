"use client"

import { useState } from "react"
import { Brain, ChevronDown, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AnalystReasoningStep } from "../../types"

export interface ReasoningTraceCardProps {
  steps?: AnalystReasoningStep[]
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function ReasoningTraceCard({
  steps = [],
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
}: ReasoningTraceCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  if (!steps || steps.length === 0) {
    return null
  }

  function handleToggle() {
    const next = !isOpen
    if (!isControlled) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 text-xs transition-colors",
        isOpen && "bg-muted/40",
        className
      )}
      data-testid="reasoning-trace-card"
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50"
        data-testid="reasoning-trace-toggle"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">
            Reasoning Trace
          </span>
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[10px] font-normal"
          >
            {steps.length} {steps.length === 1 ? "step" : "steps"}
          </Badge>
        </div>
        <div className="text-muted-foreground">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div
          className="space-y-2.5 border-t px-3 py-2.5"
          data-testid="reasoning-trace-expanded"
        >
          {steps.map((stepItem, index) => (
            <div
              key={index}
              className="flex flex-col gap-1 rounded border border-border/50 bg-background/80 p-2.5"
              data-testid="reasoning-trace-step"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 font-mono text-[10px]"
                >
                  Step {index + 1}
                </Badge>
                <span className="text-xs font-medium text-foreground">
                  {stepItem.step}
                </span>
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                {stepItem.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
