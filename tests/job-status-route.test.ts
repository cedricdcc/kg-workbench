import { config } from "dotenv"
config({ path: ".env.local" })
import assert from "node:assert/strict"
import { test } from "node:test"
import { routes } from "../src/lib/routes"
import { GET } from "../src/app/api/system/jobs/[id]/route"

test("routes.api.system.jobs exposes status endpoint builder", () => {
  assert.equal(typeof routes.api.system.jobs.status, "function")
  assert.equal(
    routes.api.system.jobs.status("123"),
    "/api/system/jobs/123"
  )
})

test("GET /api/system/jobs/[id] returns 404 for missing job", async () => {
  const mockParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" })
  const mockReq = new Request("http://localhost:3000/api/system/jobs/00000000-0000-0000-0000-000000000000")
  const res = await GET(mockReq, { params: mockParams })
  assert.equal(res.status, 404)
})

