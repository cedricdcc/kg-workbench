"use client"

import { Activity, BookOpen, RefreshCw, Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
      return "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    if (score >= 50)
      return "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
    return "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle>Ontology Analysis & Health Report</DialogTitle>
                <DialogDescription>{ontologyName}</DialogDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading || isRefetching}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading || isRefetching ? "animate-spin" : ""}`}
              />
              Rerun
            </Button>
          </div>
        </DialogHeader>

        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity className="mb-2 h-8 w-8 animate-pulse text-primary" />
            <p className="text-sm">
              Running comprehensive ontology analysis...
            </p>
          </div>
        ) : data ? (
          <div className="space-y-4 pt-1">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center ${getScoreColor(
                  data.healthScore
                )}`}
              >
                <span className="text-2xl font-bold">{data.healthScore}%</span>
                <span className="text-[11px] font-medium tracking-wide uppercase">
                  Health Score
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-3 text-center shadow-xs">
                <span className="text-2xl font-bold text-foreground">
                  {data.totalClasses}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Total Classes
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-3 text-center shadow-xs">
                <span className="text-2xl font-bold text-foreground">
                  {data.classAlignments.length}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Standards Aligned
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-3 text-center shadow-xs">
                <span className="text-2xl font-bold text-foreground">
                  {data.redundancyClusters.length}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Redundancy Warnings
                </span>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="redundancies">
                  Redundancies ({data.redundancyClusters.length})
                </TabsTrigger>
                <TabsTrigger value="alignments">
                  Alignments ({data.classAlignments.length})
                </TabsTrigger>
                <TabsTrigger value="recommendations">
                  Imports ({data.recommendedVocabularies.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3 pt-3">
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-xs">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Executive Summary
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    This ontology contains <strong>{data.totalClasses}</strong>{" "}
                    classes.{" "}
                    {data.classAlignments.length > 0 ? (
                      <>
                        <strong>{data.classAlignments.length}</strong> classes
                        match recognized standard vocabularies.
                      </>
                    ) : (
                      "No classes are currently aligned with external reference ontologies."
                    )}
                    {data.redundancyClusters.length > 0 && (
                      <>
                        {" "}
                        We identified{" "}
                        <strong>{data.redundancyClusters.length}</strong>{" "}
                        potential redundancy cluster(s) that could be unified.
                      </>
                    )}
                  </p>
                </div>

                {data.recommendedVocabularies.length > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
                    <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                      <BookOpen className="h-4 w-4" />
                      <span>
                        Recommended import:{" "}
                        <strong>{data.recommendedVocabularies[0].name}</strong>{" "}
                        covers{" "}
                        {data.recommendedVocabularies[0].coveredClassCount} of
                        your classes.
                      </span>
                    </div>
                    {onOpenVocabularies && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onOpenVocabularies}
                        className="h-7 text-xs font-semibold"
                      >
                        Explore
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="redundancies">
                <RedundancyClustersTab
                  clusters={data.redundancyClusters}
                  onSelectClassForRefactor={(id) => {
                    onOpenChange(false)
                    onSelectClassForRefactor?.(id)
                  }}
                />
              </TabsContent>

              <TabsContent value="alignments">
                <ClassAlignmentMatrixTab
                  alignments={data.classAlignments}
                  totalClasses={data.totalClasses}
                />
              </TabsContent>

              <TabsContent value="recommendations">
                <RecommendedVocabulariesTab
                  vocabularies={data.recommendedVocabularies}
                  onOpenVocabularies={() => {
                    onOpenChange(false)
                    onOpenVocabularies?.()
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
