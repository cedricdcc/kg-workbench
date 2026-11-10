import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import React from "react"

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

import type { KnowledgeContradiction } from "../src/features/analyst/types"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

if (isChildTest || !isReactServer) {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { QueryClient, QueryClientProvider } =
    await import("@tanstack/react-query")

  // Sample contradictions fixtures
  const sampleContradictionA: KnowledgeContradiction = {
    id: "contra-1",
    ontologyId: "ont-100",
    groupKey: "shared",
    entityId: "ent-1",
    entityLabel: "Baltic Research Foundation",
    relationName: "headquarters",
    conflictType: "value_mismatch",
    factA: {
      id: "fact-1",
      value: "Stockholm, Sweden",
      documentTitle: "baltic_marine_2024.pdf",
      quoteText:
        "The Baltic Research Foundation established primary headquarters in Stockholm.",
    },
    factB: {
      id: "fact-2",
      value: "Helsinki, Finland",
      sourceName: "nordic_orgs.csv",
      quoteText: "Baltic Research Foundation | HQ: Helsinki | Row 42",
    },
    explanation:
      "Conflicting headquarters statements detected: Document 2024 states Stockholm while dataset states Helsinki.",
    status: "open",
    resolutionAction: null,
    createdAt: "2026-11-09T10:00:00.000Z",
    updatedAt: "2026-11-09T10:00:00.000Z",
  }

  const sampleContradictionB: KnowledgeContradiction = {
    id: "contra-2",
    ontologyId: "ont-100",
    groupKey: "shared",
    entityId: "ent-2",
    entityLabel: "Gulf Monitoring Station",
    relationName: "operational_status",
    conflictType: "temporal_drift",
    factA: {
      id: "fact-3",
      value: "Active",
      documentTitle: "annual_report_2023.pdf",
    },
    factB: {
      id: "fact-4",
      value: "Decommissioned",
      documentTitle: "decommission_notice_2025.pdf",
    },
    explanation:
      "Temporal drift identified across consecutive monitoring reports.",
    status: "resolved",
    resolutionAction:
      "Keep Statement B (Mark A as invalid): Decommissioned in 2025",
    createdAt: "2026-11-09T11:00:00.000Z",
    updatedAt: "2026-11-09T12:00:00.000Z",
  }

  const sampleContradictionC: KnowledgeContradiction = {
    id: "contra-3",
    ontologyId: "ont-100",
    groupKey: "shared",
    entityId: "ent-3",
    entityLabel: "Algae Bloom Index",
    relationName: "critical_threshold",
    conflictType: "negation",
    factA: {
      id: "fact-5",
      value: "Exceeded Safe Limit",
      documentTitle: "water_quality_2026.pdf",
    },
    factB: {
      id: "fact-6",
      value: "Within Normal Range",
      documentTitle: "satellite_chlorophyll_2026.pdf",
    },
    explanation: "Direct negation between lab water sample and satellite data.",
    status: "dismissed",
    resolutionAction:
      "Dismiss as Compatible (Both valid in context): Measured at different depths",
    createdAt: "2026-11-09T12:00:00.000Z",
    updatedAt: "2026-11-09T13:00:00.000Z",
  }

  // Test 1: ContradictionCard DOM rendering for Value Mismatch
  test("ContradictionCard renders side-by-side statement comparison, conflict type badges, and explanation", async () => {
    const { ContradictionCard } =
      await import("../src/features/analyst/components/contradictions-view/contradiction-card")

    const html = renderToStaticMarkup(
      React.createElement(ContradictionCard, {
        contradiction: sampleContradictionA,
        onResolveClick: () => {},
      })
    )

    // Entity & Relation
    assert.ok(
      html.includes("Baltic Research Foundation"),
      "Must render entity label"
    )
    assert.ok(html.includes("headquarters"), "Must render relation name")

    // Badges
    assert.ok(
      html.includes("Value Mismatch"),
      "Must render Value Mismatch conflict badge"
    )
    assert.ok(html.includes("Open"), "Must render Open status badge")

    // Statement A
    assert.ok(
      html.includes("Stockholm, Sweden"),
      "Must render Statement A value"
    )
    assert.ok(
      html.includes("baltic_marine_2024.pdf"),
      "Must render Statement A source title"
    )
    assert.ok(
      html.includes("The Baltic Research Foundation established primary"),
      "Must render Statement A quote text"
    )

    // Statement B
    assert.ok(
      html.includes("Helsinki, Finland"),
      "Must render Statement B value"
    )
    assert.ok(
      html.includes("nordic_orgs.csv"),
      "Must render Statement B source title"
    )
    assert.ok(
      html.includes("Baltic Research Foundation | HQ: Helsinki"),
      "Must render Statement B quote text"
    )

    // Explanation
    assert.ok(
      html.includes(sampleContradictionA.explanation),
      "Must render contradiction explanation"
    )

    // Action button
    assert.ok(
      html.includes("Resolve Conflict"),
      "Must render active Resolve Conflict button for open contradiction"
    )
  })

  // Test 2: ContradictionCard renders Temporal Drift and Negation badges + Resolved state
  test("ContradictionCard renders Temporal Drift badge and Resolution Details for resolved conflict", async () => {
    const { ContradictionCard } =
      await import("../src/features/analyst/components/contradictions-view/contradiction-card")

    const html = renderToStaticMarkup(
      React.createElement(ContradictionCard, {
        contradiction: sampleContradictionB,
        onResolveClick: () => {},
      })
    )

    assert.ok(
      html.includes("Temporal Drift"),
      "Must render Temporal Drift conflict badge"
    )
    assert.ok(html.includes("Resolved"), "Must render Resolved status badge")
    assert.ok(
      html.includes("Resolution Details"),
      "Must render Resolution Details button when resolved"
    )
    assert.ok(
      html.includes("Keep Statement B (Mark A as invalid)"),
      "Must display resolutionAction note"
    )
  })

  test("ContradictionCard renders Negation badge and Dismissed status", async () => {
    const { ContradictionCard } =
      await import("../src/features/analyst/components/contradictions-view/contradiction-card")

    const html = renderToStaticMarkup(
      React.createElement(ContradictionCard, {
        contradiction: sampleContradictionC,
        onResolveClick: () => {},
      })
    )

    assert.ok(
      html.includes("Negation / Direct Contradiction"),
      "Must render Negation conflict badge"
    )
    assert.ok(html.includes("Dismissed"), "Must render Dismissed status badge")
  })

  // Test 3: ResolveDialog rendering options and strategies
  test("ResolveDialog renders three resolution strategies and custom notes input inline", async () => {
    const { ResolveDialog } =
      await import("../src/features/analyst/components/contradictions-view/resolve-dialog")

    const html = renderToStaticMarkup(
      React.createElement(ResolveDialog, {
        contradiction: sampleContradictionA,
        open: true,
        onOpenChange: () => {},
        inline: true,
      })
    )

    assert.ok(
      html.includes("Resolve Contradiction"),
      "Must render dialog title"
    )
    assert.ok(
      html.includes("Baltic Research Foundation"),
      "Must render contradiction entity in dialog"
    )
    assert.ok(
      html.includes("grid-cols-1 md:grid-cols-2 gap-4"),
      "Must render Statement A and B in 2-column responsive grid on desktop"
    )
    assert.ok(
      html.includes("Statement A") && html.includes("Statement B"),
      "Must render Statement A and Statement B section badges"
    )
    assert.ok(
      html.includes("baltic_marine_2024.pdf"),
      "Must render Statement A source document badge"
    )
    assert.ok(
      html.includes("nordic_orgs.csv"),
      "Must render Statement B source document badge"
    )
    assert.ok(
      html.includes(
        "The Baltic Research Foundation established primary headquarters in Stockholm."
      ),
      "Must render Statement A full quote text"
    )
    assert.ok(
      html.includes("Baltic Research Foundation | HQ: Helsinki | Row 42"),
      "Must render Statement B full quote text"
    )
    assert.ok(
      html.includes("Keep Statement A (Mark B as invalid)"),
      "Must render keep_a strategy option"
    )
    assert.ok(
      html.includes("Keep Statement B (Mark A as invalid)"),
      "Must render keep_b strategy option"
    )
    assert.ok(
      html.includes("Dismiss as Compatible (Both valid in context)"),
      "Must render dismiss strategy option"
    )
    assert.ok(
      html.includes("Resolution Notes (Optional)"),
      "Must render custom resolution notes label"
    )
    assert.ok(
      html.includes("Confirm Resolution"),
      "Must render Confirm Resolution button"
    )
  })

  // Test 4: ContradictionsTab renders list of cards, count badge, and drift analysis button
  test("ContradictionsTab renders list of cards, count badge, and drift analysis button", async () => {
    const { ContradictionsTab } =
      await import("../src/features/analyst/components/contradictions-view/contradictions-tab")

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ContradictionsTab, {
          ontologyId: "ont-100",
          contradictions: [
            sampleContradictionA,
            sampleContradictionB,
            sampleContradictionC,
          ],
        })
      )
    )

    assert.ok(
      html.includes("Knowledge Contradictions &amp; Semantic Drift") ||
        html.includes("Knowledge Contradictions & Semantic Drift"),
      "Must render contradictions tab header"
    )
    assert.ok(
      html.includes("1 open conflict"),
      "Must render open conflict count badge"
    )
    assert.ok(
      html.includes("Run Drift Analysis"),
      "Must render Run Drift Analysis button"
    )
    assert.ok(
      html.includes("grid-cols-1") &&
        html.includes("xl:grid-cols-2") &&
        html.includes("gap-4"),
      "Must render contradictions list in a responsive 2-column grid on wide screens"
    )
    assert.ok(
      html.includes("Baltic Research Foundation"),
      "Must render contradiction A card"
    )
    assert.ok(
      html.includes("Gulf Monitoring Station"),
      "Must render contradiction B card"
    )
    assert.ok(
      html.includes("Algae Bloom Index"),
      "Must render contradiction C card"
    )
  })

  // Test 5: ContradictionsTab renders empty state when 0 contradictions exist
  test("ContradictionsTab renders coherent empty state when 0 contradictions exist", async () => {
    const { ContradictionsTab } =
      await import("../src/features/analyst/components/contradictions-view/contradictions-tab")

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ContradictionsTab, {
          ontologyId: "ont-100",
          contradictions: [],
        })
      )
    )

    assert.ok(
      html.includes(
        "Knowledge Graph is coherent: no conflicting assertions detected."
      ),
      "Must render coherent empty state message"
    )
    assert.ok(
      html.includes("0 open conflicts"),
      "Must render 0 open conflicts badge"
    )
  })
}

