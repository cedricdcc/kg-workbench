"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, GitMerge, Loader2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RedundancyCluster } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

export interface RedundanciesTabProps {
  clusters?: RedundancyCluster[]
  isLoading?: boolean
  error?: Error | null
  isFullscreen?: boolean
  onSelectClassForRefactor?: (classId: string) => void
}

export function RedundanciesTab({
  clusters = [],
  isLoading = false,
  error = null,
  isFullscreen = false,
  onSelectClassForRefactor,
}: RedundanciesTabProps) {
  const [search, setSearch] = useState("")

  const filteredClusters = useMemo(() => {
    if (!search.trim()) return clusters
    const q = search.toLowerCase().trim()
    return clusters.filter(
      (c) =>
        c.clusterName.toLowerCase().includes(q) ||
        c.classNames.some((n) => n.toLowerCase().includes(q))
    )
  }, [clusters, search])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Loader2 className="mb-3 size-6 animate-spin text-primary" />
        <p className="text-xs font-medium text-foreground">
          Analyzing semantic redundancies...
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Evaluating lexical proximity and synonym clusters across classes.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-xs text-destructive">
        <AlertTriangle className="mb-2 size-6" />
        <p className="font-semibold">Failed to analyze redundancies</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {error.message || "An unexpected error occurred during analysis."}
        </p>
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
        <div className="mb-3 rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
          <GitMerge className="size-6" />
        </div>
        <p className="font-semibold text-foreground">
          No Redundancy Clusters Detected
        </p>
        <p className="mt-1 max-w-sm text-[11px] leading-relaxed">
          Your class taxonomy demonstrates high lexical uniqueness with no
          overlapping synonyms or duplicated concepts identified.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
      {/* Controls Bar */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clusters or classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-md pl-8 text-xs"
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          Showing <strong>{filteredClusters.length}</strong> of{" "}
          <strong>{clusters.length}</strong>
        </span>
      </div>

      {filteredClusters.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
          <p className="font-medium">
            No clusters matching &ldquo;{search}&rdquo;
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSearch("")}
            className="mt-2 text-xs"
          >
            Clear filter
          </Button>
        </div>
      ) : (
        <div
          className={
            isFullscreen
              ? "grid grid-cols-1 gap-3.5 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3"
              : "space-y-3 overflow-y-auto pr-1"
          }
        >
          {filteredClusters.map((cluster, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-border/80"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        {cluster.clusterName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Overlap potential across {cluster.classNames.length}{" "}
                        classes
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 font-mono text-[10px] text-amber-700 dark:text-amber-300"
                  >
                    {Math.round(cluster.similarityScore * 100)}% match
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Member Classes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.classNames.map((name, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="px-2 py-0 text-xs font-medium"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {onSelectClassForRefactor && (
                <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                  <span className="text-[10px] text-muted-foreground">
                    Action: Resolve duplication
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      if (cluster.classIds.length > 0) {
                        onSelectClassForRefactor(cluster.classIds[0])
                      }
                    }}
                    className="h-7 gap-1 px-2.5 text-xs font-medium"
                  >
                    <GitMerge className="size-3" />
                    Refactor Class
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
