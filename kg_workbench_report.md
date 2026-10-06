# KG Workbench: Architecture, Capabilities & Setup Guide

> [!NOTE]
> **KG Workbench** is an enterprise-grade full-stack platform for designing modular ontologies, extracting structured knowledge triples and facts from unstructured documents (via LLMs / Neo4j GraphRAG), visually reviewing and validating facts with evidence anchors, and importing approved knowledge into downstream knowledge graphs.

---

## 1. High-Level System Architecture

The application is built as a unified Next.js (App Router) full-stack system paired with containerized backend services.

```mermaid
flowchart TB
    subgraph Client ["Client Browser"]
        UI["Next.js UI (React 19, Tailwind, shadcn/ui)"]
        Canvas["React Flow Canvas (@xyflow/react)<br/>- Visual Ontology Editor<br/>- Fact & Entity Graph Inspector"]
        RQ["TanStack Query (Async Extraction & Polling)"]
    end

    subgraph AppServer ["Next.js App Server (Node.js 24)"]
        RSC["Server Components (Data Loading)"]
        Actions["Server Actions (Mutations & Business Logic)"]
        Drizzle["Drizzle ORM"]
        ExtAdapter["Extraction Adapter Service"]
        AccessGate["Group & Password Access Gate"]
    end

    subgraph Infrastructure ["Containerized Infrastructure (Docker Compose)"]
        direction TB
        subgraph ExtractorService ["Extraction Subsystem (Port 8010)"]
            FastAPI["Internal Extractor (FastAPI + Python 3.12)"]
            GraphRAG["Neo4j GraphRAG Components"]
            LLMs["LLM Backends: Ollama / OpenAI / Anthropic"]
        end

        subgraph StorageLayer ["Data Layer (Port 5433 / 8503)"]
            Postgres[("PostgreSQL 15+ (Relational Store)")]
            SupabaseStorage["Supabase Storage S3 (Optional File Retention)"]
            Studio["Supabase Studio (Port 55432 - Optional)"]
        end
    end

    UI --> RSC
    UI --> Actions
    RQ --> Actions
    RSC --> Drizzle
    Actions --> Drizzle
    Actions --> ExtAdapter
    ExtAdapter --> FastAPI
    FastAPI --> GraphRAG
    GraphRAG --> LLMs
    Drizzle --> Postgres
    Actions --> SupabaseStorage
```

---

## 2. Core Capabilities & Workflows

KG Workbench bridges the gap between abstract ontology engineering and real-world document knowledge extraction through three primary subsystems:

```mermaid
graph LR
    subgraph Subsystem1 ["1. Ontology Studio"]
        O1[Create / Import Ontology] --> O2[Define Modules & Classes]
        O2 --> O3[Configure Relations & Attributes]
        O3 --> O4[Formulate Competency Questions]
        O4 --> O5[Interactive Visual Graph Editing]
    end

    subgraph Subsystem2 ["2. Document Extraction"]
        D1[Upload PDF / Document] --> D2[Chunking & Sectioning]
        D2 --> D3[Neo4j GraphRAG Extraction]
        D3 --> D4[Generate Triples & Evidence Anchors]
    end

    subgraph Subsystem3 ["3. Interactive Review & Curation"]
        R1[Tri-Panel Review Workspace] --> R2[Reader & Evidence Linking]
        R2 --> R3[Fact & Entity Graph Inspection]
        R3 --> R4[Accept / Reject / Remap / Validate]
        R4 --> R5[Export to OWL / JSON / KG Database]
    end

    Subsystem1 -.->|Ontology Schema & Constraints| Subsystem2
    Subsystem2 -->|Extracted Facts & Entities| Subsystem3
```

### 2.1. Modular Ontology Management (`/ontology`)
- **Document & Module Hierarchy**: Organize large ontologies into modular domains (e.g. Finance, Compliance, Operations).
- **Rich Class & Relation Modeling**:
  - Class hierarchies with parent-child inheritance.
  - Attributes with strict datatypes (`xsd:string`, `xsd:integer`, `xsd:dateTime`, etc.) and required/optional flags.
  - Typed relation edges with domain, range, inverse relations, and cardinality constraints.
  - Relation attributes (fact-level metadata/qualifiers).
