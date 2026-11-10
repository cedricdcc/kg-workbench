import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import type {
  CompiledOntologyArtifacts,
  OhiLockfileV2,
  OntologyUiLayout,
} from "@/features/ontology/server/linkml/types"

const generatedId = () => uuid("id").defaultRandom().primaryKey()
const created_at = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow()

// This schema mirrors the application-owned PostgreSQL schema. The existing
// SQL migrations remain the baseline for installed databases; new migrations
// are generated into /drizzle after that baseline has been applied.
export const ontologyDocuments = pgTable("ontology_documents", {
  id: generatedId(),
  name: text("name").notNull(),
  version: text("version").default("1.0.0"),
  source_file: text("source_file"),
  created_at: created_at(),
  default_language: text("default_language").notNull().default("en"),
  usecase: text("usecase").notNull().default(""),
  group_key: text("group_key").notNull().default("shared"),
  linkml_yaml: text("linkml_yaml").notNull().default(""),
  ohi_yaml: text("ohi_yaml").notNull().default(""),
  ohi_lockfile: jsonb("ohi_lockfile")
    .$type<OhiLockfileV2 | null>()
    .default(null),
  ui_layout: jsonb("ui_layout")
    .$type<OntologyUiLayout>()
    .notNull()
    .default(sql`'{"classPositions":{},"moduleLayouts":{}}'::jsonb`),
  compiled_artifacts: jsonb("compiled_artifacts")
    .$type<CompiledOntologyArtifacts | null>()
    .default(null),
})

