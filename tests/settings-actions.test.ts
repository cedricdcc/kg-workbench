import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { test } from "node:test"

const req = createRequire(import.meta.url)
try {
  const serverOnlyPath = req.resolve("server-only")
  req.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as unknown as NodeJS.Module
} catch {
  // Ignore if server-only cannot be resolved
}

import { userApiKeys } from "../src/server/db/schema"
import { validateApiKeyInput } from "../src/features/settings/server/types"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))

test("validateApiKeyInput rejects empty or short keys", () => {
  assert.equal(validateApiKeyInput("").valid, false)
  assert.equal(validateApiKeyInput("   ").valid, false)
  assert.equal(validateApiKeyInput("short").valid, false)
  assert.equal(
    validateApiKeyInput("AIzaSyD-valid-length-gemini-key").valid,
    true
  )
})

test("userApiKeys schema exposes expected columns", () => {
  assert.ok(userApiKeys.id)
  assert.ok(userApiKeys.user_id)
  assert.ok(userApiKeys.provider)
  assert.ok(userApiKeys.encrypted_key)
  assert.ok(userApiKeys.iv)
  assert.ok(userApiKeys.tag)
  assert.ok(userApiKeys.key_hint)
  assert.ok(userApiKeys.created_at)
  assert.ok(userApiKeys.updated_at)
})

test("SettingsShell conforms to 2-column dashboard layout requirements", () => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/features/settings/components/settings-shell/settings-shell.tsx"
  )
  assert.ok(fs.existsSync(shellPath), "settings-shell.tsx must exist")
  const content = fs.readFileSync(shellPath, "utf-8")

  assert.ok(
    content.includes("max-w-7xl"),
    "SettingsShell must use max-w-7xl container"
  )
  assert.ok(
    content.includes("grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"),
    "SettingsShell must render responsive 2-column grid on desktop"
  )
  assert.ok(
    content.includes("ApiKeysSection"),
    "SettingsShell must render ApiKeysSection in column 1"
  )
  assert.ok(
    content.includes("ServicesSection"),
    "SettingsShell must render ServicesSection in column 2"
  )
})

if (!isReactServer) {
  test("SettingsShell renders responsive 2-column dashboard layout markup", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { SettingsShell } =
      await import("../src/features/settings/components/settings-shell/settings-shell")

    const html = renderToStaticMarkup(
      React.createElement(SettingsShell, {
        initialStatuses: [
          {
            provider: "gemini",
            displayName: "Google Gemini",
            hasEnvFallback: true,
            isConfigured: true,
            keyHint: "...1234",
          },
        ],
        initialServices: [
          {
            id: "analyst",
            displayName: "Analyst Worker",
            description: "Evaluates multi-hop reasoning",
            profile: "analyst",
            status: "online",
            capabilities: ["contradiction-detection"],
          },
        ],
      })
    )

    assert.ok(
      html.includes("max-w-7xl"),
      "SettingsShell must use max-w-7xl container"
    )
    assert.ok(
      html.includes("grid-cols-1 lg:grid-cols-2 gap-8"),
      "SettingsShell must render responsive 2-column grid on desktop"
    )
    assert.ok(
      html.includes("AI Services &amp; API Keys") ||
        html.includes("AI Services & API Keys"),
      "SettingsShell must render ApiKeysSection in column 1"
    )
    assert.ok(
      html.includes("Microservice Mesh &amp; Sidecars") ||
        html.includes("Microservice Mesh & Sidecars"),
      "SettingsShell must render ServicesSection in column 2"
    )
  })
}
