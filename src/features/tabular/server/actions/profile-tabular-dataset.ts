"use server"

import crypto from "node:crypto"
import { getDb } from "@/server/db"
import { getServiceRegistryStatuses } from "@/server/events/services"
import { publishDomainEvent } from "@/server/events/outbox"
import { fastPathAwaitJob } from "@/server/events/queue"
import type { TabularActionResponse, TabularProfileResult } from "../../types"

export async function requestTabularProfilingPayloadAction(input: {
  fileName: string
  fileType: string
  fileBufferBase64: string
  options?: Record<string, unknown>
}): Promise<TabularActionResponse> {
  const db = getDb()

  // 1. Check if Tabular service is online
  const services = await getServiceRegistryStatuses(db)
  const tabularService = services.find((s) => s.id === "tabular")

  if (!tabularService || tabularService.status === "offline") {
    return {
      status: "offline",
      message: "DuckDB Tabular microservice is currently offline or unreachable.",
      composeCommand: "bash deploy/scripts/deploy.sh postgres up --profile tabular",
    }
  }

  const aggregateId = crypto.randomUUID()

  // 2. Publish domain event & job queue row
  const { jobId } = await publishDomainEvent(
    db,
    {
      eventType: "tabular.profile_requested",
      aggregateType: "dataset",
      aggregateId,
      payload: {
        fileName: input.fileName,
        fileType: input.fileType,
        fileBufferBase64: input.fileBufferBase64,
        options: input.options || {},
      },
    },
    { priority: 100, targetWorker: "tabular" }
  )

  // 3. Fast-Path Await (3,500ms window)
  const awaitRes = await fastPathAwaitJob<TabularProfileResult>(
    db,
    jobId,
    3500,
    100
  )

  if (awaitRes.resolved && awaitRes.status === "completed" && awaitRes.result) {
    return {
      status: "completed",
      jobId,
      result: awaitRes.result,
    }
  }

  if (awaitRes.resolved && awaitRes.status === "failed") {
    return {
      status: "failed",
      jobId,
      error: awaitRes.error || "Tabular profiling job failed",
    }
  }

  return {
    status: "pending",
    jobId,
  }
}

export async function requestTabularProfilingAction(
  formData: FormData
): Promise<TabularActionResponse> {
  const file = formData.get("file") as File | null
  if (!file) {
    return {
      status: "failed",
      jobId: "",
      error: "No file provided in form data",
    }
  }

  const fileName = file.name
  const ext = fileName.split(".").pop()?.toLowerCase() || "csv"
  const arrayBuffer = await file.arrayBuffer()
  const fileBufferBase64 = Buffer.from(arrayBuffer).toString("base64")

  return requestTabularProfilingPayloadAction({
    fileName,
    fileType: ext,
    fileBufferBase64,
  })
}
