import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import React from "react"

import type { OntologyClassWithAttributes } from "../src/features/ontology/server/queries"
import type { OntologyModule, OntologyRelation } from "@/domain/ontology"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

describe("CQ Workbench Full-Screen Layout Contracts", () => {
  it("cq-workbench.tsx eliminates max-w-2xl bottleneck and allocates full remaining screen to detail inspector", () => {
    const workbenchPath = path.resolve(
      process.cwd(),
      "src/features/ontology/components/cq-workbench/cq-workbench.tsx"
    )
    assert.ok(fs.existsSync(workbenchPath), "cq-workbench.tsx must exist")
    const content = fs.readFileSync(workbenchPath, "utf-8")

    assert.ok(
      !content.includes("max-w-2xl"),
      "cq-workbench.tsx should not clamp the list container with max-w-2xl"
    )
    assert.ok(
      content.includes("w-[360px]") &&
        content.includes("lg:w-[400px]") &&
        content.includes("shrink-0"),
      "cq-workbench.tsx must set list panel to w-[360px] lg:w-[400px] shrink-0"
    )
    assert.ok(
      content.includes("flex-1") && content.includes("min-w-0"),
      "cq-workbench.tsx must set detail inspector to flex-1 min-w-0"
    )
  })

  it("cq-detail-panel.tsx lays out Question Formulation (65%) and Module Associations (35%) side-by-side on lg viewports", () => {
    const detailPanelPath = path.resolve(
      process.cwd(),
      "src/features/ontology/components/cq-workbench/cq-detail-panel/cq-detail-panel.tsx"
    )
    assert.ok(fs.existsSync(detailPanelPath), "cq-detail-panel.tsx must exist")
    const content = fs.readFileSync(detailPanelPath, "utf-8")

    assert.ok(
      content.includes("lg:grid-cols-[13fr_7fr]"),
      "cq-detail-panel.tsx must configure a 65%/35% responsive top grid"
    )
    assert.ok(
      content.includes('data-testid="cq-question-formulation-card"'),
      "cq-detail-panel.tsx must include question formulation card"
    )
    assert.ok(
      content.includes('data-testid="cq-module-associations-card"'),
      "cq-detail-panel.tsx must include module associations card"
    )
    assert.ok(
      content.includes('data-testid="cq-concept-mapping-section"'),
      "cq-detail-panel.tsx must include full-width concept mapping section"
    )
  })

  if (isChildTest || !isReactServer) {
    it("cq-concept-mapping-card renders horizontal triple chain, attribute badge strips, and full-width add hop button", async () => {
      const { renderToStaticMarkup } = await import("react-dom/server")
      const { CqConceptMappingCard } =
        await import("../src/features/ontology/components/cq-workbench/cq-detail-panel/cq-concept-mapping-card")

      const mockClasses: OntologyClassWithAttributes[] = [
        {
          id: "c1",
          ontology_id: "o1",
          name: "Patient",
          description: "",
          parent_class_id: null,
          module_id: null,
          instance_policy: "open",
          attributes: [
            {
              id: "a1",
              class_id: "c1",
              name: "mrn",
              data_type: "xsd:string",
              required: true,
              description: "",
            },
            {
              id: "a2",
              class_id: "c1",
              name: "birthDate",
              data_type: "xsd:date",
              required: false,
              description: "",
            },
          ],
        },
        {
          id: "c2",
          ontology_id: "o1",
          name: "Condition",
          description: "",
          parent_class_id: null,
          module_id: null,
          instance_policy: "open",
          attributes: [
            {
              id: "a3",
              class_id: "c2",
              name: "icd10Code",
              data_type: "xsd:string",
              required: true,
              description: "",
            },
          ],
        },
      ]

      const mockRelations: OntologyRelation[] = [
        {
          id: "r1",
          ontology_id: "o1",
          name: "diagnosedWith",
          domain_class_id: "c1",
          range_class_id: "c2",
          description: "Diagnosed condition for patient",
          inverse_name: null,
          cardinality: null,
          instance_policy: "open",
        },
      ]

      const mockModules: OntologyModule[] = []

      const markup = renderToStaticMarkup(
        React.createElement(CqConceptMappingCard, {
          classes: mockClasses,
          relations: mockRelations,
          modules: mockModules,
          subjectClassId: "c1",
          predicateRelationId: "r1",
          objectClassId: "c2",
          onUpdateTriples: async () => {},
        })
      )

      // Verify concept mapping root
      assert.ok(markup.includes('data-testid="cq-concept-mapping-card"'))

      // Verify hop row
      assert.ok(markup.includes('data-testid="cq-hop-row"'))

      // Verify horizontal chain pickers
      assert.ok(markup.includes('data-testid="cq-subject-picker"'))
      assert.ok(markup.includes('data-testid="cq-predicate-picker"'))
      assert.ok(markup.includes('data-testid="cq-object-picker"'))

      // Verify attribute badges for Subject (Patient -> mrn, birthDate)
      assert.ok(markup.includes('data-testid="subject-attribute-badges"'))
      assert.ok(markup.includes("mrn"))
      assert.ok(markup.includes("birthDate"))

      // Verify attribute badges for Object (Condition -> icd10Code)
      assert.ok(markup.includes('data-testid="object-attribute-badges"'))
      assert.ok(markup.includes("icd10Code"))

      // Verify predicate relation connector affordance
      assert.ok(markup.includes("Predicate Relation"))
      assert.ok(markup.includes("diagnosedWith"))

      // Verify full-width add hop button
      assert.ok(markup.includes('data-testid="cq-add-hop-button"'))
      assert.ok(markup.includes("Add Connected Hop"))
    })
  }

  if (isReactServer && !isChildTest) {
    it("Client DOM rendering tests for CqConceptMappingCard via tsx runner", () => {
      const tsxCli = path.resolve(
        process.cwd(),
        "node_modules/tsx/dist/cli.mjs"
      )
      const testFile = path.resolve(
        process.cwd(),
        "tests/cq-workbench-layout-dom.test.ts"
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
})
