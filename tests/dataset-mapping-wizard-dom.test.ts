import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import {
  validateMappingSpecBeforeCommit,
  getDatasetCompositeKey,
  initializeWizardState,
} from "../src/features/tabular/components/dataset-mapping-wizard/types"
import type { ArchivedDatasetSource } from "../src/features/tabular/types"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

test("validateMappingSpecBeforeCommit rejects missing primary key column", () => {
  const result = validateMappingSpecBeforeCommit({
    targetClassName: "Customer",
    primaryKeyColumn: "",
    columnMappings: [],
  })
  assert.equal(result.isValid, false)
  assert.ok(result.error?.includes("Primary key"))
})

test("validateMappingSpecBeforeCommit rejects missing target class name", () => {
  const result = validateMappingSpecBeforeCommit({
    targetClassName: "",
    primaryKeyColumn: "customer_id",
    columnMappings: [],
  })
  assert.equal(result.isValid, false)
  assert.ok(result.error?.includes("Target class"))
})

test("validateMappingSpecBeforeCommit accepts valid mapping spec", () => {
  const result = validateMappingSpecBeforeCommit({
    targetClassName: "Customer",
    primaryKeyColumn: "customer_id",
    columnMappings: [
      {
        columnName: "customer_id",
        inferredType: "string",
        targetKind: "attribute",
        targetAttributeName: "customerId",
        targetDataType: "xsd:string",
        isPrimaryKey: true,
      },
    ],
  })
  assert.equal(result.isValid, true)
  assert.equal(result.error, undefined)
})

test("getDatasetCompositeKey distinguishes datasets even when ID is empty or undefined", () => {
  assert.equal(getDatasetCompositeKey(null), "")

  const ds1: Partial<ArchivedDatasetSource> = {
    id: "",
    sourceName: "organisations.csv",
  }
  const ds2: Partial<ArchivedDatasetSource> = {
    id: "",
    sourceName: "users.csv",
  }
  const ds3: Partial<ArchivedDatasetSource> = {
    id: "archived-uuid-1",
    sourceName: "organisations.csv",
  }

  const key1 = getDatasetCompositeKey(ds1 as ArchivedDatasetSource)
  const key2 = getDatasetCompositeKey(ds2 as ArchivedDatasetSource)
  const key3 = getDatasetCompositeKey(ds3 as ArchivedDatasetSource)

  assert.equal(key1, "ephemeral:organisations.csv")
  assert.equal(key2, "ephemeral:users.csv")
  assert.equal(key3, "archived-uuid-1:organisations.csv")
  assert.notEqual(
    key1,
    key2,
    "Datasets with same empty ID but different file names must have different keys"
  )
})

test("initializeWizardState produces distinct states for different datasets without contamination", () => {
  const datasetA: ArchivedDatasetSource = {
    id: "ds-1",
    ontologyId: "ont-1",
    groupKey: "shared",
    sourceName: "organisations.csv",
    fileFormat: "csv",
    rowCount: 5,
    columnCount: 2,
    profileSummary: {
      rowCount: 5,
      columnCount: 2,
      columns: [
        {
          name: "org_id",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 5,
          isUniqueCandidate: true,
          sampleValues: ["1", "2"],
        },
        {
          name: "org_name",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 5,
          isUniqueCandidate: false,
          sampleValues: ["Acme", "Beta"],
        },
      ],
      candidateKeys: [["org_id"]],
    },
    sampleRows: [{ org_id: "1", org_name: "Acme" }],
    mappingSpec: null,
    connectionConfig: null,
    lastSyncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const datasetB: ArchivedDatasetSource = {
    id: "ds-2",
    ontologyId: "ont-1",
    groupKey: "shared",
    sourceName: "users.csv",
    fileFormat: "csv",
    rowCount: 10,
    columnCount: 2,
    profileSummary: {
      rowCount: 10,
      columnCount: 2,
      columns: [
        {
          name: "user_id",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 10,
          isUniqueCandidate: true,
          sampleValues: ["u1", "u2"],
        },
        {
          name: "email",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 10,
          isUniqueCandidate: false,
          sampleValues: ["a@b.com", "c@d.com"],
        },
      ],
      candidateKeys: [["user_id"]],
    },
    sampleRows: [{ user_id: "u1", email: "a@b.com" }],
    mappingSpec: null,
    connectionConfig: null,
    lastSyncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const stateA = initializeWizardState(datasetA)
  const stateB = initializeWizardState(datasetB)

  assert.equal(stateA.targetClassName, "Organisations")
  assert.equal(stateA.primaryKeyColumn, "org_id")
  assert.deepEqual(
    stateA.columnMappings.map((m) => m.columnName),
    ["org_id", "org_name"]
  )

  assert.equal(stateB.targetClassName, "Users")
  assert.equal(stateB.primaryKeyColumn, "user_id")
  assert.deepEqual(
    stateB.columnMappings.map((m) => m.columnName),
    ["user_id", "email"]
  )
})

test("DatasetMappingModal conforms to fullscreen Option B layout requirements", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx"
  )
  assert.ok(fs.existsSync(modalPath), "dataset-mapping-modal.tsx must exist")
  const modalContent = fs.readFileSync(modalPath, "utf-8")

  assert.ok(
    modalContent.includes('viewport="fullscreen"') &&
      modalContent.includes('className="p-6"'),
    "DatasetMappingModal must use DialogContent with viewport='fullscreen' and className='p-6'"
  )
})

