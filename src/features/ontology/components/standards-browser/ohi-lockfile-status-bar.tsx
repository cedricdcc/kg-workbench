"use client"

import {
  AlertTriangle,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { OhiLockStatus } from "./types"

interface OhiLockfileStatusBarProps {
  status: OhiLockStatus
  lockedCount: number
  directCount: number
  mismatchCount: number
  isSyncing: boolean
  onSync: () => void
}

export function OhiLockfileStatusBar({
  status,
  lockedCount,
  directCount,
  mismatchCount,
  isSyncing,
  onSync,
}: OhiLockfileStatusBarProps) {
  const transitiveCount = Math.max(0, lockedCount - directCount)

  return (
    <div className="flex flex-col gap-1.5 border-b bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {status === "verified" && (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
            >
              <ShieldCheck className="h-3 w-3" />
              SHA-256 Verified
            </Badge>
          )}
          {status === "drifted" && (
            <Badge
              variant="destructive"
              className="gap-1 px-1.5 py-0 text-[10px] font-medium"
            >
              <ShieldAlert className="h-3 w-3" />
              Drift Detected ({mismatchCount})
            </Badge>
          )}
          {status === "unlocked" && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" />
              Unlocked
            </Badge>
          )}
          {status === "empty" && (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-[10px] font-medium"
            >
              <Lock className="h-3 w-3" />
              No Packages Locked
            </Badge>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={status === "drifted" ? "destructive" : "outline"}
              onClick={onSync}
              disabled={isSyncing || status === "empty"}
              className="h-6 gap-1 px-2 text-[10px]"
            >
              <RefreshCw
                className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing..." : "ohi sync"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Re-lock manifest and verify SHA-256 digests (ohi sync)
          </TooltipContent>
        </Tooltip>
      </div>

      {lockedCount > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">
              {lockedCount}
            </strong>{" "}
            locked
          </span>
          <span>•</span>
          <span>{directCount} direct</span>
          <span>•</span>
          <span>{transitiveCount} transitive</span>
        </div>
      )}
    </div>
  )
}
