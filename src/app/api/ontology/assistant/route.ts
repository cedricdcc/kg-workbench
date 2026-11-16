import { NextResponse } from "next/server"
import { z } from "zod"
import { runOntologyAssistantTurn } from "@/features/ontology/server/assistant/agent"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const assistantRequestSchema = z.object({
  ontologyId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  provider: z.enum(["gemini", "vllm", "openai"]).optional(),
  model: z.string().min(1).optional(),
})

function isAccessDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes("No valid app access group") ||
    error.message.includes("not accessible for the current group")
  )
}

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody: unknown = await request.json()
    const parsed = assistantRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 }
      )
    }

    const groupKey = await getCurrentGroupKeyOrThrow()
    const result = await runOntologyAssistantTurn({
      ontologyId: parsed.data.ontologyId,
      groupKey,
      messages: parsed.data.messages,
      provider: parsed.data.provider,
      model: parsed.data.model,
    })

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
            : "Ontology assistant request failed.",
      },
      { status: 500 }
    )
  }
}
