"use client"

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type EntityType,
  SUPPORTED_ENTITY_TYPES,
  formatEntityTypeLabel,
} from "./entity-type-tabs-types"

export type { EntityType }
export { SUPPORTED_ENTITY_TYPES, formatEntityTypeLabel }

interface EntityTypeTabsProps {
  activeType: EntityType
  onTypeChange: (type: EntityType) => void
  classCount: number
  relationCount: number
  referenceCount?: number
  datasetCount?: number
  classBrowser: ReactNode
  relationBrowser: ReactNode
  referenceBrowser?: ReactNode
  reasonerBrowser?: ReactNode
  datasetBrowser?: ReactNode
}

export function EntityTypeTabs({
  activeType,
  onTypeChange,
  classCount,
  relationCount,
  referenceCount = 0,
  datasetCount = 0,
  classBrowser,
  relationBrowser,
  referenceBrowser,
  reasonerBrowser,
  datasetBrowser,
}: EntityTypeTabsProps) {
  return (
    <Tabs
      value={activeType}
      onValueChange={(v) => onTypeChange(v as EntityType)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="px-2 pt-2">
        <TabsList className="grid h-8 w-full grid-cols-5 p-0.5">
          <TabsTrigger
            value="classes"
            className="px-0.5 text-[10px]"
            title={`Classes (${classCount})`}
          >
            Classes ({classCount})
          </TabsTrigger>
          <TabsTrigger
            value="relations"
            className="px-0.5 text-[10px]"
            title={`Relations (${relationCount})`}
          >
            Rel ({relationCount})
          </TabsTrigger>
          <TabsTrigger
            value="standards"
            className="px-0.5 text-[10px]"
            title={`Standards (${referenceCount})`}
          >
            Std ({referenceCount})
          </TabsTrigger>
          <TabsTrigger
            value="reasoner"
            className="px-0.5 text-[10px]"
            title="Semantic Reasoner"
          >
            Reasoner
          </TabsTrigger>
          <TabsTrigger
            value="datasets"
            className="px-0.5 text-[10px]"
            title={`Dataset Archive (${datasetCount})`}
          >
            Data ({datasetCount})
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="classes"
        className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {classBrowser}
      </TabsContent>
      <TabsContent
        value="relations"
        className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {relationBrowser}
      </TabsContent>
      {referenceBrowser && (
        <TabsContent
          value="standards"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {referenceBrowser}
        </TabsContent>
      )}
      {reasonerBrowser && (
        <TabsContent
          value="reasoner"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {reasonerBrowser}
        </TabsContent>
      )}
      {datasetBrowser && (
        <TabsContent
          value="datasets"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {datasetBrowser}
        </TabsContent>
      )}
    </Tabs>
  )
}
