import { handleApplyProposalRequest } from "@/features/ontology/server/assistant/apply"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  return handleApplyProposalRequest(request)
}
