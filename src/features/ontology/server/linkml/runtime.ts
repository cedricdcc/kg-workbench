/**
 * Runtime helper for @neverblink/linkml with environment shims.
 */

import "./process-shim"

import { LinkML } from "@neverblink/linkml"
import type {
  BuildInfo,
  LinkMLApi,
  LoadResult,
  SchemaStats,
  SchemaValidationReport,
  SchemaView,
} from "@neverblink/linkml"

/**
 * Ensures the runtime process shim is active and returns the canonical LinkML engine handle.
 */
export function loadLinkmlRuntime(): LinkMLApi {
  if (typeof globalThis.process === "undefined") {
    ;(globalThis as Record<string, unknown>).process = { cwd: () => "/" }
  } else if (typeof globalThis.process.cwd !== "function") {
    ;(globalThis.process as unknown as { cwd: () => string }).cwd = () => "/"
  }

  return LinkML
}

export { LinkML }
export type {
  BuildInfo,
  LinkMLApi,
  LoadResult,
  SchemaStats,
  SchemaValidationReport,
  SchemaView,
}