- **Competency Questions (CQs)**: Formulate business questions directly against the schema and bind subject/predicate/object example instances to test schema coverage.
- **Multilingual Support & Notes**: Localized field translations, author notes, and instance policy enforcement (`open` vs. `controlled`).
- **Interactive Visual Canvas**: React Flow graph with automatic and drag-persisted node positions and module boundaries.
- **Import/Export**: Full JSON roundtrips and OWL (Web Ontology Language) exports with dependency reviews.

### 2.2. Automated Document Extraction (`/knowledge-graph`)
- **Dual Pipeline Architecture**:
  1. **Internal Extractor** (default): Bundled Python FastAPI service running Neo4j GraphRAG. Works out-of-the-box with local Ollama (`llama3`, `mistral`, etc.) or cloud providers (OpenAI, Anthropic).
  2. **External Extractor**: Pluggable HTTP endpoint conforming to the workbench's extraction schema.
- **Provenance & Evidence Anchoring**:
  - Every extracted fact `(Subject, Relation, Object)` is linked to an `evidence_anchor` containing source quote, character offsets, section, and paragraph context.
  - Entity-first extraction: Isolated entities and class attributes are extracted and persisted even if no relationship fact connects them.

### 2.3. Three-Panel Interactive Review Workspace
- **Reader Mode**: Split-view showing original document text alongside extracted facts; clicking a fact highlights its exact passage in the source text.
- **Fact Graph Mode**: React Flow visual graph showing nodes (entities) and edges (relations) colored by module and class.
- **Fact Table Mode**: High-density tabular review grouped by section or status.
- **Inspection & Validation Engine**:
  - Accept, reject, or remap extracted instances to alternative ontology classes.
  - Validation guards: Enforces that mapped facts cannot be accepted if required relation attributes or required entity class attributes are missing.
  - CQ Verification: Run competency questions against extracted facts to see if document evidence answers the questions.

### 2.4. Multi-Group Workspace Isolation & Security
- **Access Modes**:
  - Unprotected `shared` workspace for single-developer local workflows.
  - Single-password protected instance.
  - Multi-group isolation (`APP_ACCESS_GROUPS="Team A:pass1,Team B:pass2"`), where each team sees only their own documents and ontologies.

---

## 3. Data Model & PostgreSQL Schema

The persistence layer is managed with Drizzle ORM on PostgreSQL:

```mermaid
erDiagram
    ontology_documents ||--o{ ontology_modules : contains
    ontology_documents ||--o{ ontology_classes : defines
    ontology_documents ||--o{ ontology_relations : defines
    ontology_documents ||--o{ ontology_competency_questions : validates
    ontology_classes ||--o{ ontology_attributes : has
    ontology_classes ||--o{ ontology_classes : "parent class"
    ontology_relations ||--o{ ontology_relation_attributes : has

    documents ||--o{ document_sections : partitioned_into
    document_sections ||--o{ document_paragraphs : contains
    documents ||--o{ extraction_runs : executes
    documents ||--o{ document_entities : mentions
    documents ||--o{ evidence_anchors : contains

    extraction_runs ||--o{ facts : produces
    facts ||--o{ fact_anchors : verified_by
    evidence_anchors ||--o{ fact_anchors : links
    facts ||--o{ fact_relation_attribute_values : contains
    document_entities ||--o{ entity_attribute_values : has

    ontology_classes ||..o{ document_entities : "classifies"
    ontology_relations ||..o{ facts : "types"
```

---

## 4. Environment Prerequisites for Windows

Before starting, verify the following tools on your Windows machine:

| Prerequisite | Minimum Version | Status on this machine | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 22.0.0` | `v24.15.0` (Installed) | App runtime |
| **Docker Desktop** | `>= 24.0.0` | `v29.4.0` (Installed) | Must be running with Linux container backend |
| **pnpm** | `11.2.2` | Supported via `npm exec pnpm --` | Pinned in `package.json` |
| **Python / uv** | Optional | Python 3.12 + `uv` | Only needed if running the internal extractor outside Docker |
| **Shell** | PowerShell or Git Bash | PowerShell active | Commands for both are provided below |

---

## 5. Step-by-Step Setup Guide

You have two deployment profiles available depending on your needs:
1. **`postgres` profile (Recommended for rapid development)**: Runs plain PostgreSQL (port 5433) and the internal extractor (port 8010). Uploaded files are processed in memory and discarded after extraction.
2. **`supabase` profile**: Full local Supabase stack (PostgreSQL, PostgREST, Supabase Storage for persistent file uploads, and Supabase Studio).

---

### Path A: Recommended Setup (Plain Postgres + Local Next.js)

#### Step 1: Install Node Dependencies
In PowerShell in the project root:
```powershell
npm exec pnpm -- install --frozen-lockfile
```
*(If you have corepack enabled: `pnpm install --frozen-lockfile`)*

#### Step 2: Configure Environment Files
Copy the environment template files:
```powershell
Copy-Item deploy/.env.postgres.example deploy/.env.server
Copy-Item .env.local.example .env.local
```

Edit `deploy/.env.server` and `.env.local` to set your PostgreSQL password:
- In `deploy/.env.server`: set `POSTGRES_PASSWORD=mysecretpassword`
- In `.env.local`: set `DATABASE_URL=postgresql://postgres:mysecretpassword@127.0.0.1:5433/postgres`

