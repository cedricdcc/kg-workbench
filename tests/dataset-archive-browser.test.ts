import assert from "node:assert/strict"
import { test } from "node:test"
import { formatDatasetFormatBadge } from "../src/features/tabular/components/dataset-archive-browser/types"

test("formatDatasetFormatBadge maps file formats to label and color classes", () => {
  const csv = formatDatasetFormatBadge("csv")
  assert.equal(csv.label, "CSV")
  const parquet = formatDatasetFormatBadge("parquet")
  assert.equal(parquet.label, "PARQUET")
  const excel = formatDatasetFormatBadge("excel")
  assert.equal(excel.label, "EXCEL")
})
