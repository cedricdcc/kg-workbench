# Task 5: Backend Actions & Event Mesh Integration for Analyst Queries

**Files:**

- Create: `src/features/analyst/types.ts`
- Create: `src/features/analyst/server/queries/get-conversations.ts`
- Create: `src/features/analyst/server/queries/get-messages.ts`
- Create: `src/features/analyst/server/queries/get-contradictions.ts`
- Create: `src/features/analyst/server/actions/create-conversation.ts`
- Create: `src/features/analyst/server/actions/send-query.ts`
- Create: `src/features/analyst/server/actions/resolve-contradiction.ts`
- Create: `tests/analyst-actions.test.ts`

## Instructions

1. **`src/features/analyst/types.ts`**:
   - `AnalystConversation`: `{ id: string; ontologyId: string; groupKey: string; title: string; createdAt: string; updatedAt: string }`
   - `AnalystMessage`: `{ id: string; conversationId: string; sender: 'user' | 'assistant'; content: string; reasoningTrace?: Array<{ step: string; detail: string }>; subgraph?: { nodes: Array<{ id: string; label: string; kind: string; metadata?: Record<string, unknown> }>; edges: Array<{ id: string; source: string; target: string; label: string }> }; citations?: Array<{ sourceType: 'document' | 'table'; sourceId: string; sourceName: string; paragraphIndex?: number; pageFrom?: number; pageTo?: number; quoteText?: string; tableRowKey?: string }>; createdAt: string }`
   - `KnowledgeContradiction`: `{ id: string; ontologyId: string; groupKey: string; entityId: string; entityLabel: string; relationName: string; conflictType: 'value_mismatch' | 'temporal_drift' | 'negation'; factA: Record<string, unknown>; factB: Record<string, unknown>; explanation: string; status: 'open' | 'resolved' | 'dismissed'; resolutionAction?: string | null; createdAt: string; updatedAt: string }`

2. **Queries**:
   - `getConversationsQuery(ontologyId: string)`: select from `analystConversations` where ontology_id and group_key match, ordered by updated_at desc.
   - `getMessagesQuery(conversationId: string)`: select from `analystMessages` where conversation_id matches, ordered by created_at asc.
   - `getContradictionsQuery(ontologyId: string)`: select from `knowledgeContradictions` where ontology_id and group_key match.

3. **Actions**:
   - `createConversationAction({ ontologyId: string, title?: string })`: inserts into `analystConversations`, returns new conversation.
   - `sendQueryAction({ conversationId: string, ontologyId: string, query: string })`:
     - Inserts user message into `analystMessages`.
     - Fetches accepted facts, paragraph anchors, and mapped dataset sources for ontology.
     - Calls `publishDomainEvent(tx, { eventType: 'analyst.query_requested', aggregateType: 'ontology', aggregateId: ontologyId, payload: { conversationId, query, facts, anchors, datasets } })`.
     - Returns `{ userMessage, jobId, eventId }`.
   - `resolveContradictionAction({ contradictionId: string, status: 'resolved' | 'dismissed', actionNotes?: string })`:
     - Updates `knowledgeContradictions` row.

4. **Tests** (`tests/analyst-actions.test.ts`):
   - Test data contracts and query/action logic.

5. Commit:
   `git add src/features/analyst/ tests/analyst-actions.test.ts`
   `git commit -m "feat(analyst): add server actions and queries for graph analyst"`
