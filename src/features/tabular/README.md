---
feature: tabular
status: active
purpose: Multi-source tabular ingestion, DuckDB analytical profiling, dataset archiving, and AI-assisted schema mapping.
scope:
  - Tabular dataset upload (CSV, Parquet, Excel)
  - Remote SQL database connections (PostgreSQL, MySQL) via DuckDB scanners
  - Interactive table/view discovery and remote table profiling
  - DuckDB analytical profiling (inferred types, null ratios, sample values, candidate unique keys)
  - Local PII & sensitive data masking pipeline with user review controls
  - Tabular profiler inspector modal with file upload and remote database tabs
  - Tabular dataset archive browser in the left workbench sidebar with persistent re-sync
  - AI-assisted schema synthesis and column mapping wizard
  - Transactional ontology schema commit and mapping spec persistence
entry_points:
  - path: src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx
    purpose: Dialog inspecting column statistics, candidate primary keys, and data preview, supporting file upload and remote database exploration.
  - path: src/features/tabular/components/tabular-profiler-modal/remote-database-tab.tsx
    purpose: Two-step remote database connection explorer (PostgreSQL/MySQL) for table discovery and profiling.
  - path: src/features/tabular/components/dataset-archive-browser/dataset-archive-browser.tsx
    purpose: Workbench left sidebar panel listing archived dataset sources with search, status filters, and mapping actions.
  - path: src/features/tabular/components/dataset-archive-browser/dataset-archive-card.tsx
    purpose: Archive dataset item card rendering format badges, SQL database indicators, mapping status, and one-click re-sync actions.
  - path: src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx
    purpose: Guided modal wizard for privacy shield inspection, entity selection, column-to-property mapping, AI schema synthesis review, and commit.
server_entry_points:
  - path: src/features/tabular/server/actions/profile-tabular-dataset.ts
    purpose: Server actions dispatching tabular.profile_requested domain events with fast-path resolution.
  - path: src/features/tabular/server/actions/remote-database.ts
    purpose: Server actions for remote table discovery, remote table profiling, and persistent dataset source re-sync with encrypted credentials.
  - path: src/features/tabular/server/actions/archive-dataset-source.ts
    purpose: Server action saving dataset profile summary, sample rows, and encrypted connection configs into dataset_sources table.
  - path: src/features/tabular/server/services/pii-masker.ts
    purpose: Deterministic PII and sensitive data masking engine with user overrides for safe AI dispatch.
  - path: src/features/tabular/server/actions/synthesize-mappings.ts
    purpose: Gemini AI service synthesizing missing classes, attributes, and relations from sanitized dataset samples.
  - path: src/features/tabular/server/actions/commit-dataset-mapping.ts
    purpose: Transactional commit creating synthesized ontology elements and updating dataset mapping spec.
  - path: src/features/tabular/server/queries/get-dataset-sources.ts
    purpose: Queries archived dataset sources scoped to ontology and group key.
update_this_readme_when:
  - New tabular connectors (SQL databases, Delta tables) are added
  - Schema-to-ontology induction or PII masking pipelines are introduced
---

# Tabular Feature

High-performance tabular dataset profiling, archiving, and ontology mapping powered by the `kg-workbench-tabular` DuckDB microservice sidecar and Gemini AI.

## Architecture

1. **Profiling & Remote Connectors**: Tabular files (CSV, Parquet, Excel) and remote relational databases (PostgreSQL, MySQL) are profiled via DuckDB in `services/tabular`, computing row counts, column metrics, and candidate unique keys. Remote database connections are strictly `READ_ONLY` and discover schemas and tables interactively.
2. **Archiving (`dataset_sources` table)**: Profiling summaries, sample rows, and encrypted connection configs are archived per ontology document without external storage dependencies (`STORAGE_PROVIDER=none`).
3. **Persistent Re-sync**: Relational database sources in the archive include a one-click "Re-sync" button that re-executes profiling queries and updates metrics without re-entering credentials.
4. **Local Privacy Masking**: Deterministic PII detection sanitizes sensitive columns (emails, phone numbers, credit cards, SSNs, secrets) with salted token placeholders prior to LLM reasoning, backed by interactive user toggle controls in the UI.
5. **AI Schema Synthesis**: When mapping a dataset whose domain concepts or relations do not exist in the ontology, Gemini analyzes profile statistics and sanitized sample rows alongside the current ontology graph to synthesize candidate classes, attributes, and relationships.
6. **Interactive Mapping Wizard (`DatasetMappingModal`)**: A guided wizard allowing domain modelers to inspect candidate keys, configure privacy shield toggles, map columns to ontology attributes or relations, trigger AI synthesis, and commit schema extensions transactionally.
7. **Workbench Integration**: Dedicated **Datasets** and **Reasoner** tabs in the left sidebar panel (`entity-type-tabs.tsx` and `left-browser-panel.tsx`) alongside Classes, Relations, and Standards.
