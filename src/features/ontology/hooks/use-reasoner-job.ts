"use client"

import { useQuery } from "@tanstack/react-query"
import { routes } from "@/lib/routes"
import type { ReasonerResultPayload } from "../server/actions/run-ontology-reasoning"
import { shouldContinuePolling } from "./polling"

export { shouldContinuePolling }

export interface JobStatusResponse {
  id: string
  status: "pending" | "claimed" | "completed" | "failed"
  priority: number
  attempts: number
  maxAttempts: number
  targetWorker: string
  result?: ReasonerResultPayload | null
  errorDetails?: string | null
  createdAt: string
  updatedAt: string
}

export function useReasonerJob(
  jobId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery<JobStatusResponse>({
    queryKey: ["reasoner-job", jobId],
    queryFn: async () => {
      if (!jobId) {
        throw new Error("Job ID is required")
      }
      const res = await fetch(routes.api.system.jobs.status(jobId))
      if (!res.ok) {
        throw new Error(`Failed to fetch job status: ${res.statusText}`)
      }
      return res.json()
    },
    enabled: Boolean(jobId && (options?.enabled ?? true)),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 1000
      return shouldContinuePolling(data.status) ? 2000 : false
    },
  })
}
