import { test } from "node:test"
import assert from "node:assert/strict"
import {
  normalizeModelName,
  getCandidateModels,
} from "../src/server/llm/catalog"

test("normalizeModelName normalizes legacy Gemini flash models to gemini-3.8-flash and 2.5-pro to 3.1-pro-preview", () => {
  assert.equal(
    normalizeModelName("gemini", "gemini-2.5-flash"),
    "gemini-3.8-flash"
  )
  assert.equal(
    normalizeModelName("gemini", "models/gemini-2.5-flash"),
    "gemini-3.8-flash"
  )
  assert.equal(
    normalizeModelName("gemini", "gemini-2.0-flash"),
    "gemini-3.8-flash"
  )
  assert.equal(
    normalizeModelName("gemini", "gemini-2.5-pro"),
    "gemini-3.1-pro-preview"
  )
  assert.equal(
    normalizeModelName("gemini", "models/gemini-1.5-pro"),
    "gemini-1.5-pro"
  )
  assert.equal(normalizeModelName("gemini"), "gemini-3.8-flash")
})

test("normalizeModelName handles vllm and openai providers", () => {
  assert.equal(
    normalizeModelName("vllm", "meta-llama/Llama-3-8B-Instruct"),
    "meta-llama/Llama-3-8B-Instruct"
  )
  assert.equal(normalizeModelName("openai", "models/gpt-4o"), "gpt-4o")
  assert.equal(normalizeModelName("vllm"), "")
})

test("getCandidateModels builds prioritized deduplicated queue", () => {
  const queue = getCandidateModels("gemini", "gemini-3.1-pro-preview")
  assert.equal(queue[0], "gemini-3.1-pro-preview")
  assert.ok(queue.includes("gemini-3.8-flash"))
  assert.equal(new Set(queue).size, queue.length)
})

test("getCandidateModels respects custom candidates and normalizes them", () => {
  const queue = getCandidateModels("gemini", "gemini-2.0-flash", [
    "models/gemini-1.5-pro",
    "gemini-2.5-flash",
  ])
  assert.equal(queue[0], "gemini-3.8-flash")
  assert.ok(queue.includes("gemini-1.5-pro"))
  // gemini-2.0-flash and gemini-2.5-flash both normalize to gemini-3.8-flash, so deduplication works
  assert.equal(new Set(queue).size, queue.length)
})

test("getCandidateModels defaults when no primaryModel is given", () => {
  const queue = getCandidateModels("gemini")
  assert.equal(queue[0], "gemini-3.8-flash")
  assert.ok(queue.includes("gemini-3.1-pro-preview"))
})

test("getCandidateModels handles vllm and openai providers", () => {
  const queueVllm = getCandidateModels("vllm", "my-custom-model")
  assert.deepEqual(queueVllm, ["my-custom-model"])

  const queueCustom = getCandidateModels("openai", "gpt-4o", ["gpt-4o-mini"])
  assert.deepEqual(queueCustom, ["gpt-4o", "gpt-4o-mini"])
})
