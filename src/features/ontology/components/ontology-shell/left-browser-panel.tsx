"use client"

import type { ReactNode } from "react"

import { EntityTypeTabs, type EntityType } from "../entity-type-tabs"

interface LeftBrowserPanelProps {
  activeType: EntityType
  onTypeChange: (type: EntityType) => void
  classCount: number
  relationCount: number
  referenceCount?: number
  classBrowser: ReactNode
  relationBrowser: ReactNode
  referenceBrowser?: ReactNode
}

export function LeftBrowserPanel({
  activeType,
  onTypeChange,
  classCount,
  relationCount,
  referenceCount = 0,
  classBrowser,
  relationBrowser,
  referenceBrowser,
}: LeftBrowserPanelProps) {
  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r">
      <EntityTypeTabs
        activeType={activeType}
        onTypeChange={onTypeChange}
        classCount={classCount}
        relationCount={relationCount}
        referenceCount={referenceCount}
        classBrowser={classBrowser}
        relationBrowser={relationBrowser}
        referenceBrowser={referenceBrowser}
      />
    </div>
  )
}
