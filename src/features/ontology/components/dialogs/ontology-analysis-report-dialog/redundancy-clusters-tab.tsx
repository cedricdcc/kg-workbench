"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, GitMerge, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RedundancyCluster } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

interface RedundancyClustersTabProps {
  clusters: RedundancyCluster[]
  onSelectClassForRefactor?: (classId: string) => void
}

export function RedundancyClustersTab({
  clusters,
  onSelectClassForRefactor,
}: RedundancyClustersTabProps) {
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

  if (clusters.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <div className="mb-3 rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
          <GitMerge className="h-6 w-6" />
        </div>
        <p className="font-semibold text-foreground">
          No Redundancy Clusters Detected
        </p>
        <p className="mt-1 max-w-md text-xs leading-relaxed">
          Your class taxonomy demonstrates high lexical uniqueness with no
          overlapping synonyms or duplicated concepts identified.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Controls Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clusters or class names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-md pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Showing <strong>{filteredClusters.length}</strong> of{" "}
            <strong>{clusters.length}</strong> cluster(s)
          </span>
        </div>
      </div>

      {filteredClusters.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
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
        <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
          {filteredClusters.map((cluster, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border bg-card p-4.5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
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
                    className="border-amber-500/30 bg-amber-500/10 font-mono text-xs text-amber-700 dark:text-amber-300"
                  >
                    {Math.round(cluster.similarityScore * 100)}% lexical match
                  </Badge>
                </div>

                {/* Class tags */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Member Classes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.classNames.map((name, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="px-2 py-0.5 text-xs font-medium"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {onSelectClassForRefactor && (
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    Action: Resolve duplication
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() =>
                      onSelectClassForRefactor(cluster.classIds[0])
                    }
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    <GitMerge className="h-3.5 w-3.5" />
                    Refactor / Merge in Studio
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
