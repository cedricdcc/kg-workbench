import { config } from "dotenv"
config({ path: ".env.local" })

import assert from "node:assert/strict"
import { test } from "node:test"
import { requestTabularProfilingPayloadAction } from "../src/features/tabular/server/actions/profile-tabular-dataset"

test("requestTabularProfilingPayloadAction returns completed or pending status", async () => {
  const csvBase64 = Buffer.from("id,item\n10,Widget\n20,Gadget\n").toString("base64")

  const response = await requestTabularProfilingPayloadAction({
    fileName: "inventory.csv",
    fileType: "csv",
    fileBufferBase64: csvBase64,
  })

  assert.ok(
    response.status === "completed" ||
      response.status === "pending" ||
      response.status === "offline",
    `Unexpected status: ${response.status}`
  )

  if (response.status === "completed") {
    assert.equal(response.result.rowCount, 2)
    assert.equal(response.result.columnCount, 2)
  }
})

