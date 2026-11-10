"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { KnowledgeContradiction } from "../../types"
import { getContradictionsQuery } from "../../server/queries/get-contradictions"
import { runDriftAnalysisAction } from "../../server/actions/run-drift-analysis"
import { ContradictionCard } from "./contradiction-card"
import { ResolveDialog } from "./resolve-dialog"

export interface ContradictionsTabProps {
  ontologyId: string
  contradictions?: KnowledgeContradiction[]
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
}

type StatusFilter = "all" | "open" | "resolved" | "dismissed"

export function ContradictionsTab({
  ontologyId,
  contradictions: contradictionsProp,
  isLoading: isLoadingProp,
  onRefresh,
  className,
}: ContradictionsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedContradiction, setSelectedContradiction] =
    useState<KnowledgeContradiction | null>(null)
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false)

  // Query when props not explicitly supplied
  const {
    data: fetchedContradictions = [],
    isLoading: isQueryLoading,
    refetch,
  } = useQuery({
    queryKey: ["knowledge-contradictions", ontologyId],
    queryFn: async () => {
      if (!ontologyId) return []
      return await getContradictionsQuery(ontologyId)
    },
    enabled: Boolean(ontologyId) && contradictionsProp === undefined,
  })

  const allContradictions = contradictionsProp ?? fetchedContradictions
  const isLoading = isLoadingProp ?? isQueryLoading

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh()
    } else {
      await refetch()
    }
  }

  const openCount = useMemo(
    () => allContradictions.filter((c) => c.status === "open").length,
    [allContradictions]
  )

  const resolvedCount = useMemo(
    () => allContradictions.filter((c) => c.status === "resolved").length,
    [allContradictions]
  )

  const dismissedCount = useMemo(
    () => allContradictions.filter((c) => c.status === "dismissed").length,
    [allContradictions]
  )

  const filteredContradictions = useMemo(() => {
    return allContradictions.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchEntity = c.entityLabel?.toLowerCase().includes(q)
        const matchRelation = c.relationName?.toLowerCase().includes(q)
        const matchExplanation = c.explanation?.toLowerCase().includes(q)
        if (!matchEntity && !matchRelation && !matchExplanation) {
          return false
        }
      }
      return true
    })
  }, [allContradictions, statusFilter, searchQuery])

  async function handleRunDriftAnalysis() {
    if (!ontologyId || isAnalyzing) return
    setIsAnalyzing(true)
    try {
      await runDriftAnalysisAction(ontologyId)
      toast.success("Drift analysis triggered successfully")
      await handleRefresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to run drift analysis"
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleOpenResolveDialog(contradiction: KnowledgeContradiction) {
    setSelectedContradiction(contradiction)
    setIsResolveDialogOpen(true)
  }

  function handleContradictionResolved() {
    void handleRefresh()
  }

  return (
    <div
      className={cn("mx-auto flex w-full max-w-7xl flex-col gap-4", className)}
      data-testid="contradictions-tab"
    >
      {/* Top Header / Action Bar */}
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold tracking-tight">
              Knowledge Contradictions &amp; Semantic Drift
            </h2>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-normal transition-colors",
                openCount > 0
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              )}
              data-testid="contradictions-count-badge"
            >
              {openCount} {openCount === 1 ? "open conflict" : "open conflicts"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Surface conflicting assertions across documents, extractors, and
            tabular sources, then resolve discrepancies.
          </p>
        </div>

        {/* Trigger Drift Analysis */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRunDriftAnalysis}
            disabled={isAnalyzing || !ontologyId}
            className="gap-1.5 text-xs shadow-xs"
            data-testid="run-drift-analysis-button"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Analyzing Drift...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Run Drift Analysis</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="gap-1.5 px-2.5 text-xs">
              <span>All</span>
              <span className="py-0.2 rounded-full bg-muted-foreground/15 px-1.5 text-[10px]">
                {allContradictions.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="open" className="gap-1.5 px-2.5 text-xs">
              <span>Open</span>
              <span className="py-0.2 rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                {openCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-1.5 px-2.5 text-xs">
              <span>Resolved</span>
              <span className="py-0.2 rounded-full bg-emerald-500/15 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                {resolvedCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="dismissed" className="gap-1.5 px-2.5 text-xs">
              <span>Dismissed</span>
              <span className="py-0.2 rounded-full bg-muted-foreground/15 px-1.5 text-[10px]">
                {dismissedCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entity, relation, explanation..."
            className="h-8 pl-8 text-xs"
            data-testid="contradictions-search-input"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div
          className="flex h-48 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-xs text-muted-foreground"
          data-testid="contradictions-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Scanning knowledge graph for contradictions...</span>
        </div>
      ) : allContradictions.length === 0 ? (
        /* Empty State: 0 total contradictions */
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center"
          data-testid="contradictions-empty-state"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Knowledge Graph is coherent: no conflicting assertions detected.
          </h3>
          <p className="max-w-md text-xs text-muted-foreground">
            All extracted facts, entity relations, and mapped tabular rows are
            harmonious. Click &quot;Run Drift Analysis&quot; anytime to scan for
            newly introduced inconsistencies.
          </p>
        </div>
      ) : filteredContradictions.length === 0 ? (
        /* Empty State: filters returned 0 */
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground"
          data-testid="contradictions-filtered-empty"
        >
          <Filter className="h-5 w-5 text-muted-foreground/60" />
          <p>No conflicting assertions match your current filters.</p>
          {(statusFilter !== "all" || searchQuery.trim()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all")
                setSearchQuery("")
              }}
              className="mt-1 text-xs"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        /* List of Contradiction Cards */
        /* prettier-ignore */
        <div
          className="grid grid-cols-1 xl:grid-cols-2 gap-4"
          data-testid="contradictions-list"
        >
          {filteredContradictions.map((contra) => (
            <ContradictionCard
              key={contra.id}
              contradiction={contra}
              onResolveClick={handleOpenResolveDialog}
            />
          ))}
        </div>
      )}

      {/* Resolution Dialog Modal */}
      <ResolveDialog
        contradiction={selectedContradiction}
        open={isResolveDialogOpen}
        onOpenChange={setIsResolveDialogOpen}
        onResolved={handleContradictionResolved}
      />
    </div>
  )
}
