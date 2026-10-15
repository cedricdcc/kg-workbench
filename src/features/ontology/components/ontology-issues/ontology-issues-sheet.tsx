"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  GitMerge,
  Layers,
  Maximize2,
  Minimize2,
  ShieldAlert,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import type { OntologyIssuesSheetProps, OntologyIssuesTab } from "./types"
import { StructuralDefectsTab } from "./structural-defects-tab"
import { RedundanciesTab } from "./redundancies-tab"
import { StandardsTab } from "./standards-tab"

export function OntologyIssuesSheet({
  open,
  onOpenChange,
  report,
  redundancyClusters = [],
  recommendedVocabularies = [],
  isLoadingAnalysis = false,
  analysisError = null,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
  onImportVocabulary,
  importingPrefix,
  onOpenVocabularies,
  onSelectClassForRefactor,
  defaultFullscreen = true,
}: OntologyIssuesSheetProps) {
  const [activeTab, setActiveTab] = useState<OntologyIssuesTab>("defects")
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen)

  const errorCount = report.counts.error
  const warningCount = report.counts.warning
  const redundancyCount = redundancyClusters.length
  const standardsCount = recommendedVocabularies.length
  const isClean =
    errorCount === 0 && warningCount === 0 && redundancyCount === 0

  // Derive unique OOPS! pitfalls detected
  const uniqueOopsPitfalls = useMemo(() => {
    const ids = report.defects
      .map((d) => d.oopsPitfallId)
      .filter((id): id is string => Boolean(id))
    return Array.from(new Set(ids))
  }, [report.defects])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "flex flex-col p-0 transition-all duration-200",
          isFullscreen
            ? "fixed inset-0 z-50 h-screen w-screen max-w-none rounded-none border-none bg-background sm:max-w-none md:max-w-none"
            : "w-full sm:max-w-xl md:max-w-2xl"
        )}
      >
        {/* Main Header */}
        <SheetHeader className="border-b bg-muted/10 px-6 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2 text-destructive shadow-2xs">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-base font-semibold">
                    Ontology Quality &amp; Issues
                  </SheetTitle>
                  {isClean ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3" />
                      Clean
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {errorCount > 0 && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                        >
                          <AlertCircle className="size-3" />
                          {errorCount} {errorCount === 1 ? "Error" : "Errors"}
                        </Badge>
                      )}
                      {warningCount > 0 && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                        >
                          <AlertTriangle className="size-3" />
                          {warningCount}{" "}
                          {warningCount === 1 ? "Warning" : "Warnings"}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
                  Structural integrity, semantic duplication, and standard
                  alignment workbench.
                </SheetDescription>
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsFullscreen((prev) => !prev)}
                title={
                  isFullscreen
                    ? "Collapse to side panel"
                    : "Maximize to full screen"
                }
                aria-label={
                  isFullscreen
                    ? "Collapse to side panel"
                    : "Maximize to full screen"
                }
              >
                {isFullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
                title="Close"
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Top KPI Metrics Strip (Full-Screen Enhancement) */}
        {isFullscreen && (
          <div className="grid shrink-0 grid-cols-2 gap-3 border-b bg-muted/20 px-6 py-3 md:grid-cols-4">
            {/* KPI 1: Structural Defects */}
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-2xs">
              <div
                className={cn(
                  "rounded-md p-2",
                  isClean
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : errorCount > 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {isClean ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Structural Defects
                </p>
                <p className="text-base font-bold text-foreground">
                  {report.total}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {errorCount} errors &bull; {warningCount} warnings
                </p>
              </div>
            </div>

            {/* KPI 2: OOPS! Pitfalls */}
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-2xs">
              <div className="rounded-md bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                <Layers className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  OOPS! Rules
                </p>
                <p className="text-base font-bold text-foreground">
                  {uniqueOopsPitfalls.length}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {uniqueOopsPitfalls.length > 0
                    ? uniqueOopsPitfalls.join(", ")
                    : "All 6 rules compliant"}
                </p>
              </div>
            </div>

            {/* KPI 3: Semantic Redundancies */}
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-2xs">
              <div className="rounded-md bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                <GitMerge className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Redundancies
                </p>
                <p className="text-base font-bold text-foreground">
                  {redundancyCount}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {redundancyCount > 0
                    ? `${redundancyCount} potential concept clusters`
                    : "Unique class names"}
                </p>
              </div>
            </div>

            {/* KPI 4: Standard Vocabularies */}
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-2xs">
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <BookOpen className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Standards
                </p>
                <p className="text-base font-bold text-foreground">
                  {standardsCount}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {standardsCount > 0
                    ? "OLS4 / LOV recommendations"
                    : "No missing standards"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as OntologyIssuesTab)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="shrink-0 border-b pb-3">
              <TabsList className="grid w-full max-w-md grid-cols-3 text-xs">
                <TabsTrigger value="defects" className="px-2 text-xs">
                  Structural Defects ({report.total})
                </TabsTrigger>
                <TabsTrigger value="redundancies" className="px-2 text-xs">
                  Redundancies ({redundancyCount})
                </TabsTrigger>
                <TabsTrigger value="standards" className="px-2 text-xs">
                  Standards ({standardsCount})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-3 flex-1 overflow-hidden">
              <TabsContent value="defects" className="m-0 h-full">
                <StructuralDefectsTab
                  report={report}
                  isFullscreen={isFullscreen}
                  onSelectEntity={(id, kind) => {
                    onSelectEntity(id, kind)
                    onOpenChange(false)
                  }}
                  onSuppress={onSuppress}
                  onRestore={onRestore}
                  onQuickFix={onQuickFix}
                />
              </TabsContent>

              <TabsContent value="redundancies" className="m-0 h-full">
                <RedundanciesTab
                  clusters={redundancyClusters}
                  isLoading={isLoadingAnalysis}
                  error={analysisError}
                  isFullscreen={isFullscreen}
                  onSelectClassForRefactor={(classId) => {
                    if (onSelectClassForRefactor) {
                      onSelectClassForRefactor(classId)
                    } else {
                      onSelectEntity(classId, "class")
                    }
                    onOpenChange(false)
                  }}
                />
              </TabsContent>

              <TabsContent value="standards" className="m-0 h-full">
                <StandardsTab
                  vocabularies={recommendedVocabularies}
                  isLoading={isLoadingAnalysis}
                  error={analysisError}
                  isFullscreen={isFullscreen}
                  onImportVocabulary={onImportVocabulary}
                  importingPrefix={importingPrefix}
                  onOpenVocabularies={() => {
                    onOpenVocabularies?.()
                    onOpenChange(false)
                  }}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
