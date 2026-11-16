"use client"

import { GitFork, Loader2, Lock, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OhiDependencyNode, OhiPackageTreePreview } from "./types"

interface OhiDependencyTreePreviewProps {
  preview: OhiPackageTreePreview | null
  isLoading: boolean
  isInstalled: boolean
  isAdding: boolean
  onAdd: (packageRef: string) => void
  onClose: () => void
}

function DependencyNodeRow({ node }: { node: OhiDependencyNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[11px] font-medium">
            {node.packageRef}
          </span>
          <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
            {node.format}
          </Badge>
        </div>
        <div className="truncate font-mono text-[9px] text-muted-foreground">
          sha256:{node.sha256.slice(0, 12)}…
        </div>
      </div>
    </div>
  )
}

export function OhiDependencyTreePreview({
  preview,
  isLoading,
  isInstalled,
  isAdding,
  onAdd,
  onClose,
}: OhiDependencyTreePreviewProps) {
  if (!isLoading && !preview) {
    return null
  }

  return (
    <div className="border-b bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GitFork className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold">
            {preview ? preview.publication.package_ref : "Resolving tree..."}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5"
          onClick={onClose}
          aria-label="Close dependency tree preview"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Resolving transitive dependencies...
        </div>
      ) : (
        preview && (
          <div className="mt-2 space-y-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Direct (selections[])
                </span>
                <Badge variant="default" className="h-4 px-1 text-[9px]">
                  {preview.directPackages.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {preview.directPackages.map((node) => (
                  <DependencyNodeRow
                    key={`direct-${node.packageRef}`}
                    node={node}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Transitive (files[])
                </span>
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {preview.transitivePackages.length}
                </Badge>
              </div>
              {preview.transitivePackages.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  No transitive dependencies.
                </p>
              ) : (
                <div className="space-y-1">
                  {preview.transitivePackages.map((node) => (
                    <DependencyNodeRow
                      key={`transitive-${node.packageRef}`}
                      node={node}
                    />
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              className="h-7 w-full gap-1.5 text-[11px]"
              disabled={isAdding}
              onClick={() => onAdd(preview.publication.package_ref)}
            >
              {isAdding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isInstalled ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {isInstalled
                ? "Re-lock Package & Transitives"
                : `Add & Lock (${1 + preview.transitivePackages.length} files)`}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
