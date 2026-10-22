"use client"

import { Plus, Search, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CqCoverageFilter, CqMetricsBarProps } from "./types"

export function CqMetricsBar({
  summary,
  modules,
  filters,
  onFilterChange,
  onAddQuestion,
  onAiDraft,
  isAiGenerating = false,
}: CqMetricsBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-card/40 px-6 py-4 backdrop-blur-xs">
      {/* Top Row: Metrics and Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Coverage Progress Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                CQ Concept Coverage
              </span>
              <span className="text-sm font-bold text-foreground">
                {summary.coveragePercentage}%
              </span>
            </div>
            <div className="h-2 w-48 overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out dark:bg-emerald-400"
                style={{ width: `${Math.min(100, Math.max(0, summary.coveragePercentage))}%` }}
              />
            </div>
          </div>

          {/* Breakdown Pills */}
          <div className="flex items-center gap-1.5 pt-3">
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {summary.fullCount} Covered
            </span>
            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              {summary.partialCount} Partial
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {summary.unmappedCount} Unmapped
            </span>
            <span className="text-xs text-muted-foreground/80">
              ({summary.totalCount} total)
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onAiDraft}
            disabled={isAiGenerating}
            className="h-8 gap-1.5 border-primary/30 text-xs font-medium hover:bg-primary/5 hover:border-primary/50"
            title="Draft ontology concepts and relations to satisfy unmapped competency questions"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Draft from CQs</span>
          </Button>

          <Button
            size="sm"
            onClick={onAddQuestion}
            className="h-8 gap-1.5 text-xs font-medium shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Question</span>
          </Button>
        </div>
      </div>

      {/* Bottom Row: Filters, Search, and Scope */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search competency questions..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="h-8 pl-8 pr-7 text-xs"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => onFilterChange({ search: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Module Filter Dropdown */}
          <div className="w-48">
            <Select
              value={filters.moduleId ?? "all"}
              onValueChange={(val) =>
                onFilterChange({ moduleId: val === "all" ? null : val })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Coverage Segment Filter */}
        <Tabs
          value={filters.coverageFilter}
          onValueChange={(val) =>
            onFilterChange({ coverageFilter: val as CqCoverageFilter })
          }
          className="w-auto"
        >
          <TabsList className="h-8 p-0.5 bg-muted/60">
            <TabsTrigger value="all" className="h-7 px-2.5 text-xs">
              All ({summary.totalCount})
            </TabsTrigger>
            <TabsTrigger value="unmapped" className="h-7 px-2.5 text-xs">
              Unmapped / Incomplete ({summary.unmappedCount + summary.partialCount})
            </TabsTrigger>
            <TabsTrigger value="covered" className="h-7 px-2.5 text-xs">
              Covered ({summary.fullCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
