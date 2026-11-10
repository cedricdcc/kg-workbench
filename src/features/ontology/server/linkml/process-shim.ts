if (typeof globalThis.process === "undefined") {
  ;(globalThis as Record<string, unknown>).process = { cwd: () => "/" }
} else if (typeof globalThis.process.cwd !== "function") {
  ;(globalThis.process as unknown as { cwd: () => string }).cwd = () => "/"
}
