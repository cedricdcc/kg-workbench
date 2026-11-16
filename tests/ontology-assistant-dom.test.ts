import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import React from "react"

import type { ProposedChangePlan } from "../src/features/ontology/server/assistant-tools/types"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

if (isChildTest || !isReactServer) {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { QueryClient, QueryClientProvider } =
    await import("@tanstack/react-query")

  test("DetailPanelShell renders Details and Assistant mode toggle when assistantContent is provided", async () => {
    const { DetailPanelShell } =
      await import("../src/features/ontology/components/ontology-shell/detail-panel-shell")

    const html = renderToStaticMarkup(
      React.createElement(
        DetailPanelShell,
        {
          title: "Class: Vessel",
          isVisual: false,
          isCollapsed: false,
          onCollapse: () => {},
          onExpand: () => {},
          activeMode: "assistant",
          onModeChange: () => {},
          assistantContent: React.createElement(
            "div",
            { "data-testid": "assistant-slot" },
            "Assistant Body"
          ),
        },
        React.createElement(
          "div",
          { "data-testid": "details-slot" },
          "Details Body"
        )
      )
    )

    assert.ok(html.includes("Details"), "Must render Details mode button")
    assert.ok(html.includes("Assistant"), "Must render Assistant mode button")
    assert.ok(
      html.includes("Details Body") && html.includes("Assistant Body"),
      "Both details and assistant panels must remain mounted"
    )
    assert.ok(
      html.includes("hidden"),
      "Inactive panel must be hidden via CSS so state survives mode switches"
    )
  })

  test("ProposedChangesCard renders operation summaries, blast-radius warning, and pending action buttons", async () => {
    const { ProposedChangesCard } =
      await import("../src/features/ontology/components/ontology-assistant/proposed-changes-card")

    const plan: ProposedChangePlan = {
      id: "plan-1",
      ontologyId: "ont-1",
      hasDestructiveChanges: true,
      validationErrors: [],
      operations: [
        {
          index: 0,
          tool: "create_class",
          kind: "create",
          summary: "Create class 'Sensor'",
          isDestructive: false,
          args: { name: "Sensor" },
        },
        {
          index: 1,
          tool: "delete_class",
          kind: "delete",
          summary: "Delete class 'LegacyNode'",
          isDestructive: true,
          blastRadiusWarning: "Breaks 2 competency questions",
          args: { classId: "cls-legacy" },
        },
      ],
    }

    const pendingHtml = renderToStaticMarkup(
      React.createElement(ProposedChangesCard, {
        proposal: plan,
        status: "pending",
        isApplying: false,
        onApply: () => {},
        onDiscard: () => {},
      })
    )

    assert.ok(
      pendingHtml.includes("Create class &#x27;Sensor&#x27;") ||
        pendingHtml.includes("Create class 'Sensor'"),
      "Must render non-destructive operation summary"
    )
    assert.ok(
      pendingHtml.includes("Delete class &#x27;LegacyNode&#x27;") ||
        pendingHtml.includes("Delete class 'LegacyNode'"),
      "Must render destructive operation summary"
    )
    assert.ok(
      pendingHtml.includes("Breaks 2 competency questions"),
      "Must render blast-radius warning banner when hasDestructiveChanges is true"
    )
    assert.ok(
      pendingHtml.includes("Apply Changes"),
      "Must render Apply Changes button when pending"
    )
    assert.ok(
      pendingHtml.includes("Discard"),
      "Must render Discard button when pending"
    )

    const appliedHtml = renderToStaticMarkup(
      React.createElement(ProposedChangesCard, {
        proposal: plan,
        status: "applied",
        appliedCount: 2,
        isApplying: false,
        onApply: () => {},
        onDiscard: () => {},
      })
    )

    assert.ok(
      appliedHtml.includes("Applied"),
      "Must render Applied receipt when status is applied"
    )

    const errorHtml = renderToStaticMarkup(
      React.createElement(ProposedChangesCard, {
        proposal: plan,
        status: "pending",
        isApplying: false,
        applyError: "Transaction rolled back: duplicate class name",
        onApply: () => {},
        onDiscard: () => {},
      })
    )

    assert.ok(
      errorHtml.includes("Transaction rolled back: duplicate class name"),
      "Must render inline error banner when applyError is present"
    )
  })

  test("OntologyAssistantPanel renders starter CQ/edit prompt chips and input bar", async () => {
    const { OntologyAssistantPanel } =
      await import("../src/features/ontology/components/ontology-assistant/ontology-assistant-panel")

    const queryClient = new QueryClient()
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(OntologyAssistantPanel, {
          ontologyId: "ont-1",
          ontologyName: "Marine Ontology",
        })
      )
    )

    assert.ok(
      html.includes("Marine Ontology"),
      "Must reference the current ontology name"
    )
    assert.ok(
      html.includes("<textarea") || html.includes("<input"),
      "Must render chat input bar"
    )
    assert.ok(
      html.includes("competency") ||
        html.includes("CQ") ||
        html.includes("Propose"),
      "Must render starter CQ/edit prompt chips"
    )
  })

  test("OntologyHeader source renders Assistant toggle button when onToggleAssistant is passed", () => {
    const headerPath = path.resolve(
      process.cwd(),
      "src/features/ontology/components/ontology-header/ontology-header.tsx"
    )
    const content = fs.readFileSync(headerPath, "utf-8")

    assert.ok(
      content.includes("assistantOpen?:"),
      "OntologyHeaderProps must accept assistantOpen"
    )
    assert.ok(
      content.includes("onToggleAssistant?:"),
      "OntologyHeaderProps must accept onToggleAssistant"
    )
    assert.ok(
      content.includes("Assistant"),
      "OntologyHeader must render Assistant button label"
    )
  })

  test("OntologyShell wires OntologyAssistantPanel and fingerprint live sync", () => {
    const shellPath = path.resolve(
      process.cwd(),
      "src/features/ontology/components/ontology-shell/ontology-shell.tsx"
    )
    const content = fs.readFileSync(shellPath, "utf-8")

    assert.ok(
      content.includes("OntologyAssistantPanel"),
      "OntologyShell must import and mount OntologyAssistantPanel"
    )
    assert.ok(
      content.includes("/fingerprint"),
      "OntologyShell must poll /api/ontology/[id]/fingerprint"
    )
    assert.ok(
      content.includes("Ontology updated externally"),
      "OntologyShell must show toast on external ontology update"
    )
    assert.ok(
      content.includes("router.refresh()"),
      "OntologyShell must call router.refresh() on external ontology update"
    )
  })
}

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for ontology assistant components via tsx runner", () => {
    const tsxCli = path.resolve(
      process.cwd(),
      "node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs"
    )
    const fallbackCli = path.resolve(
      process.cwd(),
      "node_modules/tsx/dist/cli.mjs"
    )
    const cliToUse = fs.existsSync(fallbackCli) ? fallbackCli : tsxCli

    const testFile = path.resolve(
      process.cwd(),
      "tests/ontology-assistant-dom.test.ts"
    )
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CHILD_REACT_DOM_TEST: "1",
    }
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith("NODE_TEST_")) {
        delete childEnv[key]
      }
    }

    const output = execFileSync(
      process.execPath,
      [cliToUse, "--test", testFile],
      {
        encoding: "utf-8",
        env: childEnv,
      }
    )
    assert.ok(
      output.includes("pass") || output.includes("ok"),
      "Child client DOM rendering tests must pass"
    )
    assert.ok(
      !output.includes("fail 1"),
      "Child client DOM tests must have 0 failures"
    )
  })
}
