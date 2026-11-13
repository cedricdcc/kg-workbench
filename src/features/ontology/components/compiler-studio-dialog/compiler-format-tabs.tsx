"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArtifactCodeViewer } from "./artifact-code-viewer"
import { OhiManifestLockTab } from "./ohi-manifest-lock-tab"
import { RawLinkmlEditorTab } from "./raw-linkml-editor-tab"
import {
  COMPILER_FORMAT_TABS,
  buildArtifactFilename,
  type CompilerStudioData,
  type CompilerStudioTabId,
} from "./types"

export interface CompilerFormatTabsProps {
  data: CompilerStudioData
  activeTab: CompilerStudioTabId
  onTabChange: (tab: CompilerStudioTabId) => void
  onDataUpdated: (updated: CompilerStudioData) => void
}

function getArtifactContent(
  data: CompilerStudioData,
  tabId: CompilerStudioTabId
): string {
  switch (tabId) {
    case "shacl":
      return data.artifacts.shacl_ttl
    case "rdfs":
      return data.artifacts.rdfs_ttl
    case "owl":
      return data.artifacts.owl_ttl
    case "pydantic":
      return data.artifacts.pydantic_py
    case "json-schema":
      return data.artifacts.json_schema
    case "er-diagram":
      return data.artifacts.er_diagram
    default:
      return ""
  }
}

export function CompilerFormatTabs({
  data,
  activeTab,
  onTabChange,
  onDataUpdated,
}: CompilerFormatTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as CompilerStudioTabId)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        {COMPILER_FORMAT_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="text-xs data-[state=active]:shadow-sm"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="linkml" className="mt-3 min-h-0 flex-1">
        <RawLinkmlEditorTab
          ontologyId={data.ontologyId}
          ontologyName={data.ontologyName}
          initialYaml={data.linkmlYaml}
          onSaved={onDataUpdated}
        />
      </TabsContent>

      {COMPILER_FORMAT_TABS.filter(
        (t) => t.id !== "linkml" && t.id !== "ohi"
      ).map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="mt-3 min-h-0 flex-1"
        >
          <ArtifactCodeViewer
            title={tab.label}
            filename={buildArtifactFilename(
              data.ontologyName,
              tab.filenameSuffix
            )}
            mimeType={tab.mimeType}
            languageLabel={tab.languageLabel}
            content={getArtifactContent(data, tab.id)}
          />
        </TabsContent>
      ))}

      <TabsContent value="ohi" className="mt-3 min-h-0 flex-1">
        <OhiManifestLockTab
          ohiYaml={data.ohiYaml}
          ohiLockfile={data.ohiLockfile}
        />
      </TabsContent>
    </Tabs>
  )
}
