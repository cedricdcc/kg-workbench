import assert from "node:assert/strict"
import { test } from "node:test"
import { domainEvents, jobQueue, systemServices } from "../src/server/db/schema"

test("domainEvents schema exposes required columns", () => {
  assert.ok(domainEvents.id)
  assert.ok(domainEvents.event_type)
  assert.ok(domainEvents.aggregate_type)
  assert.ok(domainEvents.aggregate_id)
  assert.ok(domainEvents.payload)
  assert.ok(domainEvents.created_at)
})

test("jobQueue schema exposes required lease and retry columns", () => {
  assert.ok(jobQueue.id)
  assert.ok(jobQueue.event_id)
  assert.ok(jobQueue.target_worker)
  assert.ok(jobQueue.status)
  assert.ok(jobQueue.priority)
  assert.ok(jobQueue.attempts)
  assert.ok(jobQueue.max_attempts)
  assert.ok(jobQueue.locked_by)
  assert.ok(jobQueue.locked_until)
  assert.ok(jobQueue.result)
  assert.ok(jobQueue.error_details)
  assert.ok(jobQueue.created_at)
  assert.ok(jobQueue.updated_at)
})

test("systemServices schema exposes discovery and capability columns", () => {
  assert.ok(systemServices.id)
  assert.ok(systemServices.display_name)
  assert.ok(systemServices.status)
  assert.ok(systemServices.capabilities)
  assert.ok(systemServices.last_heartbeat)
})
