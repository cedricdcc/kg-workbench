"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  OntologyDefect,
  OntologyDefectReport,
} from "@/features/ontology/utils/linter"
import { DefectCard } from "./defect-card"

export interface StructuralDefectsTabProps {
  report: OntologyDefectReport
  onSelectEntity: (id: string, kind: "class" | "relation") => void
  onSuppress: (defectId: string) => void
  onRestore: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
}

export function StructuralDefectsTab({
  report,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
}: StructuralDefectsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>("all")

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
              ? "No muted defects"
              : "No issues in this category"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isSuppressedList
              ? "Muted defects will appear here for review."
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
            onSelectEntity={onSelectEntity}
            onSuppress={onSuppress}
            onRestore={onRestore}
            onQuickFix={onQuickFix}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeSubTab}
        onValueChange={setActiveSubTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="grid w-full shrink-0 grid-cols-5 text-xs">
          <TabsTrigger value="all" className="px-1 text-[11px]">
            All ({report.total})
          </TabsTrigger>
          <TabsTrigger
            value="errors"
            className="px-1 text-[11px] text-destructive data-[state=active]:text-destructive"
          >
            Errors ({report.counts.error})
          </TabsTrigger>
          <TabsTrigger
            value="warnings"
            className="px-1 text-[11px] text-amber-600 dark:text-amber-400"
          >
            Warn ({report.counts.warning})
          </TabsTrigger>
          <TabsTrigger value="info" className="px-1 text-[11px]">
            Info ({report.counts.info})
          </TabsTrigger>
          <TabsTrigger value="suppressed" className="px-1 text-[11px]">
            Muted ({suppressed.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 flex-1 overflow-y-auto">
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
  )
}
