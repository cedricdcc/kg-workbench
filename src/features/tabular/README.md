---
feature: tabular
status: active
purpose: Multi-source tabular ingestion, DuckDB analytical profiling, and candidate schema induction.
scope:
  - Tabular dataset upload (CSV, Parquet, Excel)
  - DuckDB analytical profiling (inferred types, null ratios, sample values, candidate unique keys)
  - Tabular profiler inspector modal and data preview table
entry_points:
  - path: src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx
    purpose: Dialog inspecting column statistics, candidate primary keys, and data preview.
server_entry_points:
  - path: src/features/tabular/server/actions/profile-tabular-dataset.ts
    purpose: Server actions dispatching tabular.profile_requested domain events with fast-path resolution.
update_this_readme_when:
  - New tabular connectors (SQL databases, Delta tables) are added
  - Schema-to-ontology induction or PII masking pipelines are introduced
---

# Tabular Feature

High-performance tabular dataset profiling and ingestion powered by the `kg-workbench-tabular` DuckDB microservice sidecar.

