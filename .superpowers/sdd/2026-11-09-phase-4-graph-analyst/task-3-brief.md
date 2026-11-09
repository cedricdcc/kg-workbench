# Task 3: In-Memory Multi-Hop Graph Traversal Engine

**Files:**

- Create: `services/analyst/src/analyst/graph_engine.py`
- Create: `services/analyst/tests/test_graph_engine.py`

## Instructions

1. **`services/analyst/src/analyst/graph_engine.py`**:
   - Uses `networkx` to build and traverse directed multigraphs representing the knowledge graph.
   - Graph Construction:
     - Nodes: Entities (with class label, attributes, source document/table).
     - Edges: Relations (with relation name, confidence, review status, fact ID).
   - Functions:
     - `build_knowledge_graph(facts: list[dict], entities: list[dict] = None, tables: list[dict] = None) -> nx.MultiDiGraph`
     - `find_query_anchor_nodes(graph: nx.MultiDiGraph, query_tokens: list[str]) -> list[str]`
     - `extract_subgraph_for_query(graph: nx.MultiDiGraph, query: str, max_hops: int = 2) -> dict`:
       Extracts relevant subgraph around matched entities up to `max_hops`.
       Returns `{ "nodes": [...], "edges": [...] }` suitable for JSON serialization back to Workbench.
     - `format_triples_for_prompt(subgraph_data: dict) -> list[str]`:
       Returns human-readable triples: `"(Subject) --[relation]--> (Object)"`.

2. **`services/analyst/tests/test_graph_engine.py`**:
   - Test building graph from sample accepted facts.
   - Test 1-hop and 2-hop neighborhood traversal.
   - Test serialization format matching Workbench React Flow expected node/edge shapes:
     `nodes: [{ "id": ..., "label": ..., "kind": ... }]`
     `edges: [{ "id": ..., "source": ..., "target": ..., "label": ... }]`

3. Commit:
   `git add services/analyst/src/analyst/graph_engine.py services/analyst/tests/test_graph_engine.py`
   `git commit -m "feat(analyst): implement networkx multi-hop graph traversal engine"`
