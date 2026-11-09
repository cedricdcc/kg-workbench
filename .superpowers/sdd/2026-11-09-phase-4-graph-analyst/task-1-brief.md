# Task 1: Database Schema Migrations for Analyst Sessions & Contradictions

**Files:**

- Modify: `src/server/db/schema.ts:530-558`
- Create: `tests/analyst-schema.test.ts`

## Step 1: Write the failing schema test

Create `tests/analyst-schema.test.ts` testing table declarations for `analystConversations`, `analystMessages`, and `knowledgeContradictions` in `src/server/db/schema.ts`:

- Check `analystConversations` table has columns `id`, `ontology_id`, `group_key`, `title`, `created_at`, `updated_at`.
- Check `analystMessages` table has columns `id`, `conversation_id`, `sender`, `content`, `reasoning_trace`, `subgraph`, `citations`, `created_at`.
- Check `knowledgeContradictions` table has columns `id`, `ontology_id`, `group_key`, `entity_id`, `entity_label`, `relation_name`, `conflict_type`, `fact_a`, `fact_b`, `explanation`, `status`, `resolution_action`, `created_at`, `updated_at`.

## Step 2: Run test to confirm failure

Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-schema.test.ts` to verify it fails before schema is added.

## Step 3: Add schema definitions to `src/server/db/schema.ts`

Add the three tables with exact types:

```ts
export const analystConversations = pgTable("analyst_conversations", {
  id: generatedId(),
  ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, {
    onDelete: "cascade",
  }),
  group_key: text("group_key").notNull().default("shared"),
  title: text("title").notNull().default("New Analysis"),
  created_at: created_at(),
  updated_at: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
})

export const analystMessages = pgTable("analyst_messages", {
  id: generatedId(),
  conversation_id: uuid("conversation_id")
    .references(() => analystConversations.id, { onDelete: "cascade" })
    .notNull(),
  sender: text("sender").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  reasoning_trace:
    jsonb("reasoning_trace").$type<Array<{ step: string; detail: string }>>(),
  subgraph: jsonb("subgraph").$type<{
    nodes: Array<{
      id: string
      label: string
      kind: string
      metadata?: Record<string, unknown>
    }>
    edges: Array<{
      id: string
      source: string
      target: string
      label: string
    }>
  }>(),
  citations: jsonb("citations").$type<
    Array<{
      sourceType: "document" | "table"
      sourceId: string
      sourceName: string
      paragraphIndex?: number
      pageFrom?: number
      pageTo?: number
      quoteText?: string
      tableRowKey?: string
    }>
  >(),
  created_at: created_at(),
})

export const knowledgeContradictions = pgTable("knowledge_contradictions", {
  id: generatedId(),
  ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, {
    onDelete: "cascade",
  }),
  group_key: text("group_key").notNull().default("shared"),
  entity_id: text("entity_id").notNull(),
  entity_label: text("entity_label").notNull(),
  relation_name: text("relation_name").notNull(),
  conflict_type: text("conflict_type").notNull(), // 'value_mismatch' | 'temporal_drift' | 'negation'
  fact_a: jsonb("fact_a").notNull(),
  fact_b: jsonb("fact_b").notNull(),
  explanation: text("explanation").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'resolved' | 'dismissed'
  resolution_action: text("resolution_action"),
  created_at: created_at(),
  updated_at: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
})
```

## Step 4: Run test to verify it passes

Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-schema.test.ts` and verify all tests pass.
Also run `cmd /c "node_modules\.bin\tsc.cmd" --noEmit` to verify typecheck.

## Step 5: Commit schema changes

`git add src/server/db/schema.ts tests/analyst-schema.test.ts`
`git commit -m "feat(analyst): add database schema for conversations and contradictions"`
