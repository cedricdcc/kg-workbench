"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  OntologyDefect,
  OntologyDefectReport,
} from "@/features/ontology/utils/linter"
import { DefectCard } from "./defect-card"
import { DefectDetailInspector } from "./defect-detail-inspector"

export interface StructuralDefectsTabProps {
  report: OntologyDefectReport
  isFullscreen?: boolean
  onSelectEntity: (id: string, kind: "class" | "relation") => void
  onSuppress: (defectId: string) => void
  onRestore: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
}

export function StructuralDefectsTab({
  report,
  isFullscreen = false,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
}: StructuralDefectsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null)

  const errors = useMemo(
    () => report.defects.filter((d) => d.severity === "error"),
    [report.defects]
  )
  const warnings = useMemo(
    () => report.defects.filter((d) => d.severity === "warning"),
    [report.defects]
  )
  const infoItems = useMemo(
    () => report.defects.filter((d) => d.severity === "info"),
    [report.defects]
  )
  const suppressed = report.suppressed

  const currentList = useMemo(() => {
    let baseList = report.defects
    if (activeSubTab === "errors") baseList = errors
    else if (activeSubTab === "warnings") baseList = warnings
    else if (activeSubTab === "info") baseList = infoItems
    else if (activeSubTab === "suppressed") baseList = suppressed

    if (!search.trim()) return baseList
    const q = search.toLowerCase().trim()
    return baseList.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.targetName.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        (d.oopsPitfallId && d.oopsPitfallId.toLowerCase().includes(q))
    )
  }, [
    activeSubTab,
    errors,
    warnings,
    infoItems,
    suppressed,
    report.defects,
    search,
  ])

  // Resolve selected defect
  const selectedDefect = useMemo(() => {
    if (currentList.length === 0) return null
    if (selectedDefectId) {
      const match = currentList.find((d) => d.id === selectedDefectId)
      if (match) return match
    }
    return currentList[0] ?? null
  }, [currentList, selectedDefectId])

  const isCurrentSuppressedList = activeSubTab === "suppressed"

  function renderDefectList(items: OntologyDefect[], isSuppressedList = false) {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <CheckCircle2 className="mb-2 size-8 text-emerald-500" />
          <p className="text-xs font-medium text-foreground">
            {isSuppressedList
              ? "No muted defects"
              : search
                ? `No issues matching "${search}"`
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
      <div className="space-y-2.5 overflow-y-auto pr-1">
        {items.map((defect) => (
          <DefectCard
            key={defect.id}
            defect={defect}
            isSuppressed={isSuppressedList}
            isSelected={isFullscreen && selectedDefect?.id === defect.id}
            onCardClick={
              isFullscreen ? () => setSelectedDefectId(defect.id) : undefined
            }
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
        onValueChange={(val) => {
          setActiveSubTab(val)
          setSelectedDefectId(null)
        }}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-3">
          <TabsList className="grid w-full shrink-0 grid-cols-5 text-xs sm:w-auto">
            <TabsTrigger value="all" className="px-2 text-xs">
              All ({report.total})
            </TabsTrigger>
            <TabsTrigger
              value="errors"
              className="px-2 text-xs text-destructive data-[state=active]:text-destructive"
            >
              Errors ({report.counts.error})
            </TabsTrigger>
            <TabsTrigger
              value="warnings"
              className="px-2 text-xs text-amber-600 dark:text-amber-400"
            >
              Warn ({report.counts.warning})
            </TabsTrigger>
            <TabsTrigger value="info" className="px-2 text-xs">
              Info ({report.counts.info})
            </TabsTrigger>
            <TabsTrigger value="suppressed" className="px-2 text-xs">
              Muted ({suppressed.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by name, issue, or OOPS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-md pl-8 text-xs"
            />
          </div>
        </div>

        {isFullscreen ? (
          /* Master-Detail Fullscreen Layout */
          <div className="mt-3 flex flex-1 gap-5 overflow-hidden">
            {/* Left Column: List of items */}
            <div className="flex w-full flex-col overflow-hidden border-r pr-3 lg:w-5/12 xl:w-4/12">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Showing <strong>{currentList.length}</strong> items
                </span>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderDefectList(currentList, isCurrentSuppressedList)}
              </div>
            </div>

            {/* Right Column: Deep Defect Inspector Workbench */}
            <div className="hidden flex-col overflow-hidden pl-2 lg:flex lg:w-7/12 xl:w-8/12">
              <DefectDetailInspector
                defect={selectedDefect}
                isSuppressed={isCurrentSuppressedList}
                onSelectEntity={onSelectEntity}
                onSuppress={onSuppress}
                onRestore={onRestore}
                onQuickFix={onQuickFix}
              />
            </div>
          </div>
        ) : (
          /* Single Column Drawer Layout */
          <div className="mt-3 flex-1 overflow-y-auto">
            <TabsContent value="all" className="m-0 h-full">
              {renderDefectList(currentList, false)}
            </TabsContent>
            <TabsContent value="errors" className="m-0 h-full">
              {renderDefectList(currentList, false)}
            </TabsContent>
            <TabsContent value="warnings" className="m-0 h-full">
              {renderDefectList(currentList, false)}
            </TabsContent>
            <TabsContent value="info" className="m-0 h-full">
              {renderDefectList(currentList, false)}
            </TabsContent>
            <TabsContent value="suppressed" className="m-0 h-full">
              {renderDefectList(currentList, true)}
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  )
}
