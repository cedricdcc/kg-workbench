"use client"

import { useState } from "react"
import { CheckCircle2, ShieldAlert } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  OntologyDefect,
  OntologyDefectReport,
} from "@/features/ontology/utils/linter"
import { DefectCard } from "./defect-card"

export interface OntologyDefectsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: OntologyDefectReport
  onSelectEntity: (id: string, kind: "class" | "relation") => void
  onSuppress: (defectId: string) => void
  onRestore: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
}

export function OntologyDefectsSheet({
  open,
  onOpenChange,
  report,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
}: OntologyDefectsSheetProps) {
  const [activeTab, setActiveTab] = useState<string>("all")

  const errors = report.defects.filter((d) => d.severity === "error")
  const warnings = report.defects.filter((d) => d.severity === "warning")
  const infoItems = report.defects.filter((d) => d.severity === "info")
  const suppressed = report.suppressed

  function renderDefectList(items: OntologyDefect[], isSuppressedList = false) {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <CheckCircle2 className="mb-2 size-8 text-emerald-500" />
          <p className="text-xs font-medium text-foreground">
            {isSuppressedList
              ? "No suppressed defects"
              : "No issues in this category"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isSuppressedList
              ? "Dismissed defects will appear here for review."
              : "Your ontology satisfies all quality rules in this view."}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3 overflow-y-auto pr-1">
        {items.map((defect) => (
          <DefectCard
            key={defect.id}
            defect={defect}
            isSuppressed={isSuppressedList}
            onSelectEntity={(id, kind) => {
              onSelectEntity(id, kind)
              onOpenChange(false)
            }}
            onSuppress={onSuppress}
            onRestore={onRestore}
            onQuickFix={onQuickFix}
          />
        ))}
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg p-0"
      >
        <SheetHeader className="border-b px-5 py-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-destructive/10 p-1.5 text-destructive">
              <ShieldAlert className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold">
                Ontology Defect Inspector
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Pre-flight structural validation and OOPS! quality checks.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden px-5 py-3">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="grid w-full shrink-0 grid-cols-5 text-xs">
              <TabsTrigger value="all" className="text-[11px] px-1">
                All ({report.total})
              </TabsTrigger>
              <TabsTrigger
                value="errors"
                className="text-[11px] px-1 text-destructive data-[state=active]:text-destructive"
              >
                Errors ({report.counts.error})
              </TabsTrigger>
              <TabsTrigger
                value="warnings"
                className="text-[11px] px-1 text-amber-600 dark:text-amber-400"
              >
                Warn ({report.counts.warning})
              </TabsTrigger>
              <TabsTrigger value="info" className="text-[11px] px-1">
                Info ({report.counts.info})
              </TabsTrigger>
              <TabsTrigger value="suppressed" className="text-[11px] px-1">
                Muted ({suppressed.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="all" className="m-0 h-full">
                {renderDefectList(report.defects)}
              </TabsContent>
              <TabsContent value="errors" className="m-0 h-full">
                {renderDefectList(errors)}
              </TabsContent>
              <TabsContent value="warnings" className="m-0 h-full">
                {renderDefectList(warnings)}
              </TabsContent>
              <TabsContent value="info" className="m-0 h-full">
                {renderDefectList(infoItems)}
              </TabsContent>
              <TabsContent value="suppressed" className="m-0 h-full">
                {renderDefectList(suppressed, true)}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
