"use client"

import { Activity, FileLock2, GitBranch, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { OhiLockfileV2 } from "@/features/ontology/server/linkml/types"

import type { KnowledgeGraphExportBundle } from "../../server/actions/build-kg-bundle"

interface ProvoLineagePreviewProps {
  bundle: KnowledgeGraphExportBundle
}

function parseLockfile(rawJson: string): OhiLockfileV2 | null {
  try {
    const parsed = JSON.parse(rawJson) as OhiLockfileV2
    if (parsed && Array.isArray(parsed.files)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function ProvoLineagePreview({ bundle }: ProvoLineagePreviewProps) {
  const lockfile = parseLockfile(bundle.files.ohi_lock_json)
  const lockedFiles = lockfile?.files ?? []

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <GitBranch className="size-3.5 text-muted-foreground" />
          <span>W3C PROV-O Lineage</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[11px]">
            {bundle.stats.entitiesCount} entities
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {bundle.stats.factsCount} facts
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {bundle.stats.lockedPackagesCount} locked packages
          </Badge>
        </div>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border bg-background p-2">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <Activity className="size-3.5 text-muted-foreground" />
            <span>prov:Activity (Extraction Run)</span>
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {bundle.runId ? `kg:run/${bundle.runId}` : "No extraction run recorded"}
          </p>
        </div>

        <div className="rounded border bg-background p-2">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-3.5 text-muted-foreground" />
            <span>prov:Entity (Ontology Schema SHA-256)</span>
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {bundle.ontologySha256 ?? "No ontology SHA-256"}
          </p>
        </div>
      </div>

      {lockedFiles.length > 0 ? (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <FileLock2 className="size-3" />
            <span>prov:used → Locked OHI Packages (ohi.lock.json)</span>
          </div>
          <div className="max-h-24 space-y-1 overflow-y-auto pr-1">
            {lockedFiles.map((file) => (
              <div
                key={`${file.package_path}-${file.sha256}`}
                className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-[11px]"
              >
                <span className="truncate font-medium">
                  {file.package_path}
                </span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  sha256:{file.sha256.slice(0, 12)}…
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
