"use client"

import {
  Activity,
  BookOpen,
  GitMerge,
  Layers,
  Link2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { runFullOntologyAnalysis } from "@/features/ontology/server/actions/ontology-analysis"

import { RedundancyClustersTab } from "./redundancy-clusters-tab"
import { ClassAlignmentMatrixTab } from "./class-alignment-matrix-tab"
import { RecommendedVocabulariesTab } from "./recommended-vocabularies-tab"

interface OntologyAnalysisReportDialogProps {
  ontologyId: string
  ontologyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectClassForRefactor?: (classId: string) => void
  onOpenVocabularies?: () => void
}

export function OntologyAnalysisReportDialog({
  ontologyId,
  ontologyName,
  open,
  onOpenChange,
  onSelectClassForRefactor,
  onOpenVocabularies,
}: OntologyAnalysisReportDialogProps) {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["ontology-analysis", ontologyId],
    queryFn: () => runFullOntologyAnalysis(ontologyId),
    enabled: open,
  })

  function handleRefresh() {
    refetch()
  }

  function getScoreColor(score: number) {
    if (score >= 80)
      return {
        badge:
          "text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
        label: "Good / Healthy",
        dot: "bg-emerald-500",
      }
    if (score >= 50)
      return {
        badge:
          "text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10",
        label: "Attention Recommended",
        dot: "bg-amber-500",
      }
    return {
      badge: "text-red-700 dark:text-red-300 border-red-500/30 bg-red-500/10",
      label: "Needs Improvement",
      dot: "bg-red-500",
    }
  }

  const scoreInfo = data ? getScoreColor(data.healthScore) : null
  const coveragePercent = data
    ? Math.round((data.classAlignments.length / (data.totalClasses || 1)) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 z-50 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-background p-0 shadow-none ring-0 duration-100 sm:h-dvh sm:w-screen sm:max-w-none"
      >
        {/* Header Toolbar */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-muted/20 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <DialogTitle className="text-base font-semibold">
                  Ontology Quality &amp; Health Analysis
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-background font-mono text-xs"
                >
                  {ontologyName}
                </Badge>
                {data && (
                  <Badge
                    variant="outline"
                    className={`gap-1.5 text-xs font-medium ${scoreInfo?.badge}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${scoreInfo?.dot}`}
                    />
                    {data.healthScore}% — {scoreInfo?.label}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Full-spectrum structural health, semantic collision diagnostics,
                and standard vocabulary alignment report.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading || isRefetching}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isLoading || isRefetching ? "animate-spin" : ""
                }`}
              />
              Rerun Analysis
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {isLoading && !data ? (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-muted-foreground">
            <Activity className="mb-3 h-10 w-10 animate-pulse text-primary" />
            <p className="text-sm font-medium text-foreground">
              Running deep ontology analysis &amp; standard alignment scans...
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Evaluating class taxonomies, synonym collisions, and standard
              vocabulary coverage.
            </p>
          </div>
        ) : data ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top KPI Metric Strip */}
            <div className="grid shrink-0 grid-cols-2 gap-4 border-b bg-muted/10 px-6 py-3.5 md:grid-cols-4">
              <div className="flex items-center gap-3.5 rounded-xl border bg-card p-3 shadow-xs">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-lg font-bold ${scoreInfo?.badge}`}
                >
                  {data.healthScore}%
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Health Score
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {scoreInfo?.label}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-xl border bg-card p-3 shadow-xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                  {data.totalClasses}
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Total Classes
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active in local taxonomy
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-xl border bg-card p-3 shadow-xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-lg font-bold text-sky-600 dark:text-sky-400">
                  {data.classAlignments.length}
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Standards Aligned
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {coveragePercent}% standards coverage
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-xl border bg-card p-3 shadow-xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-lg font-bold text-amber-600 dark:text-amber-400">
                  {data.redundancyClusters.length}
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Redundancy Warnings
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Merge candidates detected
                  </div>
                </div>
              </div>
            </div>

            {/* Main 2-Column Split Workspace */}
            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
              {/* Left Column: Diagnostics & Overview */}
              <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-r bg-muted/5 p-6 lg:w-[38%] xl:w-[34%]">
                {/* Executive Summary Card */}
                <div className="space-y-2.5 rounded-xl border bg-card p-4.5 shadow-xs">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Executive Summary
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This ontology defines{" "}
                    <strong>{data.totalClasses} classes</strong>.{" "}
                    {data.classAlignments.length > 0 ? (
                      <>
                        <strong>
                          {data.classAlignments.length} classes (
                          {coveragePercent}%)
                        </strong>{" "}
                        correlate with recognized industry standards (e.g.,
                        SOSA, Schema.org).
                      </>
                    ) : (
                      "No classes are currently aligned with installed external standards."
                    )}
                    {data.redundancyClusters.length > 0 && (
                      <>
                        {" "}
                        We detected{" "}
                        <strong>
                          {data.redundancyClusters.length} redundancy cluster(s)
                        </strong>{" "}
                        representing potential semantic duplication.
                      </>
                    )}
                  </p>
                </div>

                {/* Structured Diagnostic Breakdown */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Taxonomy Diagnostic Checks
                  </h3>

                  {/* Diagnostic 1: Vocabulary Reuse */}
                  <div className="space-y-2 rounded-xl border bg-card p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-sky-500" />
                        <span className="text-xs font-semibold text-foreground">
                          Standard Vocabulary Reuse
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          coveragePercent >= 50
                            ? "border-emerald-500/30 text-[10px] text-emerald-600"
                            : "border-amber-500/30 text-[10px] text-amber-600"
                        }
                      >
                        {coveragePercent >= 50 ? "Healthy" : "Low Coverage"}
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {coveragePercent >= 50
                        ? "Strong alignment with standard reference ontologies enhances data interoperability and FAIR compliance."
                        : "Low standard vocabulary reuse reduces interoperability. Consider importing standard ontologies like Schema.org or SOSA."}
                    </p>
                  </div>

                  {/* Diagnostic 2: Semantic Redundancy */}
                  <div className="space-y-2 rounded-xl border bg-card p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-semibold text-foreground">
                          Lexical Uniqueness
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          data.redundancyClusters.length === 0
                            ? "border-emerald-500/30 text-[10px] text-emerald-600"
                            : "border-amber-500/30 text-[10px] text-amber-600"
                        }
                      >
                        {data.redundancyClusters.length === 0
                          ? "Clean"
                          : `${data.redundancyClusters.length} Overlaps`}
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {data.redundancyClusters.length === 0
                        ? "No conflicting or duplicate class names detected."
                        : "Detected classes with overlapping labels or synonyms. Use the Refactor Studio on the right to merge them."}
                    </p>
                  </div>

                  {/* Diagnostic 3: Hierarchy Structure */}
                  <div className="space-y-2 rounded-xl border bg-card p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-semibold text-foreground">
                          Structural Hierarchy &amp; OWL
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-[10px] text-emerald-600"
                      >
                        Acyclic
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Subclass hierarchy is validated against cycles and
                      supports multi-inheritance attribute propagation.
                    </p>
                  </div>
                </div>

                {/* Top Vocabulary Recommendation Card */}
                {data.recommendedVocabularies.length > 0 && (
                  <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-sky-800 dark:text-sky-300">
                        <BookOpen className="h-4 w-4" />
                        <span>Recommended Standard Import</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-background text-[10px]"
                      >
                        {data.recommendedVocabularies[0].suggestedSource.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Importing{" "}
                      <strong>{data.recommendedVocabularies[0].name}</strong> (
                      {data.recommendedVocabularies[0].prefix}) would
                      standardize{" "}
                      <strong>
                        {data.recommendedVocabularies[0].coveredClassCount}{" "}
                        classes
                      </strong>{" "}
                      in this ontology.
                    </div>
                    {onOpenVocabularies && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onOpenChange(false)
                          onOpenVocabularies()
                        }}
                        className="h-7.5 w-full text-xs font-medium"
                      >
                        Explore in Reference Vocabularies
                      </Button>
                    )}
                  </div>
                )}
              </aside>

              {/* Right Column: Deep Interactive Analysis Workspace */}
              <main className="flex flex-1 flex-col overflow-hidden p-6">
                <Tabs
                  defaultValue="redundancies"
                  className="flex flex-1 flex-col overflow-hidden"
                >
                  <TabsList className="grid w-full shrink-0 grid-cols-3">
                    <TabsTrigger
                      value="redundancies"
                      className="gap-1.5 text-xs"
                    >
                      <GitMerge className="h-3.5 w-3.5" />
                      Redundancies &amp; Merges (
                      {data.redundancyClusters.length})
                    </TabsTrigger>
                    <TabsTrigger value="alignments" className="gap-1.5 text-xs">
                      <Link2 className="h-3.5 w-3.5" />
                      Standards Alignment Matrix ({data.classAlignments.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="recommendations"
                      className="gap-1.5 text-xs"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Vocabulary Gap Analysis (
                      {data.recommendedVocabularies.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="redundancies"
                    className="mt-4 flex h-full flex-1 flex-col overflow-hidden"
                  >
                    <RedundancyClustersTab
                      clusters={data.redundancyClusters}
                      onSelectClassForRefactor={(id) => {
                        onOpenChange(false)
                        onSelectClassForRefactor?.(id)
                      }}
                    />
                  </TabsContent>

                  <TabsContent
                    value="alignments"
                    className="mt-4 flex h-full flex-1 flex-col overflow-hidden"
                  >
                    <ClassAlignmentMatrixTab
                      alignments={data.classAlignments}
                      totalClasses={data.totalClasses}
                    />
                  </TabsContent>

                  <TabsContent
                    value="recommendations"
                    className="mt-4 flex h-full flex-1 flex-col overflow-hidden"
                  >
                    <RecommendedVocabulariesTab
                      vocabularies={data.recommendedVocabularies}
                      onOpenVocabularies={() => {
                        onOpenChange(false)
                        onOpenVocabularies?.()
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </main>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
