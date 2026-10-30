# KG Workbench Reasoner Service

W3C SHACL and Oxigraph RDF reasoning microservice for KG Workbench.

## Capabilities

- **SHACL Shape Validation**: Pure W3C SHACL constraint validation over RDF data graphs via pySHACL and Oxigraph.
- **Entailment Materialization**: Computes RDFS / OWL 2 RL entailments and subclass closure.
- **Mesh Integration**: Heartbeat daemon communicating with KG Workbench Service Registry, leasing asynchronous jobs from PostgreSQL queue (`workerType='reasoner'`).

## Local Development

```bash
uv sync
uv run pytest
```
