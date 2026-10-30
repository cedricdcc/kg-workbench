import "server-only"
import { getDb } from "@/server/db"
import {
  getServiceRegistryStatuses,
  type ServiceHealthStatus,
} from "@/server/events/services"

export type SystemServiceDisplay = {
  id: string
  displayName: string
  profile: string
  status: ServiceHealthStatus
  capabilities: string[]
  lastHeartbeat?: string | null
  metadata?: Record<string, unknown> | null
  description: string
}

interface SupportedServiceDefinition {
  id: string
  displayName: string
  profile: string
  description: string
  defaultCapabilities: string[]
}

const DEFAULT_SUPPORTED_SERVICES: SupportedServiceDefinition[] = [
  {
    id: "extractor",
    displayName: "Internal GraphRAG Extractor",
    profile: "extraction",
    description: "FastAPI service for LLM-based triple and entity extraction from unstructured text.",
    defaultCapabilities: ["text_extraction", "chunking", "llm_graphrag"],
  },
  {
    id: "reasoner",
    displayName: "Oxigraph SHACL Reasoner",
    profile: "reasoner",
    description: "Rust/Python semantic engine calculating blast radius, entailment, and SHACL constraint validation.",
    defaultCapabilities: ["blast_radius", "shacl_validation", "owl_reasoning"],
  },
  {
    id: "tabular",
    displayName: "DuckDB Tabular Connector",
    profile: "tabular",
    description: "In-process analytical database engine ingesting CSV, Parquet, and external SQL tables into RDF.",
    defaultCapabilities: ["duckdb_ingestion", "csv_parquet", "schema_induction"],
  },
  {
    id: "analyst",
    displayName: "Knowledge Graph NL Analyst",
    profile: "analyst",
    description: "Conversational QA assistant executing multi-hop queries over accepted facts with paragraph citations.",
    defaultCapabilities: ["graph_qa", "vector_search", "drift_detection"],
  },
]

export async function getSystemServices(): Promise<SystemServiceDisplay[]> {
  try {
    const db = getDb()
    const registered = await getServiceRegistryStatuses(db)
    const registeredMap = new Map(registered.map((s) => [s.id, s]))

    return DEFAULT_SUPPORTED_SERVICES.map((def) => {
      const live = registeredMap.get(def.id)
      return {
        id: def.id,
        displayName: def.displayName,
        profile: def.profile,
        description: def.description,
        status: live ? live.status : "offline",
        capabilities: live ? live.capabilities : def.defaultCapabilities,
        lastHeartbeat: live?.lastHeartbeat ?? null,
        metadata: live?.metadata ?? null,
      }
    })
  } catch {
    // Return defaults offline if DB query fails or tables empty
    return DEFAULT_SUPPORTED_SERVICES.map((def) => ({
      id: def.id,
      displayName: def.displayName,
      profile: def.profile,
      description: def.description,
      status: "offline",
      capabilities: def.defaultCapabilities,
      lastHeartbeat: null,
      metadata: null,
    }))
  }
}