#### Step 3: Start Database and Extractor Containers
Using Docker Compose directly from PowerShell:
```powershell
docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml up -d
```
*(Or in Git Bash: `bash deploy/scripts/deploy.sh postgres up`)*

This starts:
- `db`: PostgreSQL on `127.0.0.1:5433`
- `extraction`: FastAPI Neo4j GraphRAG service on `127.0.0.1:8010`

#### Step 4: Run Database Migrations
Apply the baseline migrations to the PostgreSQL database:
In Git Bash:
```bash
bash deploy/scripts/deploy.sh postgres migrate
```
Or in PowerShell (executing inside the `db` container):
```powershell
# In PowerShell:
Get-ChildItem -Path drizzle/baseline/*.sql | ForEach-Object {
    Get-Content $_.FullName | docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml exec -T db psql -U postgres -d postgres
}
Get-ChildItem -Path drizzle/*/migration.sql | ForEach-Object {
    Get-Content $_.FullName | docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml exec -T db psql -U postgres -d postgres
}
```

#### Step 5: Start the Next.js Frontend
```powershell
npm exec pnpm -- dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

### Path B: Alternative Setup (Supabase Storage Profile)

If you require persistent storage of original PDF/doc uploads and Supabase Studio:

1. **Copy configuration:**
   ```powershell
   Copy-Item deploy/.env.server.example deploy/.env.server
   Copy-Item .env.local.example .env.local
   ```
2. **Generate keys:**
   In Git Bash:
   ```bash
   sh deploy/supabase/utils/generate-keys.sh --update-env
   ```
3. **Start the Supabase stack:**
   ```bash
   bash deploy/scripts/deploy.sh supabase up
   bash deploy/scripts/deploy.sh supabase migrate
   ```
4. **Update `.env.local`**:
   Set `STORAGE_PROVIDER=supabase`, `SUPABASE_URL=http://127.0.0.1:8503`, and copy `SERVICE_ROLE_KEY` from `deploy/.env.server`.
5. **Start frontend:**
   ```powershell
   npm exec pnpm -- dev
   ```
   - App: `http://localhost:3000`
   - Supabase Studio: `http://127.0.0.1:55432`

---

## 6. Verification and Health Checks

To verify that your installation is completely functional:

1. **Extractor Health Check**:
   Navigate to `http://127.0.0.1:8010/health` (should return `{"status":"ok"}`).
2. **Run Web Quality Checks**:
   ```powershell
   npm exec pnpm -- check
   ```
   *(Runs ESLint, TypeScript typecheck, unit tests, and Next.js production build)*.
3. **Full Suite (including dependency audits)**:
   ```powershell
   npm exec pnpm -- check:all
   ```

---

## 7. Key Configuration & Service Ports Summary

| Service | Port | Endpoint / Purpose |
| :--- | :--- | :--- |
| **Next.js Web App** | `3000` | Main application UI (`/ontology`, `/knowledge-graph`) |
| **PostgreSQL Database** | `5433` | Primary relational database (`DATABASE_URL`) |
| **Internal Extractor** | `8010` | FastAPI GraphRAG extraction API (`/health`, `/extract`) |
| **Supabase Studio** *(Supabase profile)* | `55432` | Visual database and storage manager |
| **Supabase Storage Gateway** | `8503` | S3-compatible file storage API |
| **Ollama** *(Local LLM option)* | `11434` | Reached via `http://host.docker.internal:11434` from containers |
