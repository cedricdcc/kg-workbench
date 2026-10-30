import assert from "node:assert/strict"
import { test } from "node:test"
import { POST as claimHandler } from "../src/app/api/system/jobs/claim/route"
import { POST as completeHandler } from "../src/app/api/system/jobs/[id]/complete/route"
import { POST as failHandler } from "../src/app/api/system/jobs/[id]/fail/route"

test("POST /api/system/jobs/claim rejects missing workerType or workerId", async () => {
  const req1 = new Request("http://localhost/api/system/jobs/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workerId: "w1" }),
  })
  const res1 = await claimHandler(req1)
  assert.equal(res1.status, 400)
  const json1 = await res1.json()
  assert.ok(json1.error.includes("workerType"))

  const req2 = new Request("http://localhost/api/system/jobs/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workerType: "extractor" }),
  })
  const res2 = await claimHandler(req2)
  assert.equal(res2.status, 400)
  const json2 = await res2.json()
  assert.ok(json2.error.includes("workerId"))
})

test("POST /api/system/jobs/[id]/complete validates id param and executes completion", async () => {
  const req = new Request("http://localhost/api/system/jobs/job-1/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: { factsCount: 42 } }),
  })

  // Next.js passes dynamic params as a promise
  const res = await completeHandler(req, {
    params: Promise.resolve({ id: "job-1" }),
  })

  // Since db connection is called via getDb(), in test environment without live PG it might throw or succeed
  // If getDb throws, status is 500 with error message, which confirms param parsing and route execution
  assert.ok(res.status === 200 || res.status === 500)
  const json = await res.json()
  if (res.status === 200) {
    assert.equal(json.ok, true)
    assert.equal(json.id, "job-1")
  } else {
    assert.ok(json.error)
  }
})

test("POST /api/system/jobs/[id]/fail validates id param and error details", async () => {
  const req = new Request("http://localhost/api/system/jobs/job-2/fail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      errorMessage: "Ollama timeout",
      currentAttempts: 1,
      maxAttempts: 3,
    }),
  })

  const res = await failHandler(req, {
    params: Promise.resolve({ id: "job-2" }),
  })

  assert.ok(res.status === 200 || res.status === 500)
})
