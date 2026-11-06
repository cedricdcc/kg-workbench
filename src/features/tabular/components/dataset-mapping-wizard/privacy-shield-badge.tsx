"use client"

import { RotateCcw, Shield, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PrivacyShieldBadgeProps {
  count: number
  onReset?: () => void
  className?: string
}

export function PrivacyShieldBadge({
  count,
  onReset,
  className,
}: PrivacyShieldBadgeProps) {
  const isActive = count > 0

  return (
    <div
      data-slot="privacy-shield-badge"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors",
        isActive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : "border-border bg-muted/30 text-muted-foreground",
        className
      )}
    >
      {isActive ? (
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      ) : (
        <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      <span className="font-medium">
        {isActive ? "Privacy Shield Active" : "Privacy Shield"}
      </span>

      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          isActive
            ? "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count} masked
      </span>

      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onReset}
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-transparent"
          title="Reset masking to auto-detected defaults"
        >
          <RotateCcw className="mr-0.5 h-2.5 w-2.5" />
          Reset
        </Button>
      )}
    </div>
  )
}
