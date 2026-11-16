import { NextResponse } from "next/server"
import { computeOntologyFingerprint } from "@/features/ontology/server/assistant/fingerprint"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAccessDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes("No valid app access group") ||
    error.message.includes("not accessible for the current group")
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json(
        { error: "Ontology id is required" },
        { status: 400 }
      )
    }

    const groupKey = await getCurrentGroupKeyOrThrow()
    const result = await computeOntologyFingerprint(id, groupKey)

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
          error instanceof Error
            ? error.message
            : "Failed to compute ontology fingerprint.",
      },
      { status: 500 }
    )
  }
}
