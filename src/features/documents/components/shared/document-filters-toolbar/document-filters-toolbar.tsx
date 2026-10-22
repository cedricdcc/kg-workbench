"use client"

import { useEffect, useRef, useState } from "react"

import { DocumentFiltersToolbarCompact } from "./document-filters-toolbar-compact"
import { DocumentFiltersToolbarExpanded } from "./document-filters-toolbar-expanded"
import { useDocumentFilterData } from "./hooks/use-document-filter-data"

export function DocumentFiltersToolbar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const previousExpandableFilterStateRef = useRef<readonly boolean[] | null>(
    null
  )
  const filterData = useDocumentFilterData()
  const { expandableFilterState } = filterData

  useEffect(() => {
    const previousExpandableFilterState =
      previousExpandableFilterStateRef.current

    if (previousExpandableFilterState && !isExpanded) {
      const hasNewExpandedRowFilter = expandableFilterState.some(
        (isActive, index) => !previousExpandableFilterState[index] && isActive
      )

      if (hasNewExpandedRowFilter) {
        const frameId = window.requestAnimationFrame(() => {
          setIsExpanded(true)
        })

        previousExpandableFilterStateRef.current = expandableFilterState
        return () => window.cancelAnimationFrame(frameId)
      }
    }

    previousExpandableFilterStateRef.current = expandableFilterState
  }, [expandableFilterState, isExpanded])

  return (
    <div className="shrink-0 border-b bg-background/95">
      <div className="rounded-xl border border-border/70 bg-gradient-to-r from-background via-background to-muted/20 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <DocumentFiltersToolbarCompact
          filterData={filterData}
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((current) => !current)}
        />
        {isExpanded ? (
          <DocumentFiltersToolbarExpanded filterData={filterData} />
        ) : null}
      </div>
    </div>
  )
}