// Test 6: runDriftAnalysisAction outbox event creation
test("runDriftAnalysisAction validates ontologyId and dispatches domain event", async () => {
  const { runDriftAnalysisAction } =
    await import("../src/features/analyst/server/actions/run-drift-analysis")

  // Empty validation
  await assert.rejects(
    () => runDriftAnalysisAction(""),
    /ontologyId is required/
  )
  await assert.rejects(
    () => runDriftAnalysisAction("   "),
    /ontologyId is required/
  )

  const insertedEvents: Array<Record<string, unknown>> = []
  const insertedJobs: Array<Record<string, unknown>> = []

  const mockDb = {
    insert: () => ({
      values: (val: Record<string, unknown>) => {
        if ("event_type" in val) {
          insertedEvents.push(val)
          return {
            returning: () => Promise.resolve([{ id: "mock-evt-drift-123" }]),
          }
        }
        if ("target_worker" in val) {
          insertedJobs.push(val)
          return {
            returning: () => Promise.resolve([{ id: "mock-job-drift-456" }]),
          }
        }
        return {
          returning: () => Promise.resolve([{ id: "mock-id-789" }]),
        }
      },
    }),
  }

  const result = await runDriftAnalysisAction(
    "ont-drift-100",
    mockDb as unknown as Parameters<typeof runDriftAnalysisAction>[1]
  )

  assert.equal(result.success, true)
  assert.equal(result.eventId, "mock-evt-drift-123")
  assert.equal(result.jobId, "mock-job-drift-456")

  assert.equal(insertedEvents.length, 1)
  assert.equal(insertedEvents[0].event_type, "analyst.drift_analysis_requested")
  assert.equal(insertedEvents[0].aggregate_type, "ontology")
  assert.equal(insertedEvents[0].aggregate_id, "ont-drift-100")

  const payload = insertedEvents[0].payload as Record<string, unknown>
  assert.equal(payload.ontologyId, "ont-drift-100")
  assert.equal(payload.groupKey, "shared")

  assert.equal(insertedJobs.length, 1)
  assert.equal(insertedJobs[0].target_worker, "analyst")
})

