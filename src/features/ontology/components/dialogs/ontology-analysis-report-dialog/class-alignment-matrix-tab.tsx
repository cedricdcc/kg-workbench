"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Link2, Search, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClassAlignment } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

interface ClassAlignmentMatrixTabProps {
  alignments: ClassAlignment[]
  totalClasses: number
  onOpenExamplePreview?: (alignment: ClassAlignment) => void
}

export function ClassAlignmentMatrixTab({
  alignments,
  totalClasses,
  onOpenExamplePreview,
}: ClassAlignmentMatrixTabProps) {
  const [search, setSearch] = useState("")
  const [confidenceFilter, setConfidenceFilter] = useState<
    "all" | "high" | "moderate"
  >("all")

  const filteredAlignments = useMemo(() => {
    return alignments.filter((a) => {
      const isHigh = a.similarity >= 0.9
      if (confidenceFilter === "high" && !isHigh) return false
      if (confidenceFilter === "moderate" && isHigh) return false

      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return (
        a.className.toLowerCase().includes(q) ||
        a.candidateCurie.toLowerCase().includes(q) ||
        a.candidateLabel.toLowerCase().includes(q)
      )
    })
  }, [alignments, search, confidenceFilter])

  const coveragePercent = Math.round(
    (alignments.length / (totalClasses || 1)) * 100
  )

  if (alignments.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
          <Link2 className="h-6 w-6" />
        </div>
        <p className="font-semibold text-foreground">
          No Standard Alignments Mapped Yet
        </p>
        <p className="mt-1 max-w-md text-xs leading-relaxed">
          Import reference vocabularies (e.g. SOSA, Schema.org, QUDT) to
          automatically map your local classes to established standards.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Controls & Summary Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search local class or standard term..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-md pl-8 text-xs"
            />
          </div>

          {/* Confidence Filter buttons */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setConfidenceFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                confidenceFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({alignments.length})
            </button>
            <button
              type="button"
              onClick={() => setConfidenceFilter("high")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                confidenceFilter === "high"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              High Confidence (
              {alignments.filter((a) => a.similarity >= 0.9).length})
            </button>
            <button
              type="button"
              onClick={() => setConfidenceFilter("moderate")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                confidenceFilter === "moderate"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Moderate ({alignments.filter((a) => a.similarity < 0.9).length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {coveragePercent}% Overall Coverage ({alignments.length}/
            {totalClasses})
          </Badge>
        </div>
      </div>

      {/* Table Container */}
      {filteredAlignments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium">
            No alignments match the current criteria
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("")
              setConfidenceFilter("all")
            }}
            className="mt-2 text-xs"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/40">
              <TableRow>
                <TableHead className="w-[28%] font-semibold">
                  Local Ontology Class
                </TableHead>
                <TableHead className="w-[32%] font-semibold">
                  Standard Vocabulary Match
                </TableHead>
                <TableHead className="w-[18%] font-semibold">
                  Semantic Match Score
                </TableHead>
                <TableHead className="w-[22%] text-right font-semibold">
                  Confidence &amp; Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlignments.map((a, i) => {
                const isHigh = a.similarity >= 0.9
                const scorePercent = Math.round(a.similarity * 100)
                return (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {a.className}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                          {a.candidateCurie}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          ({a.candidateLabel})
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${
                              isHigh ? "bg-emerald-500" : "bg-sky-500"
                            }`}
                            style={{ width: `${scorePercent}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-medium text-muted-foreground">
                          {scorePercent}%
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge
                          variant={isHigh ? "default" : "secondary"}
                          className={`gap-1 text-[11px] font-medium ${
                            isHigh
                              ? "border-emerald-500/20 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                              : ""
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {isHigh ? "High" : "Moderate"}
                        </Badge>
                        {onOpenExamplePreview && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenExamplePreview(a)}
                            className="h-7 gap-1 text-xs font-medium hover:border-primary hover:text-primary"
                          >
                            <Sparkles className="h-3 w-3 text-primary" />
                            Refactor / Adopt
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
