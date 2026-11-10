import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { formatViolationBadge } from "../src/features/ontology/components/reasoner-modal/formatters"
import { ReasonerViolationsTab } from "../src/features/ontology/components/reasoner-modal/reasoner-violations-tab"

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

test("ReasonerViolationsTab renders full-width SHACL violation inspection table", () => {
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
