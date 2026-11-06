import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("datasetSources table schema exposes expected columns and indexes", async () => {
  const { datasetSources } = await import("../src/server/db/schema")
  assert.ok(datasetSources.id)
  assert.ok(datasetSources.ontology_id)
  assert.ok(datasetSources.group_key)
  assert.ok(datasetSources.source_name)
  assert.ok(datasetSources.file_format)
  assert.ok(datasetSources.row_count)
  assert.ok(datasetSources.column_count)
  assert.ok(datasetSources.profile_summary)
  assert.ok(datasetSources.sample_rows)
  assert.ok(datasetSources.mapping_spec)
  assert.ok(datasetSources.connection_config)
  assert.ok(datasetSources.last_synced_at)
  assert.ok(datasetSources.created_at)
  assert.ok(datasetSources.updated_at)
})

test("archiveDatasetSourceAction rejects missing source name or ontology id", async () => {
  const { archiveDatasetSourceAction } =
    await import("../src/features/tabular/server/actions/archive-dataset-source")
  await assert.rejects(
    () =>
      archiveDatasetSourceAction({
        ontologyId: "",
        sourceName: "test.csv",
        fileFormat: "csv",
        rowCount: 10,
        columnCount: 2,
        profileSummary: {
          rowCount: 10,
          columnCount: 2,
          candidateKeys: [],
          columns: [],
        },
        sampleRows: [],
      }),
    /ontologyId is required/
  )
})
