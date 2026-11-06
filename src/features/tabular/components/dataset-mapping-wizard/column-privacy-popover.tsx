"use client"

import { ShieldCheck, ShieldOff } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import type { ColumnPrivacyConfig } from "@/features/tabular/server/services/pii-masker"
import { cn } from "@/lib/utils"

export function getPreviewMaskedValue(
  config: ColumnPrivacyConfig,
  sampleValue?: unknown
): string {
  const rawStr =
    sampleValue !== undefined && sampleValue !== null
      ? String(sampleValue)
      : ""

  if (!config.isMasked || config.maskingStrategy === "none") {
    return rawStr || "(empty)"
  }

  if (config.maskingStrategy === "redact") {
    return "[REDACTED]"
  }

  const prefix = (
    config.detectedCategory ||
    config.columnName.replace(/[^a-zA-Z0-9]/g, "_") ||
    "TOKEN"
  ).toUpperCase()

  return `<${prefix}_1>`
}

export interface ColumnPrivacyFormProps {
  config: ColumnPrivacyConfig
  onChange: (updated: ColumnPrivacyConfig) => void
  sampleValue?: unknown
  className?: string
}

export function ColumnPrivacyForm({
  config,
  onChange,
  sampleValue,
  className,
}: ColumnPrivacyFormProps) {
  const handleToggleMask = (checked: boolean) => {
    if (checked) {
      onChange({
        ...config,
        isMasked: true,
        maskingStrategy:
          config.maskingStrategy === "none" ? "token" : config.maskingStrategy,
      })
    } else {
      onChange({
        ...config,
        isMasked: false,
        maskingStrategy: "none",
      })
    }
  }

  const handleStrategyChange = (strategy: string) => {
    onChange({
      ...config,
      isMasked: true,
      maskingStrategy: strategy as "token" | "redact",
    })
  }

  const preview = getPreviewMaskedValue(config, sampleValue)

  return (
    <div className={cn("space-y-3 text-xs", className)}>
      <div className="flex items-center justify-between border-b pb-2">
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">
            {config.columnName}
          </div>
          {config.detectedCategory ? (
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Auto-detected as: {config.detectedCategory}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">
              Custom masking rule
            </div>
          )}
        </div>
      </div>

      {/* Mask toggle switch */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium cursor-pointer">
            Mask column data
          </Label>
          <p className="text-[10px] text-muted-foreground">
            Obfuscate values before sending to LLM
          </p>
        </div>
        <Switch
          checked={config.isMasked}
          onCheckedChange={handleToggleMask}
          aria-label={`Mask ${config.columnName}`}
        />
      </div>

      {/* Strategy Selector (visible when isMasked is true) */}
      {config.isMasked && (
        <div className="space-y-2 pt-1 border-t">
          <Label className="text-[11px] font-semibold text-muted-foreground">
            Masking Strategy
          </Label>
          <RadioGroup
            value={config.maskingStrategy === "none" ? "token" : config.maskingStrategy}
            onValueChange={handleStrategyChange}
            className="gap-2"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="token" id={`token-${config.columnName}`} className="mt-0.5" />
              <Label
                htmlFor={`token-${config.columnName}`}
                className="text-xs font-normal cursor-pointer leading-tight"
              >
                <span className="font-medium">Token Placeholder</span>
                <span className="block text-[10px] text-muted-foreground">
                  Preserves referential structure (e.g. &lt;EMAIL_1&gt;)
                </span>
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="redact" id={`redact-${config.columnName}`} className="mt-0.5" />
              <Label
                htmlFor={`redact-${config.columnName}`}
                className="text-xs font-normal cursor-pointer leading-tight"
              >
                <span className="font-medium">Full Redaction</span>
                <span className="block text-[10px] text-muted-foreground">
                  Replaces entirely with [REDACTED]
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Real-time Preview */}
      <div className="rounded border bg-muted/40 p-2 text-[11px] font-mono space-y-1">
        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
          <span>Sample input:</span>
          <span className="truncate max-w-[140px]" title={sampleValue ? String(sampleValue) : ""}>
            {sampleValue !== undefined && sampleValue !== null && String(sampleValue).length > 0
              ? String(sampleValue)
              : "(empty)"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Sent to AI:</span>
          <span
            className={cn(
              "truncate max-w-[140px] font-semibold",
              config.isMasked
                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                : "text-foreground"
            )}
          >
            {preview}
          </span>
        </div>
      </div>
    </div>
  )
}

export interface ColumnPrivacyPopoverProps {
  config: ColumnPrivacyConfig
  onChange: (updated: ColumnPrivacyConfig) => void
  sampleValue?: unknown
  className?: string
}

export function ColumnPrivacyPopover({
  config,
  onChange,
  sampleValue,
  className,
}: ColumnPrivacyPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:opacity-85 focus:outline-none focus:ring-1 focus:ring-ring",
            config.isMasked
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
              : "border-border bg-background text-muted-foreground hover:bg-muted/50",
            className
          )}
          title={`Privacy settings for ${config.columnName}`}
        >
          {config.isMasked ? (
            <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <ShieldOff className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="truncate max-w-[70px]">
            {config.isMasked
              ? config.detectedCategory || "Masked"
              : "Unmasked"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 shadow-lg">
        <ColumnPrivacyForm
          config={config}
          onChange={onChange}
          sampleValue={sampleValue}
        />
      </PopoverContent>
    </Popover>
  )
}
