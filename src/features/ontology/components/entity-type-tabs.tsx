"use client"

import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type EntityType = "classes" | "relations" | "standards"

interface EntityTypeTabsProps {
  activeType: EntityType
  onTypeChange: (type: EntityType) => void
  classCount: number
  relationCount: number
  referenceCount?: number
  classBrowser: ReactNode
  relationBrowser: ReactNode
  referenceBrowser?: ReactNode
}

export function EntityTypeTabs({
  activeType,
  onTypeChange,
  classCount,
  relationCount,
  referenceCount = 0,
  classBrowser,
  relationBrowser,
  referenceBrowser,
}: EntityTypeTabsProps) {
  return (
    <Tabs
      value={activeType}
      onValueChange={(v) => onTypeChange(v as EntityType)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-2">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="classes" className="px-1 text-[11px]">
            Classes ({classCount})
          </TabsTrigger>
          <TabsTrigger value="relations" className="px-1 text-[11px]">
            Relations ({relationCount})
          </TabsTrigger>
          <TabsTrigger value="standards" className="px-1 text-[11px]">
            Standards ({referenceCount})
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
    </Tabs>
  )
}
