# Tabular Ingestion & Profiling Worker (`kg-workbench-tabular`)

High-performance DuckDB sidecar service for structured tabular dataset ingestion, schema profiling, and candidate primary/foreign key detection.

## Capabilities
- **Multi-Format Ingestion**: Ingests CSV, Parquet, and Excel (`.xlsx`) files.
- **Analytical Profiling**: Computes column data types, null ratios, distinct counts, sample distributions, and candidate keys.
- **Transactional Outbox Worker**: Claims and completes `tabular.profile_requested` jobs from the KG Workbench PostgreSQL queue.

