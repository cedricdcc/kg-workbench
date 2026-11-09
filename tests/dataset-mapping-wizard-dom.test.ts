import assert from "node:assert/strict"
import { test } from "node:test"
import {
  validateMappingSpecBeforeCommit,
  getDatasetCompositeKey,
  initializeWizardState,
} from "../src/features/tabular/components/dataset-mapping-wizard/types"
import type { ArchivedDatasetSource } from "../src/features/tabular/types"

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
          inferredKgType: "string",
          nullCount: 0,
          uniqueCount: 5,
          isUniqueCandidate: true,
          sampleValues: ["1", "2"],
        },
        {
          name: "org_name",
          inferredKgType: "string",
          nullCount: 0,
          uniqueCount: 5,
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
          inferredKgType: "string",
          nullCount: 0,
          uniqueCount: 10,
          isUniqueCandidate: true,
          sampleValues: ["u1", "u2"],
        },
        {
          name: "email",
          inferredKgType: "string",
          nullCount: 0,
          uniqueCount: 10,
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
