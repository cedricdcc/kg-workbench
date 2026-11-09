import type { TabularProfileResult } from "../../types"

export function formatTypeBadge(inferredKgType: string): {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
} {
  switch (inferredKgType) {
    case "string":
      return { label: "String", variant: "outline" }
    case "number":
      return { label: "Number", variant: "secondary" }
    case "boolean":
      return { label: "Boolean", variant: "default" }
    case "date":
      return { label: "Date / Time", variant: "secondary" }
    default:
      return { label: inferredKgType || "Unknown", variant: "outline" }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function resolveEffectiveProfilerResult(
  externalResult: TabularProfileResult | null | undefined,
  internalResult: TabularProfileResult | null | undefined,
  isDismissed: boolean
): TabularProfileResult | null {
  if (isDismissed) {
    return internalResult ?? null
  }
  // Internal (freshly profiled inside modal) takes precedence over external prop
  return internalResult ?? externalResult ?? null
}
