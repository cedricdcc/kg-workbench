"use client"

import { useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  ShieldAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
}: OntologyIssuesSheetProps) {
  const [activeTab, setActiveTab] = useState<OntologyIssuesTab>("defects")

  const errorCount = report.counts.error
  const warningCount = report.counts.warning
  const redundancyCount = redundancyClusters.length
  const standardsCount = recommendedVocabularies.length
  const isClean =
    errorCount === 0 && warningCount === 0 && redundancyCount === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="border-b bg-muted/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold">
                  Ontology Quality &amp; Issues
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
                  Structural integrity, semantic duplication, and standard
                  alignment.
                </SheetDescription>
              </div>
            </div>

            {/* Concrete Header Summary Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {isClean ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="size-3" />
                  Clean
                </Badge>
              ) : (
                <>
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
                  {redundancyCount > 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300"
                    >
                      <GitMerge className="size-3" />
                      {redundancyCount}{" "}
                      {redundancyCount === 1 ? "Redundancy" : "Redundancies"}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden px-5 py-3">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as OntologyIssuesTab)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="grid w-full shrink-0 grid-cols-3 text-xs">
              <TabsTrigger value="defects" className="px-1 text-xs">
                Structural Defects ({report.total})
              </TabsTrigger>
              <TabsTrigger value="redundancies" className="px-1 text-xs">
                Redundancies ({redundancyCount})
              </TabsTrigger>
              <TabsTrigger value="standards" className="px-1 text-xs">
                Standards ({standardsCount})
              </TabsTrigger>
            </TabsList>

            <div className="mt-3 flex-1 overflow-hidden">
              <TabsContent value="defects" className="m-0 h-full">
                <StructuralDefectsTab
                  report={report}
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