test("Dataset mapping wizard steps 2 and 3 render responsive multi-column layouts", () => {
  const step2Path = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/step-attribute-mapping.tsx"
  )
  assert.ok(fs.existsSync(step2Path), "step-attribute-mapping.tsx must exist")
  const step2Content = fs.readFileSync(step2Path, "utf-8")
  assert.ok(
    step2Content.includes("grid-cols-1") &&
      step2Content.includes("lg:grid-cols-2") &&
      step2Content.includes("xl:grid-cols-3") &&
      step2Content.includes("gap-4"),
    "Step 2 (Attributes mapping) must render responsive multi-column layout (grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4)"
  )

  const step3Path = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/step-ai-synthesis-review.tsx"
  )
  assert.ok(fs.existsSync(step3Path), "step-ai-synthesis-review.tsx must exist")
  const step3Content = fs.readFileSync(step3Path, "utf-8")
  assert.ok(
    step3Content.includes("grid-cols-1") &&
      step3Content.includes("lg:grid-cols-2") &&
      step3Content.includes("xl:grid-cols-3") &&
      step3Content.includes("gap-4"),
    "Step 3 (Review & commit) must render responsive multi-column layout (grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4)"
  )
})

if (isChildTest || !isReactServer) {
  test("StepAiSynthesisReview renders multi-column summary cards in DOM", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { StepAiSynthesisReview } =
      await import("../src/features/tabular/components/dataset-mapping-wizard/step-ai-synthesis-review")

    const markup = renderToStaticMarkup(
      React.createElement(StepAiSynthesisReview, {
        wizardState: {
          targetClassName: "Customer",
          primaryKeyColumn: "customer_id",
          privacyConfigs: [],
          columnMappings: [
            {
              columnName: "customer_id",
              inferredType: "string",
              targetKind: "attribute",
              targetAttributeName: "customerId",
              targetDataType: "xsd:string",
              isPrimaryKey: true,
            },
            {
              columnName: "company_id",
              inferredType: "string",
              targetKind: "relation",
              targetRelationName: "hasCompany",
              targetClassId: "cls-1",
            },
          ],
          synthesizedElements: {
            classes: [{ name: "Company", description: "Company entity" }],
            attributes: [
              {
                className: "Customer",
                name: "creditScore",
                dataType: "xsd:integer",
              },
            ],
            relations: [
              {
                sourceClass: "Customer",
                name: "worksAt",
                targetClass: "Company",
              },
            ],
          },
        },
      })
    )

    assert.ok(
      markup.includes("grid-cols-1") &&
        markup.includes("lg:grid-cols-2") &&
        markup.includes("xl:grid-cols-3"),
      "Must render responsive grid classes in markup"
    )
    assert.ok(markup.includes("Customer"), "Must render target class")
    assert.ok(markup.includes("customer_id"), "Must render primary key column")
    assert.ok(markup.includes("Company"), "Must render synthesized class")
    assert.ok(markup.includes("worksAt"), "Must render synthesized relation")
  })
}

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for StepAiSynthesisReview via tsx runner", () => {
    const tsxCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs")
    const testFile = path.resolve(
      process.cwd(),
      "tests/dataset-mapping-wizard-dom.test.ts"
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
