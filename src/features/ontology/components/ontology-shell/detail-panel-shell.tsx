"use client"

import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"

import { CollapsibleSidePanel } from "@/components/shared/collapsible-side-panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type DetailPanelMode = "details" | "assistant"

interface DetailPanelShellProps {
  title: string
  isVisual: boolean
  isCollapsed: boolean
  onCollapse: () => void
  onExpand: () => void
  activeMode?: DetailPanelMode
  onModeChange?: (mode: DetailPanelMode) => void
  assistantContent?: ReactNode
  children?: ReactNode
}

export function DetailPanelShell({
  title,
  isVisual,
  isCollapsed,
  onCollapse,
  onExpand,
  activeMode = "details",
  onModeChange,
  assistantContent,
  children,
}: DetailPanelShellProps) {
  const [label, entityName] = title.split(": ", 2)
  const hasAssistant = Boolean(assistantContent)
  const resolvedMode: DetailPanelMode = hasAssistant ? activeMode : "details"

  const headerTitle = (
    <div className="flex items-center justify-between gap-2">
      {resolvedMode === "assistant" ? (
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            AI Copilot
          </p>
          <h2 className="truncate text-base leading-none font-semibold text-foreground">
            Assistant
          </h2>
        </div>
      ) : entityName ? (
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {label}
          </p>
          <h2 className="truncate text-base leading-none font-semibold text-foreground">
            {entityName}
          </h2>
        </div>
      ) : (
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Details
          </p>
          <h2 className="truncate text-base leading-none font-semibold text-foreground">
            Select an item
          </h2>
        </div>
      )}

      {hasAssistant && (
        <div
          role="tablist"
          aria-label="Right panel mode"
          className="inline-flex shrink-0 items-center rounded-md border border-border/60 bg-muted/60 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={resolvedMode === "details"}
            onClick={() => onModeChange?.("details")}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              resolvedMode === "details"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={resolvedMode === "assistant"}
            onClick={() => onModeChange?.("assistant")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              resolvedMode === "assistant"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3 w-3 text-primary" />
            Assistant
          </button>
        </div>
      )}
    </div>
  )

  return (
    <CollapsibleSidePanel
      side="right"
      title={headerTitle}
      widthClassName={isVisual ? "w-[32rem]" : "flex-1"}
      isCollapsed={isCollapsed}
      isCollapsible={isVisual}
      showHeader
      headerClassName="min-h-[3.5rem] items-center bg-muted/10 px-4 py-2"
      expandTitle="Show details"
      collapseTitle="Hide details"
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      <div
        className={cn(
          "min-h-0 flex-1 flex-col",
          resolvedMode === "details" ? "flex" : "hidden"
        )}
      >
        <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
      </div>
      {hasAssistant && (
        <div
          className={cn(
            "min-h-0 flex-1 flex-col",
            resolvedMode === "assistant" ? "flex" : "hidden"
          )}
        >
          {assistantContent}
        </div>
      )}
    </CollapsibleSidePanel>
  )
}
