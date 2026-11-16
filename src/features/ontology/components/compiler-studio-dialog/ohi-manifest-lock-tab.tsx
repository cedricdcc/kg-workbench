"use client"

import { Badge } from "@/components/ui/badge"
import { ArtifactCodeViewer } from "./artifact-code-viewer"
import type { OhiLockfileV2 } from "./types"

export interface OhiManifestLockTabProps {
  ohiYaml: string
  ohiLockfile: OhiLockfileV2 | null
}

export function OhiManifestLockTab({
  ohiYaml,
  ohiLockfile,
}: OhiManifestLockTabProps) {
  const lockfileJson = ohiLockfile
    ? JSON.stringify(ohiLockfile, null, 2)
    : ""

  const directCount = ohiLockfile?.selections.length ?? 0
  const lockedFileCount = ohiLockfile?.files.length ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>OHI Dependency Manifest &amp; Cryptographic Lockfile</span>
        {ohiLockfile && (
          <>
            <Badge variant="secondary">
              {directCount} direct {directCount === 1 ? "package" : "packages"}
            </Badge>
            <Badge variant="outline">
              {lockedFileCount} locked{" "}
              {lockedFileCount === 1 ? "artifact" : "artifacts"}
            </Badge>
          </>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <ArtifactCodeViewer
          title="Manifest"
          filename="ohi.yaml"
          mimeType="application/yaml"
          languageLabel="YAML"
          content={ohiYaml}
          emptyMessage="No ohi.yaml manifest configured for this ontology yet."
        />
        <ArtifactCodeViewer
          title="Lockfile"
          filename="ohi.lock.json"
          mimeType="application/json"
          languageLabel="JSON (v2)"
          content={lockfileJson}
          emptyMessage="No ohi.lock.json lockfile generated yet."
        />
      </div>
    </div>
  )
}