export const documents = pgTable("documents", {
  id: generatedId(),
  title: text("title").notNull(),
  status: text("status").notNull().default("processing"),
  language: text("language").notNull().default("en"),
  page_count: integer("page_count").notNull().default(0),
  uploaded_at: timestamp("uploaded_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  excerpt: text("excerpt").notNull().default(""),
  tags: text("tags")
    .array()
    .default(sql`'{}'::text[]`),
  file_path: text("file_path"),
  group_key: text("group_key").notNull().default("shared"),
})

export const documentSections = pgTable("document_sections", {
  id: generatedId(),
  document_id: uuid("document_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  sort_order: integer("sort_order").notNull().default(0),
})

export const documentParagraphs = pgTable("document_paragraphs", {
  id: generatedId(),
  section_id: uuid("section_id").notNull(),
  content: text("content").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
})

export const extractionRuns = pgTable("extraction_runs", {
  id: generatedId(),
  document_id: uuid("document_id").notNull(),
  ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("pending"),
  started_at: timestamp("started_at", { withTimezone: true, mode: "string" }),
  completed_at: timestamp("completed_at", {
    withTimezone: true,
    mode: "string",
  }),
  created_at: created_at(),
  group_key: text("group_key").notNull().default("shared"),
  extractor_backend: text("extractor_backend").notNull().default("external"),
  internal_provider: text("internal_provider"),
  internal_model_name: text("internal_model_name"),
  external_extractor_url: text("external_extractor_url"),
  ohi_lockfile_snapshot: jsonb("ohi_lockfile_snapshot")
    .$type<OhiLockfileV2 | null>()
    .default(null),
  ontology_sha256: text("ontology_sha256"),
})

export const evidenceAnchors = pgTable("evidence_anchors", {
  id: generatedId(),
  document_id: uuid("document_id").notNull(),
  section_id: uuid("section_id"),
  paragraph_id: uuid("paragraph_id"),
  quote_text: text("quote_text").notNull(),
  context_text: text("context_text"),
  page_from: integer("page_from"),
  page_to: integer("page_to"),
  start_char: integer("start_char"),
  end_char: integer("end_char"),
})

export const facts = pgTable("facts", {
  id: generatedId(),
  extraction_run_id: uuid("extraction_run_id").notNull(),
  document_id: uuid("document_id").notNull(),
  subject_text: text("subject_text").notNull(),
  relation_text: text("relation_text").notNull(),
  object_text: text("object_text").notNull(),
  relation_type_id: text("relation_type_id"),
  review_status: text("review_status").notNull().default("pending"),
  confidence: real("confidence"),
  primary_anchor_id: uuid("primary_anchor_id"),
  created_at: created_at(),
  is_cross_chapter: boolean("is_cross_chapter").notNull().default(false),
  subject_entity_id: uuid("subject_entity_id"),
  object_entity_id: uuid("object_entity_id"),
})

export const factAnchors = pgTable(
  "fact_anchors",
  {
    fact_id: uuid("fact_id").notNull(),
    anchor_id: uuid("anchor_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.fact_id, table.anchor_id] })]
)

export const documentEntities = pgTable("document_entities", {
  id: generatedId(),
  document_id: uuid("document_id").notNull(),
  extraction_run_id: uuid("extraction_run_id"),
  entity_text: text("entity_text").notNull(),
  class_id: text("class_id"),
  review_status: text("review_status").notNull().default("pending"),
  created_at: created_at().notNull(),
})

export const entityAttributeValues = pgTable("entity_attribute_values", {
  id: generatedId(),
  entity_id: uuid("entity_id").notNull(),
  attribute_id: text("attribute_id").notNull(),
  value: text("value").notNull(),
  created_at: created_at().notNull(),
})

export const ontologyCompetencyQuestions = pgTable(
  "ontology_competency_questions",
  {
    id: generatedId(),
    ontology_id: uuid("ontology_id").notNull(),
    question: text("question").notNull().default(""),
    module_id: text("module_id"),
    subject_class_id: text("subject_class_id"),
    predicate_relation_id: text("predicate_relation_id"),
    object_class_id: text("object_class_id"),
    subject_example_id: text("subject_example_id"),
    predicate_example_id: text("predicate_example_id"),
    object_example_id: text("object_example_id"),
    sort_order: integer("sort_order").notNull().default(0),
    created_at: created_at().notNull(),
  }
)

export const ontologyCompetencyQuestionModules = pgTable(
  "ontology_competency_question_modules",
  {
    cq_id: uuid("cq_id").notNull(),
    module_id: text("module_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.cq_id, table.module_id] })]
)

export const ontologyCqTriples = pgTable(
  "ontology_cq_triples",
  {
    id: generatedId(),
    cq_id: uuid("cq_id")
      .notNull()
      .references(() => ontologyCompetencyQuestions.id, {
        onDelete: "cascade",
      }),
    sort_order: integer("sort_order").notNull().default(0),
    subject_class_id: text("subject_class_id"),
    predicate_relation_id: text("predicate_relation_id"),
    object_class_id: text("object_class_id"),
    subject_example_id: text("subject_example_id"),
    predicate_example_id: text("predicate_example_id"),
    object_example_id: text("object_example_id"),
    created_at: created_at().notNull(),
  },
  (table) => [index("idx_cq_triples_cq_id").on(table.cq_id)]
)

export const factRelationAttributeValues = pgTable(
  "fact_relation_attribute_values",
  {
    id: generatedId(),
    fact_id: uuid("fact_id").notNull(),
    relation_attribute_id: text("relation_attribute_id").notNull(),
    value: text("value").notNull(),
    created_at: created_at().notNull(),
  }
)

export const referenceOntologies = pgTable("reference_ontologies", {
  id: generatedId(),
  ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, {
    onDelete: "cascade",
  }),
  prefix: text("prefix").notNull(),
  name: text("name").notNull(),
  base_iri: text("base_iri").notNull(),
  source_registry: text("source_registry").notNull().default("ohi"),
  source_id: text("source_id").notNull(),
  version: text("version").default(""),
  publication_url: text("publication_url"),
  artifact_url: text("artifact_url"),
  artifact_format: text("artifact_format").notNull().default("linkml-yaml"),
  sha256: text("sha256").notNull().default(""),
  artifact_content: text("artifact_content").notNull().default(""),
  is_transitive: boolean("is_transitive").notNull().default(false),
  synced_at: timestamp("synced_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  group_key: text("group_key").notNull().default("shared"),
  created_at: created_at(),
})

export const referenceOntologyTerms = pgTable("reference_ontology_terms", {
  id: generatedId(),
  reference_ontology_id: uuid("reference_ontology_id")
    .notNull()
    .references(() => referenceOntologies.id, { onDelete: "cascade" }),
  curie: text("curie").notNull(),
  iri: text("iri").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(), // 'class' | 'property' | 'individual'
  property_kind: text("property_kind"), // 'datatype' | 'object' | null
  description: text("description").notNull().default(""),
  synonyms: text("synonyms")
    .array()
    .default(sql`'{}'::text[]`),
  parent_iris: text("parent_iris")
    .array()
    .default(sql`'{}'::text[]`),
  domain_iris: text("domain_iris")
    .array()
    .default(sql`'{}'::text[]`),
  range_iris: text("range_iris")
    .array()
    .default(sql`'{}'::text[]`),
  related_property_iris: text("related_property_iris")
    .array()
    .default(sql`'{}'::text[]`),
  embedding: real("embedding").array(),
  group_key: text("group_key").notNull().default("shared"),
})

export const ontologyDefectSuppressions = pgTable(
  "ontology_defect_suppressions",
  {
    id: generatedId(),
    ontology_id: uuid("ontology_id")
      .notNull()
      .references(() => ontologyDocuments.id, { onDelete: "cascade" }),
    defect_id: text("defect_id").notNull(),
    created_at: created_at(),
  }
)

export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: generatedId(),
    user_id: text("user_id").notNull(),
    provider: text("provider").notNull(),
    encrypted_key: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    key_hint: text("key_hint").notNull(),
    created_at: created_at(),
    updated_at: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    uniqueIndex("user_api_keys_user_provider_idx").on(
      table.user_id,
      table.provider
    ),
  ]
)

export const registryEndpointSnapshots = pgTable(
  "registry_endpoint_snapshots",
  {
    id: generatedId(),
    group_key: text("group_key").notNull().default("shared"),
    provider_id: text("provider_id").notNull(),
    endpoint_url: text("endpoint_url").notNull(),
    status_code: integer("status_code").notNull(),
    latency_ms: integer("latency_ms").notNull(),
    query_params: text("query_params"),
    response_payload: text("response_payload").notNull(),
    detected_vocab_count: integer("detected_vocab_count").notNull().default(0),
    created_at: created_at(),
  }
)

export const domainEvents = pgTable("domain_events", {
  id: generatedId(),
  event_type: text("event_type").notNull(),
  aggregate_type: text("aggregate_type").notNull(),
  aggregate_id: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  created_at: created_at(),
})

export const jobQueue = pgTable(
  "job_queue",
  {
    id: generatedId(),
    event_id: uuid("event_id").references(() => domainEvents.id, {
      onDelete: "cascade",
    }),
    target_worker: text("target_worker").notNull(),
    status: text("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    max_attempts: integer("max_attempts").notNull().default(3),
    locked_by: text("locked_by"),
    locked_until: timestamp("locked_until", {
      withTimezone: true,
      mode: "string",
    }),
    result: jsonb("result"),
    error_details: text("error_details"),
    created_at: created_at(),
    updated_at: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("job_queue_worker_status_priority_idx").on(
      table.target_worker,
      table.status,
      table.priority
    ),
  ]
)

export const systemServices = pgTable("system_services", {
  id: text("id").primaryKey(),
  display_name: text("display_name").notNull(),
  status: text("status").notNull().default("offline"),
  capabilities: jsonb("capabilities").notNull(),
  last_heartbeat: timestamp("last_heartbeat", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  metadata: jsonb("metadata"),
})

export const datasetSources = pgTable(
  "dataset_sources",
  {
    id: generatedId(),
    ontology_id: uuid("ontology_id")
      .notNull()
      .references(() => ontologyDocuments.id, { onDelete: "cascade" }),
    group_key: text("group_key").notNull().default("shared"),
    source_name: text("source_name").notNull(),
    file_format: text("file_format").notNull(),
    row_count: integer("row_count").notNull(),
    column_count: integer("column_count").notNull(),
    profile_summary: jsonb("profile_summary").notNull(),
    sample_rows: jsonb("sample_rows").notNull(),
    mapping_spec: jsonb("mapping_spec"),
    connection_config: jsonb("connection_config"),
    last_synced_at: timestamp("last_synced_at", { withTimezone: true }),
    created_at: created_at(),
    updated_at: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("dataset_sources_ontology_id_idx").on(table.ontology_id),
    index("dataset_sources_group_key_idx").on(table.group_key),
  ]
)

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
