import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("commitDatasetMappingAction rejects missing ontologyId or targetClassName", async () => {
  const { commitDatasetMappingAction } =
    await import("../src/features/tabular/server/actions/commit-dataset-mapping")

  await assert.rejects(
    () =>
      commitDatasetMappingAction({
        ontologyId: "",
        mappingSpec: {
          targetClassName: "Test",
          primaryKeyColumn: "id",
          columnMappings: [],
        },
      }),
    /ontologyId is required/
  )
})
