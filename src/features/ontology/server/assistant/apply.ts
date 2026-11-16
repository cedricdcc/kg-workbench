import "server-only"

import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"
import { routes } from "@/lib/routes"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import { applyProposedOperationsAtomically } from "../assistant-tools/executor"
import type { WriteToolDefinition } from "../assistant-tools/write-tools"
import type { DbClient } from "../linkml/document-store"

const applyRequestSchema = z.object({
  ontologyId: z.string().min(1),
  operations: z.array(
    z.object({
      tool: z.string().min(1),
      args: z.record(z.string(), z.unknown()).default({}),
    })
  ),
})

export interface ApplyProposalRouteDeps {
  getGroupKey?: () => Promise<string>
  writeTools?: Record<string, WriteToolDefinition>
  getDb?: () => DbClient
  revalidateOntologyPath?: () => void
}

function isAccessDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes("No valid app access group") ||
    error.message.includes("not accessible for the current group")
  )
}

export async function handleApplyProposalRequest(
  request: Request,
  deps?: ApplyProposalRouteDeps
): Promise<Response> {
  try {
    const rawBody: unknown = await request.json()
    const parsed = applyRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 }
      )
    }

    const groupKey = deps?.getGroupKey
      ? await deps.getGroupKey()
      : await getCurrentGroupKeyOrThrow()

    const result = await applyProposedOperationsAtomically(
      { groupKey },
      parsed.data.ontologyId,
      parsed.data.operations,
      {
        writeTools: deps?.writeTools,
        getDb: deps?.getDb,
      }
    )

    if (!result.ok) {
      return NextResponse.json(result, { status: 422 })
    }

    try {
      if (deps?.revalidateOntologyPath) {
        deps.revalidateOntologyPath()
      } else {
        revalidatePath(routes.ontology.root)
      }
    } catch {
      // revalidatePath is unavailable outside Next.js request scope (e.g. unit tests)
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (isAccessDeniedError(error)) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status: 403 }
      )
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to apply proposal.",
      },
      { status: 500 }
    )
  }
}
