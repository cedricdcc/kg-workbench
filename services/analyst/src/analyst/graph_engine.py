import re
from typing import Any, Optional
import networkx as nx

STOPWORDS = {
    "a", "an", "the", "in", "on", "of", "to", "is", "are", "was", "were",
    "at", "by", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "from", "up",
    "down", "and", "or", "but", "so", "if", "what", "which", "who", "whom",
    "this", "that", "these", "those", "am", "be", "been", "being", "have",
    "has", "had", "do", "does", "did", "can", "could", "shall", "should",
    "will", "would", "may", "might", "must", "it", "its", "tell", "me"
}


def build_knowledge_graph(
    facts: list[dict[str, Any]],
    entities: Optional[list[dict[str, Any]]] = None,
    tables: Optional[list[dict[str, Any]]] = None,
) -> nx.MultiDiGraph:
    """
    Build a NetworkX MultiDiGraph representing the knowledge graph.

    Nodes represent entities (with label, class_label / kind, attributes, source).
    Edges represent relations (with label, relation name, confidence, review_status, fact_id).
    """
    graph = nx.MultiDiGraph()
    label_to_id: dict[str, str] = {}

    def register_node(
        node_id: str,
        label: str,
        kind: str = "Entity",
        attributes: Optional[dict[str, Any]] = None,
        source: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        canonical_id = str(node_id).strip()
        display_label = str(label or canonical_id).strip()
        node_kind = str(kind or "Entity").strip()
        attrs = dict(attributes or {})
        meta = dict(metadata or {})

        if canonical_id in graph:
            # Merge / enrich existing node
            existing = graph.nodes[canonical_id]
            if not existing.get("attributes"):
                existing["attributes"] = attrs
            else:
                existing["attributes"].update(attrs)
            if node_kind != "Entity" and existing.get("kind") == "Entity":
                existing["kind"] = node_kind
            if source and not existing.get("source"):
                existing["source"] = source
            if meta:
                existing["metadata"].update(meta)
        else:
            graph.add_node(
                canonical_id,
                id=canonical_id,
                label=display_label,
                kind=node_kind,
                attributes=attrs,
                source=source,
                metadata=meta,
            )

        if display_label:
            label_to_id[display_label.lower()] = canonical_id
        return canonical_id

    def resolve_entity_id(
        explicit_id: Optional[Any],
        name_or_text: Optional[Any],
        default_kind: str = "Entity",
        default_source: Optional[str] = None,
    ) -> str:
        text_str = str(name_or_text).strip() if name_or_text is not None else ""
        id_str = str(explicit_id).strip() if explicit_id is not None else ""

        if id_str and id_str in graph:
            return id_str
        if text_str and text_str.lower() in label_to_id:
            return label_to_id[text_str.lower()]

        # New entity to register
        chosen_id = id_str if id_str else text_str
        chosen_label = text_str if text_str else id_str
        return register_node(
            node_id=chosen_id,
            label=chosen_label,
            kind=default_kind,
            source=default_source,
        )

    # 1. Register explicit entities if provided
    if entities:
        for ent in entities:
            ent_id = (
                ent.get("id")
                or ent.get("entity_id")
                or ent.get("entityId")
                or ent.get("label")
                or ent.get("name")
                or ent.get("entity_text")
            )
            if not ent_id:
                continue
            label = (
                ent.get("label")
                or ent.get("name")
                or ent.get("entity_text")
                or ent.get("entityText")
                or ent_id
            )
            kind = (
                ent.get("kind")
                or ent.get("class_label")
                or ent.get("className")
                or ent.get("class_name")
                or ent.get("class_id")
                or "Entity"
            )
            attributes = ent.get("attributes") or ent.get("properties") or {}
            source = (
                ent.get("source")
                or ent.get("document_id")
                or ent.get("documentId")
                or ent.get("source_document")
                or ent.get("table_id")
                or ent.get("table")
            )
            metadata = ent.get("metadata") or {}
            register_node(
                node_id=str(ent_id),
                label=str(label),
                kind=str(kind),
                attributes=attributes,
                source=source,
                metadata=metadata,
            )

    # Helper to add a fact/relation to the graph
    def add_fact_to_graph(fact: dict[str, Any], default_source: Optional[str] = None):
        sub_id = (
            fact.get("subject_entity_id")
            or fact.get("subjectEntityId")
            or fact.get("subject_id")
        )
        sub_text = (
            fact.get("subject")
            or fact.get("subject_text")
            or fact.get("subjectText")
            or fact.get("subject_entity")
            or fact.get("source")
        )
        sub_class = (
            fact.get("subject_class")
            or fact.get("subject_class_name")
            or fact.get("subjectClassName")
            or fact.get("subject_kind")
            or "Entity"
        )

        obj_id = (
            fact.get("object_entity_id")
            or fact.get("objectEntityId")
            or fact.get("object_id")
        )
        obj_text = (
            fact.get("object")
            or fact.get("object_text")
            or fact.get("objectText")
            or fact.get("object_entity")
            or fact.get("target")
        )
        obj_class = (
            fact.get("object_class")
            or fact.get("object_class_name")
            or fact.get("objectClassName")
            or fact.get("object_kind")
            or "Entity"
        )

        doc_source = (
            fact.get("document_id")
            or fact.get("documentId")
            or fact.get("document_title")
            or fact.get("documentTitle")
            or default_source
        )

        u = resolve_entity_id(sub_id, sub_text, sub_class, doc_source)
        v = resolve_entity_id(obj_id, obj_text, obj_class, doc_source)

        rel = (
            fact.get("relation")
            or fact.get("relation_text")
            or fact.get("relationText")
            or fact.get("relation_name")
            or fact.get("predicate")
            or fact.get("label")
            or "related_to"
        )
        rel_str = str(rel).strip()

        fact_id = (
            fact.get("id")
            or fact.get("fact_id")
            or fact.get("factId")
            or f"{u}-{rel_str}-{v}-{graph.number_of_edges()}"
        )
        fact_id_str = str(fact_id)

        raw_conf = fact.get("confidence")
        confidence = float(raw_conf) if raw_conf is not None else 1.0
        review_status = str(fact.get("review_status") or fact.get("reviewStatus") or "accepted")

        edge_metadata = dict(fact.get("metadata") or {})
        if doc_source and "source" not in edge_metadata:
            edge_metadata["source"] = doc_source

        graph.add_edge(
            u,
            v,
            key=fact_id_str,
            id=fact_id_str,
            source=u,
            target=v,
            label=rel_str,
            relation=rel_str,
            confidence=confidence,
            review_status=review_status,
            fact_id=fact_id_str,
            metadata=edge_metadata,
        )

    # 2. Add edges from facts
    if facts:
        for f in facts:
            add_fact_to_graph(f)

    # 3. Add information from tables if provided
    if tables:
        for table in tables:
            table_source = str(table.get("name") or table.get("id") or "table")

            # Table can contain nested facts
            if "facts" in table and isinstance(table["facts"], list):
                for f in table["facts"]:
                    add_fact_to_graph(f, default_source=table_source)

            # Table can contain nested entities
            if "entities" in table and isinstance(table["entities"], list):
                for ent in table["entities"]:
                    ent_id = ent.get("id") or ent.get("label") or ent.get("name")
                    if ent_id:
                        register_node(
                            node_id=str(ent_id),
                            label=str(ent.get("label") or ent.get("name") or ent_id),
                            kind=str(ent.get("kind") or "Entity"),
                            attributes=ent.get("attributes") or {},
                            source=table_source,
                        )

            # Table can contain rows
            if "rows" in table and isinstance(table["rows"], list):
                for row in table["rows"]:
                    # Row might be a fact-like dictionary
                    if ("subject" in row or "subject_text" in row) and (
                        "object" in row or "object_text" in row
                    ):
                        add_fact_to_graph(row, default_source=table_source)
                    elif (
                        "source" in row
                        and "target" in row
                        and ("label" in row or "relation" in row)
                    ):
                        add_fact_to_graph(row, default_source=table_source)

    return graph


def find_query_anchor_nodes(
    graph: nx.MultiDiGraph, query_tokens: list[str] | str
) -> list[str]:
    """
    Find anchor node IDs in graph that match the given query tokens.
    """
    if not graph or not query_tokens:
        return []

    if isinstance(query_tokens, str):
        raw_tokens = re.findall(r"\w+", query_tokens)
    else:
        raw_tokens = []
        for item in query_tokens:
            if isinstance(item, str):
                raw_tokens.extend(re.findall(r"\w+", item))

    clean_tokens = [t.lower().strip() for t in raw_tokens if t.strip()]
    if not clean_tokens:
        return []

    matched_scores: dict[str, int] = {}

    for node_id in graph.nodes:
        node_data = graph.nodes[node_id]
        label = str(node_data.get("label", node_id)).lower()
        id_str = str(node_id).lower()
        label_words = set(re.findall(r"\w+", label))

        score = 0
        for token in clean_tokens:
            # Skip very short stopwords from matching
            if token in STOPWORDS and len(token) <= 3:
                continue

            # Exact label or id match
            if token == label or token == id_str:
                score += 10
            # Exact word match within label
            elif token in label_words:
                score += 5
            # Substring match (if token is not tiny)
            elif len(token) >= 3 and (token in label or token in id_str):
                score += 2

        if score > 0:
            matched_scores[str(node_id)] = score

    # Sort matched nodes by score descending
    sorted_nodes = sorted(
        matched_scores.keys(), key=lambda n: matched_scores[n], reverse=True
    )
    return sorted_nodes


def extract_subgraph_for_query(
    graph: nx.MultiDiGraph, query: str, max_hops: int = 2
) -> dict[str, list[dict[str, Any]]]:
    """
    Extracts relevant subgraph around matched entities up to max_hops.
    Returns { "nodes": [...], "edges": [...] } matching Workbench React Flow expected shapes.
    """
    if not graph or not query or not query.strip():
        return {"nodes": [], "edges": []}

    query_lower = query.lower()

    # 1. Identify anchor nodes:
    # First priority: direct entity label phrase appearance in query
    direct_anchors: list[tuple[int, str]] = []
    for node_id in graph.nodes:
        label = str(graph.nodes[node_id].get("label", node_id)).lower()
        # Look for full label substring (require at least 2 chars to avoid single-letter collisions)
        if len(label) >= 2 and label in query_lower:
            direct_anchors.append((len(label), str(node_id)))

    # Sort longer phrases first
    direct_anchors.sort(key=lambda x: x[0], reverse=True)
    anchor_candidates = [n_id for _, n_id in direct_anchors]

    # Second priority: token-based matching
    tokens = re.findall(r"\w+", query)
    token_anchors = find_query_anchor_nodes(graph, tokens)

    # Combine unique anchors preserving priority
    anchors: list[str] = []
    seen_anchors = set()
    for a in anchor_candidates + token_anchors:
        if a not in seen_anchors and a in graph:
            seen_anchors.add(a)
            anchors.append(a)

    if not anchors:
        return {"nodes": [], "edges": []}

    # 2. Multi-hop traversal (bidirectional exploration)
    visited_nodes = set(anchors)
    current_layer = set(anchors)

    for _ in range(max_hops):
        next_layer = set()
        for node in current_layer:
            for nbr in graph.successors(node):
                if nbr not in visited_nodes:
                    visited_nodes.add(nbr)
                    next_layer.add(nbr)
            for nbr in graph.predecessors(node):
                if nbr not in visited_nodes:
                    visited_nodes.add(nbr)
                    next_layer.add(nbr)
        current_layer = next_layer
        if not current_layer:
            break

    # 3. Build React Flow compliant nodes and edges
    sub = graph.subgraph(visited_nodes)

    serialized_nodes: list[dict[str, Any]] = []
    for n in visited_nodes:
        data = graph.nodes[n]
        kind = str(data.get("kind") or data.get("class_label") or "Entity")
        label = str(data.get("label", n))
        attributes = data.get("attributes", {})
        source = data.get("source")
        meta = dict(data.get("metadata", {}))

        serialized_nodes.append({
            "id": str(n),
            "label": label,
            "kind": kind,
            "attributes": attributes,
            "source": source,
            "metadata": meta,
        })

    serialized_edges: list[dict[str, Any]] = []
    seen_edge_ids: set[str] = set()

    for u, v, key, data in sub.edges(keys=True, data=True):
        raw_id = data.get("id") or data.get("fact_id") or key or f"{u}-{data.get('label', 'rel')}-{v}"
        edge_id = str(raw_id)
        candidate_id = edge_id
        counter = 1
        while candidate_id in seen_edge_ids:
            candidate_id = f"{edge_id}_{counter}"
            counter += 1
        seen_edge_ids.add(candidate_id)

        rel = str(data.get("label") or data.get("relation") or "related_to")
        raw_conf = data.get("confidence")
        confidence = float(raw_conf) if raw_conf is not None else 1.0
        review_status = str(data.get("review_status") or "accepted")
        fact_id = str(data.get("fact_id") or edge_id)

        serialized_edges.append({
            "id": candidate_id,
            "source": str(u),
            "target": str(v),
            "label": rel,
            "relation": rel,
            "confidence": confidence,
            "review_status": review_status,
            "fact_id": fact_id,
            "metadata": dict(data.get("metadata", {})),
        })

    return {
        "nodes": serialized_nodes,
        "edges": serialized_edges,
    }


def format_triples_for_prompt(subgraph_data: dict[str, Any] | nx.MultiDiGraph) -> list[str]:
    """
    Format knowledge subgraph as human-readable triples:
    \"(Subject) --[relation]--> (Object)\"
    """
    if not subgraph_data:
        return []

    # Handle nx.Graph instance directly if passed
    if isinstance(subgraph_data, nx.Graph):
        triples: list[str] = []
        seen = set()
        for u, v, data in subgraph_data.edges(data=True):
            u_label = subgraph_data.nodes[u].get("label", str(u))
            v_label = subgraph_data.nodes[v].get("label", str(v))
            rel = data.get("label") or data.get("relation") or "related_to"
            triple_str = f"({u_label}) --[{rel}]--> ({v_label})"
            if triple_str not in seen:
                seen.add(triple_str)
                triples.append(triple_str)
        return triples

    nodes = subgraph_data.get("nodes", [])
    edges = subgraph_data.get("edges", [])

    node_labels: dict[str, str] = {
        str(n["id"]): str(n.get("label", n["id"]))
        for n in nodes
        if "id" in n
    }

    triples = []
    seen = set()
    for edge in edges:
        source_id = str(edge.get("source", ""))
        target_id = str(edge.get("target", ""))
        rel = str(edge.get("label") or edge.get("relation") or "related_to")

        source_label = node_labels.get(source_id, source_id)
        target_label = node_labels.get(target_id, target_id)

        triple_str = f"({source_label}) --[{rel}]--> ({target_label})"
        if triple_str not in seen:
            seen.add(triple_str)
            triples.append(triple_str)

    return triples
