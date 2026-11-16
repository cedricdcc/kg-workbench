"use client"

import {
  GitFork,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { OhiPackageSummary } from "@/features/ontology/server/ohi/builtin-publications"
import type { OhiInstalledPackageItem } from "./types"

type OhiPackageCardProps =
  | {
      variant: "installed"
      pkg: OhiInstalledPackageItem
      isInspected?: boolean
      isMutating?: boolean
      onInspectTree: (packageRef: string) => void
      onSync?: () => void
      onRemove?: (packageRef: string) => void
    }
  | {
      variant: "catalog"
      pkg: OhiPackageSummary
      isInstalled?: boolean
      isInspected?: boolean
      isMutating?: boolean
      onInspectTree: (packageRef: string) => void
      onAdd: (packageRef: string) => void
    }

function truncateSha(sha256: string): string {
  if (!sha256) return ""
  return `${sha256.slice(0, 8)}…${sha256.slice(-6)}`
}

export function OhiPackageCard(props: OhiPackageCardProps) {
  if (props.variant === "installed") {
    const {
      pkg,
      isInspected = false,
      isMutating = false,
      onInspectTree,
      onSync,
      onRemove,
    } = props

    return (
      <div
        className={`rounded-md border p-2.5 transition-colors ${
          isInspected ? "border-primary bg-primary/5" : "bg-card"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono text-xs font-semibold">
                {pkg.packageRef}
              </span>
              <Badge
                variant={pkg.isDirect ? "default" : "secondary"}
                className="h-4 px-1 text-[9px]"
              >
                {pkg.isDirect ? "Direct" : "Transitive"}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="h-4 px-1 font-mono text-[9px]"
              >
                {pkg.format}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={pkg.verified ? "outline" : "destructive"}
                    className={`h-4 gap-0.5 px-1 font-mono text-[9px] ${
                      pkg.verified
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : ""
                    }`}
                  >
                    {pkg.verified ? (
                      <ShieldCheck className="h-2.5 w-2.5" />
                    ) : (
                      <ShieldAlert className="h-2.5 w-2.5" />
                    )}
                    {pkg.verified
                      ? truncateSha(pkg.sha256)
                      : pkg.mismatchReason === "missing"
                        ? "Missing"
                        : "Tampered"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-[10px]">
                  sha256:{pkg.sha256}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onInspectTree(pkg.packageRef)}
                  aria-label={`Inspect dependency tree for ${pkg.packageRef}`}
                >
                  <GitFork className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Inspect dependencies</TooltipContent>
            </Tooltip>

            {!pkg.verified && onSync && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-amber-600"
                    disabled={isMutating}
                    onClick={onSync}
                    aria-label={`Re-sync ${pkg.packageRef}`}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Re-sync artifact</TooltipContent>
              </Tooltip>
            )}

            {pkg.isDirect && onRemove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    disabled={isMutating}
                    onClick={() => onRemove(pkg.packageRef)}
                    aria-label={`Remove ${pkg.packageRef}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Remove from ohi.yaml
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    )
  }

  const {
    pkg,
    isInstalled = false,
    isInspected = false,
    isMutating = false,
    onInspectTree,
    onAdd,
  } = props

  const versionedRef = pkg.package_ref.includes("@")
    ? pkg.package_ref
    : pkg.latest_version
      ? `${pkg.package_ref}@${pkg.latest_version}`
      : pkg.package_ref

  return (
    <div
      className={`rounded-md border p-2.5 transition-colors ${
        isInspected ? "border-primary bg-primary/5" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-xs font-semibold">
              {versionedRef}
            </span>
            {isInstalled && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                Locked
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-foreground">
            {pkg.title}
          </p>
          {pkg.description && (
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
              {pkg.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onInspectTree(versionedRef)}
                aria-label={`Inspect dependency tree for ${versionedRef}`}
              >
                <GitFork className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Preview dependency tree
            </TooltipContent>
          </Tooltip>

          <Button
            type="button"
            size="sm"
            variant={isInstalled ? "outline" : "default"}
            disabled={isMutating}
            onClick={() => onAdd(versionedRef)}
            className="h-7 gap-1 px-2 text-[10px]"
          >
            {isMutating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {isInstalled ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  )
}
