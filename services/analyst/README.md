# KG Workbench Analyst Microservice

Python microservice providing NetworkX graph analysis, graph-based question answering context retrieval, vector similarity search, and contradiction/semantic drift detection for KG Workbench.

## Overview

- **Port**: 8040 (Host) / 8000 (Internal container)
- **Engine**: NetworkX
- **Capabilities**:
  - `graph_qa`: Multi-hop graph traversal & subgraph extraction for retrieval-augmented generation.
  - `vector_search`: Vector similarity search and entity indexing.
  - `drift_detection`: Identification of value mismatches, temporal drifts, and polarity contradictions across extracted facts and tables.

## Configuration

The service can be configured via environment variables:

| Variable                          | Description                                    | Default            |
| --------------------------------- | ---------------------------------------------- | ------------------ |
| `WORKBENCH_API_URL`               | Base URL of the Workbench Next.js backend      | `http://app:3000`  |
| `ANALYST_WORKER_ID` / `WORKER_ID` | Unique identifier for this worker instance     | `analyst-worker-1` |
| `POLL_INTERVAL_SECONDS`           | Interval in seconds between job polling cycles | `1.0`              |
| `HEARTBEAT_INTERVAL_SECONDS`      | Interval in seconds between heartbeat pings    | `10.0`             |

## Endpoints

- `GET /health`: Healthcheck endpoint reporting status, worker ID, and engine.

## Running Tests

```bash
pytest
```
