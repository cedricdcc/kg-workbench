import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import React from "react"

import { formatViolationBadge } from "../src/features/ontology/components/reasoner-modal/formatters"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

test("formatViolationBadge maps severity to visual attributes", () => {
  const violationBadge = formatViolationBadge("Violation")
  assert.equal(violationBadge.variant, "destructive")

  const warningBadge = formatViolationBadge("Warning")
  assert.equal(warningBadge.variant, "secondary")

  const infoBadge = formatViolationBadge("Info")
  assert.equal(infoBadge.variant, "outline")
})

test("ReasonerReportModal uses DialogContent with viewport='fullscreen'", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reasoner-modal/reasoner-report-modal.tsx"
  )
  assert.ok(fs.existsSync(modalPath), "reasoner-report-modal.tsx must exist")
  const content = fs.readFileSync(modalPath, "utf-8")

  assert.ok(
    content.includes('viewport="fullscreen"'),
    "ReasonerReportModal must use DialogContent with viewport='fullscreen'"
  )
})

if (isChildTest || !isReactServer) {
  test("ReasonerViolationsTab renders full-width SHACL violation inspection table", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { ReasonerViolationsTab } =
      await import("../src/features/ontology/components/reasoner-modal/reasoner-violations-tab")

    const markup = renderToStaticMarkup(
      React.createElement(ReasonerViolationsTab, {
        violations: [
          {
            severity: "Violation",
            source: "sh:MinCountConstraintComponent",
            focusNode: "http://example.org/entities#Drug123",
            message: "Property :dosage must have at least 1 value.",
          },
          {
            severity: "Warning",
            source: "owl:DisjointClasses",
            focusNode: "http://example.org/entities#Compound456",
            message: "Entity is typed as both ActiveIngredient and Vehicle.",
          },
        ],
      })
    )

    assert.ok(
      markup.includes('data-slot="shacl-violations-table"'),
      "Must have data-slot shacl-violations-table"
    )
    assert.ok(markup.includes("<table"), "Must render a full table element")
    assert.ok(
      markup.includes("Severity") &&
        markup.includes("Constraint / Source") &&
        markup.includes("Focus Node") &&
        markup.includes("Message"),
      "Must include table column headers"
    )
    assert.ok(
      markup.includes("sh:MinCountConstraintComponent"),
      "Must render violation source"
    )
    assert.ok(
      markup.includes("http://example.org/entities#Drug123"),
      "Must render focus node"
    )
    assert.ok(
      markup.includes("Property :dosage must have at least 1 value."),
      "Must render violation message"
    )
  })
}

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for ReasonerViolationsTab via tsx runner", () => {
    const tsxCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs")
    const testFile = path.resolve(
      process.cwd(),
      "tests/reasoner-report-modal-dom.test.ts"
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
      [tsxCli, "--test", testFile],
      {
        encoding: "utf-8",
        env: childEnv,
      }
    )
    assert.ok(
      output.includes("pass"),
      "Child client DOM rendering tests must pass"
    )
    assert.ok(
      !output.includes("fail 1"),
      "Child client DOM tests must have 0 failures"
    )
  })
}