// Test 7: EVENT_WORKER_ROUTING in outbox.ts maps analyst.drift_analysis_requested
test("resolveTargetWorker routes analyst.drift_analysis_requested to analyst", async () => {
  const { resolveTargetWorker } = await import("../src/server/events/outbox")

  assert.equal(
    resolveTargetWorker("analyst.drift_analysis_requested"),
    "analyst"
  )
})

// Test 8: AnalystShell embeds ContradictionsTab
test("AnalystShell imports and embeds ContradictionsTab component", () => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/analyst-shell/analyst-shell.tsx"
  )
  const content = fs.readFileSync(shellPath, "utf-8")

  assert.ok(
    content.includes("ContradictionsTab"),
    "AnalystShell must import ContradictionsTab"
  )
  assert.ok(
    content.includes("<ContradictionsTab ontologyId={ontologyId} />"),
    "AnalystShell must mount ContradictionsTab in contradictions tab panel"
  )
})

// Test 9: ResolveDialog wide viewport and responsive grid layout requirements
test("ResolveDialog conforms to wide dialog layout requirements", () => {
  const dialogPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/contradictions-view/resolve-dialog.tsx"
  )
  assert.ok(fs.existsSync(dialogPath), "resolve-dialog.tsx must exist")
  const dialogContent = fs.readFileSync(dialogPath, "utf-8")

  assert.ok(
    dialogContent.includes('viewport="wide"'),
    "ResolveDialog must use DialogContent with viewport='wide'"
  )
  assert.ok(
    dialogContent.includes("grid-cols-1 md:grid-cols-2 gap-4"),
    "ResolveDialog must layout Statement A and B side-by-side in responsive grid"
  )
})

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for ContradictionCard, ResolveDialog, and ContradictionsTab via tsx runner", () => {
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
      "tests/analyst-contradictions-dom.test.ts"
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
