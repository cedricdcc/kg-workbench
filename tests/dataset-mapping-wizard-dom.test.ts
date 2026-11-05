import assert from "node:assert/strict"
import { test } from "node:test"
import { validateMappingSpecBeforeCommit } from "../src/features/tabular/components/dataset-mapping-wizard/types"

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
