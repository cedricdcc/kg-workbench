"use client"

import { useState, type ReactNode } from "react"
import { EntityTypeTabs, type EntityType } from "../entity-type-tabs"
import type { StandardsSubView } from "../standards-browser/types"

interface LeftBrowserPanelProps {
  activeType: EntityType
  onTypeChange: (type: EntityType) => void
  classCount: number
  relationCount: number
  referenceCount?: number
  datasetCount?: number
  classBrowser: ReactNode
  relationBrowser: ReactNode
  referenceBrowser?: ReactNode
  standardsBrowser?: ReactNode
  reasonerBrowser?: ReactNode
  datasetBrowser?: ReactNode
}

export function LeftBrowserPanel({
  activeType,
  onTypeChange,
  classCount,
  relationCount,
  referenceCount = 0,
  datasetCount = 0,
  classBrowser,
  relationBrowser,
  referenceBrowser,
  standardsBrowser,
  reasonerBrowser,
  datasetBrowser,
}: LeftBrowserPanelProps) {
  const [standardsSubView, setStandardsSubView] =
    useState<StandardsSubView>("packages")

  const combinedReferenceBrowser =
    standardsBrowser && referenceBrowser ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-2 gap-1 border-b bg-muted/20 p-1.5">
          <button
            type="button"
            onClick={() => setStandardsSubView("packages")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              standardsSubView === "packages"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ohi.dev Packages
          </button>
          <button
            type="button"
            onClick={() => setStandardsSubView("terms")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              standardsSubView === "terms"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Terms
          </button>
        </div>
        {standardsSubView === "packages" ? standardsBrowser : referenceBrowser}
      </div>
    ) : (
      (standardsBrowser ?? referenceBrowser)
    )

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r">
      <EntityTypeTabs
        activeType={activeType}
        onTypeChange={onTypeChange}
        classCount={classCount}
        relationCount={relationCount}
        referenceCount={referenceCount}
        datasetCount={datasetCount}
        classBrowser={classBrowser}
        relationBrowser={relationBrowser}
        referenceBrowser={combinedReferenceBrowser}
        reasonerBrowser={reasonerBrowser}
        datasetBrowser={datasetBrowser}
      />
    </div>
  )
}
