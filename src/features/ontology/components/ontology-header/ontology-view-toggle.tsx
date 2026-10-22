"use client"

import { HelpCircle, Network, TableProperties } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type OntologyViewMode = "schema" | "questions" | "visual"

interface OntologyViewToggleProps {
  viewMode: OntologyViewMode
  onViewModeChange: (mode: OntologyViewMode) => void
  cqCount?: number
  disabled?: boolean
}

export function OntologyViewToggle({
  viewMode,
  onViewModeChange,
  cqCount = 0,
  disabled = false,
}: OntologyViewToggleProps) {
  return (
    <div className="ml-auto flex items-center">
      <Tabs
        value={viewMode}
        onValueChange={(val) => onViewModeChange(val as OntologyViewMode)}
        className="w-auto"
      >
        <TabsList className="h-8 p-0.5 bg-muted/60 border border-border/50">
          <TabsTrigger
            value="schema"
            disabled={disabled}
            className="h-7 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
          >
            <TableProperties className="h-3.5 w-3.5" />
            <span>Schema</span>
          </TabsTrigger>

          <TabsTrigger
            value="questions"
            disabled={disabled}
            className="h-7 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
          >
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span>Questions</span>
            {cqCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                {cqCount}
              </span>
            ) : null}
          </TabsTrigger>

          <TabsTrigger
            value="visual"
            disabled={disabled}
            className="h-7 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
          >
            <Network className="h-3.5 w-3.5" />
            <span>Visual</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
