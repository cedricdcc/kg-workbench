---
feature: tabular
status: active
purpose: Multi-source tabular ingestion, DuckDB analytical profiling, dataset archiving, and AI-assisted schema mapping.
scope:
  - Tabular dataset upload (CSV, Parquet, Excel)
  - DuckDB analytical profiling (inferred types, null ratios, sample values, candidate unique keys)
  - Tabular profiler inspector modal and data preview table
  - Tabular dataset archive browser in the left workbench sidebar
  - AI-assisted schema synthesis and column mapping wizard
  - Transactional ontology schema commit and mapping spec persistence
entry_points:
  - path: src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx
    purpose: Dialog inspecting column statistics, candidate primary keys, and data preview.
  - path: src/features/tabular/components/dataset-archive-browser/dataset-archive-browser.tsx
    purpose: Workbench left sidebar panel listing archived dataset sources with search, status filters, and mapping actions.
  - path: src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx
    purpose: 3-step modal wizard for entity selection, column-to-property mapping, AI schema synthesis review, and commit.
server_entry_points:
  - path: src/features/tabular/server/actions/profile-tabular-dataset.ts
    purpose: Server actions dispatching tabular.profile_requested domain events with fast-path resolution.
  - path: src/features/tabular/server/actions/archive-dataset-source.ts
    purpose: Server action saving dataset profile summary and sample rows into dataset_sources table.
  - path: src/features/tabular/server/actions/synthesize-mappings.ts
    purpose: Gemini AI service synthesizing missing classes, attributes, and relations from dataset samples.
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

1. **Profiling**: Tabular files (CSV, Parquet, Excel) are profiled via DuckDB, computing row counts, column metrics, and candidate unique keys.
2. **Archiving (`dataset_sources` table)**: Profiling summaries and top-20 sample rows are archived per ontology document without external storage dependencies (`STORAGE_PROVIDER=none`).
3. **AI Schema Synthesis**: When mapping a dataset whose domain concepts or relations do not exist in the ontology, the LLM analyzes profile statistics and sample rows alongside the current ontology graph to synthesize candidate classes, attributes, and relationships.
4. **Interactive Mapping Wizard (`DatasetMappingModal`)**: A 3-step guided wizard allowing domain modelers to inspect candidate keys, map columns to ontology attributes or relations, trigger AI synthesis, and commit schema extensions transactionally.
5. **Workbench Integration**: Dedicated **Datasets** and **Reasoner** tabs in the left sidebar panel (`entity-type-tabs.tsx` and `left-browser-panel.tsx`) alongside Classes, Relations, and Standards.
