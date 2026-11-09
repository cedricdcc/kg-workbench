import type { Metadata } from "next"

import { getOntologyDocuments } from "@/features/ontology/server/queries"
import { getConversationsQuery } from "@/features/analyst/server/queries/get-conversations"
import { getSystemServices } from "@/features/settings/server/queries/get-system-services"
import { AnalystShell } from "@/features/analyst/components/analyst-shell/analyst-shell"

export const metadata: Metadata = {
  title: "Graph Analyst - KG Workbench",
  description:
    "Natural language knowledge graph analyst and cross-source contradiction resolution workbench.",
}

interface AnalystPageProps {
  searchParams: Promise<{ doc?: string; c?: string }>
}

export default async function AnalystPage({ searchParams }: AnalystPageProps) {
  const { doc: docParam, c: conversationParam } = await searchParams
  const documents = await getOntologyDocuments()

  const currentDocId =
    docParam && documents.some((d) => d.id === docParam)
      ? docParam
      : (documents[0]?.id ?? "")

  const [conversations, services] = await Promise.all([
    currentDocId ? getConversationsQuery(currentDocId) : Promise.resolve([]),
    getSystemServices(),
  ])

  return (
    <AnalystShell
      ontologyId={currentDocId}
      ontologyDocuments={documents}
      initialConversations={conversations}
      initialConversationId={conversationParam ?? null}
      services={services}
    />
  )
}
