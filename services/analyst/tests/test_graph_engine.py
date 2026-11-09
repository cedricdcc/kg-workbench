import json
import networkx as nx
import pytest

from analyst.graph_engine import (
    build_knowledge_graph,
    find_query_anchor_nodes,
    extract_subgraph_for_query,
    format_triples_for_prompt,
)


@pytest.fixture
def sample_facts():
    return [
        {
            "id": "fact-1",
            "subject": "Acme Corp",
            "relation": "headquartered_in",
            "object": "Stockholm",
            "confidence": 0.98,
            "review_status": "accepted",
            "document_id": "doc-annual-report",
            "subject_class": "Organization",
            "object_class": "Location",
        },
        {
            "id": "fact-2",
            "subject": "Alice Smith",
            "relation": "chief_executive_officer_of",
            "object": "Acme Corp",
            "confidence": 0.95,
            "review_status": "accepted",
            "document_id": "doc-annual-report",
            "subject_class": "Person",
            "object_class": "Organization",
        },
        {
            "id": "fact-3",
            "subject": "Acme Corp",
            "relation": "developed_product",
            "object": "Widget Pro",
            "confidence": 0.92,
            "review_status": "accepted",
            "document_id": "doc-tech-spec",
            "subject_class": "Organization",
            "object_class": "Product",
        },
        {
            "id": "fact-4",
            "subject": "Widget Pro",
            "relation": "compatible_with",
            "object": "Cloud Platform X",
            "confidence": 0.88,
            "review_status": "accepted",
            "document_id": "doc-tech-spec",
            "subject_class": "Product",
            "object_class": "Platform",
        },
        {
            "id": "fact-5",
            "subject": "Cloud Platform X",
            "relation": "operated_by",
            "object": "Global Tech",
            "confidence": 0.90,
            "review_status": "accepted",
            "document_id": "doc-infra",
            "subject_class": "Platform",
            "object_class": "Organization",
        },
    ]


@pytest.fixture
def sample_entities():
    return [
        {
            "id": "ent-acme",
            "label": "Acme Corp",
            "kind": "Organization",
            "attributes": {"founded": 2012, "ticker": "ACME"},
            "source": "doc-annual-report",
        },
        {
            "id": "ent-alice",
            "label": "Alice Smith",
            "kind": "Person",
            "attributes": {"role": "CEO"},
            "source": "doc-annual-report",
        },
        {
            "id": "ent-widget",
            "label": "Widget Pro",
            "kind": "Product",
            "attributes": {"version": "2.0"},
            "source": "doc-tech-spec",
        },
    ]


def test_build_knowledge_graph_from_facts(sample_facts):
    graph = build_knowledge_graph(sample_facts)

    assert isinstance(graph, nx.MultiDiGraph)
    # Check node count and edge count
    assert "Acme Corp" in graph
    assert "Stockholm" in graph
    assert "Alice Smith" in graph
    assert "Widget Pro" in graph
    assert "Cloud Platform X" in graph
    assert "Global Tech" in graph

    # Verify node attributes
    acme_node = graph.nodes["Acme Corp"]
    assert acme_node["label"] == "Acme Corp"
    assert acme_node["kind"] == "Organization"

    # Verify edge attributes
    edges = list(graph.edges(data=True))
    assert len(edges) == 5

    # Check specific edge
    edge_data = graph.get_edge_data("Acme Corp", "Stockholm")
    assert edge_data is not None
    # For MultiDiGraph, edge_data is a dict keyed by edge key
    first_key = next(iter(edge_data))
    first_edge = edge_data[first_key]
    assert first_edge["label"] == "headquartered_in"
    assert first_edge["confidence"] == 0.98
    assert first_edge["review_status"] == "accepted"
    assert first_edge["fact_id"] == "fact-1"


def test_build_knowledge_graph_with_entities_and_tables(sample_facts, sample_entities):
    sample_tables = [
        {
            "id": "table-vendors",
            "name": "Supplier Table",
            "rows": [
                {
                    "subject": "Acme Corp",
                    "relation": "sources_materials_from",
                    "object": "Nordic Metals",
                    "confidence": 0.85,
                    "review_status": "accepted",
                }
            ],
        }
    ]

    graph = build_knowledge_graph(
        sample_facts,
        entities=sample_entities,
        tables=sample_tables,
    )

    # Check entity attributes propagated
    assert "ent-acme" in graph or "Acme Corp" in graph
    node_id = "ent-acme" if "ent-acme" in graph else "Acme Corp"
    acme_node = graph.nodes[node_id]
    assert acme_node["attributes"]["ticker"] == "ACME"
    assert acme_node["kind"] == "Organization"

    # Check table edge added
    found_table_edge = False
    for u, v, data in graph.edges(data=True):
        if data.get("label") == "sources_materials_from":
            found_table_edge = True
            break
    assert found_table_edge, "Edge from table was not found in graph"


def test_find_query_anchor_nodes(sample_facts):
    graph = build_knowledge_graph(sample_facts)

    # Search for Acme
    anchors = find_query_anchor_nodes(graph, ["acme"])
    assert len(anchors) >= 1
    assert any("acme" in graph.nodes[n]["label"].lower() for n in anchors)

    # Search for Alice and Stockholm
    anchors_multi = find_query_anchor_nodes(graph, ["alice", "stockholm"])
    labels = [graph.nodes[n]["label"] for n in anchors_multi]
    assert "Alice Smith" in labels
    assert "Stockholm" in labels

    # Search with no match
    anchors_none = find_query_anchor_nodes(graph, ["nonexistent_token_xyz"])
    assert anchors_none == []


def test_extract_subgraph_1_hop(sample_facts):
    graph = build_knowledge_graph(sample_facts)

    # Acme Corp connects to:
    # Incoming: Alice Smith -> Acme Corp
    # Outgoing: Acme Corp -> Stockholm, Acme Corp -> Widget Pro
    # 1 hop around Acme Corp should include: Acme Corp, Alice Smith, Stockholm, Widget Pro
    # It should NOT include Cloud Platform X (2 hops) or Global Tech (3 hops)
    subgraph = extract_subgraph_for_query(graph, "Tell me about Acme Corp", max_hops=1)

    node_labels = {n["label"] for n in subgraph["nodes"]}
    assert "Acme Corp" in node_labels
    assert "Alice Smith" in node_labels
    assert "Stockholm" in node_labels
    assert "Widget Pro" in node_labels
    assert "Cloud Platform X" not in node_labels
    assert "Global Tech" not in node_labels

    # Check edges
    edge_labels = {e["label"] for e in subgraph["edges"]}
    assert "headquartered_in" in edge_labels
    assert "chief_executive_officer_of" in edge_labels
    assert "developed_product" in edge_labels
    assert "compatible_with" not in edge_labels


def test_extract_subgraph_2_hop(sample_facts):
    graph = build_knowledge_graph(sample_facts)

    # 2 hops around Acme Corp:
    # 1 hop: Acme Corp, Alice Smith, Stockholm, Widget Pro
    # 2 hops: adds Cloud Platform X (Widget Pro -> Cloud Platform X)
    # It should NOT include Global Tech (3 hops away: Acme -> Widget -> Cloud -> Global Tech)
    subgraph = extract_subgraph_for_query(graph, "What does Acme Corp do?", max_hops=2)

    node_labels = {n["label"] for n in subgraph["nodes"]}
    assert "Acme Corp" in node_labels
    assert "Widget Pro" in node_labels
    assert "Cloud Platform X" in node_labels
    assert "Global Tech" not in node_labels

    edge_labels = {e["label"] for e in subgraph["edges"]}
    assert "compatible_with" in edge_labels
    assert "operated_by" not in edge_labels


def test_serialization_format_matches_workbench(sample_facts):
    graph = build_knowledge_graph(sample_facts)
    subgraph = extract_subgraph_for_query(graph, "Acme Corp", max_hops=1)

    # Expected node shape: [{ "id": ..., "label": ..., "kind": ... }]
    for node in subgraph["nodes"]:
        assert "id" in node
        assert "label" in node
        assert "kind" in node
        assert isinstance(node["id"], str)
        assert isinstance(node["label"], str)
        assert isinstance(node["kind"], str)

    # Expected edge shape: [{ "id": ..., "source": ..., "target": ..., "label": ... }]
    for edge in subgraph["edges"]:
        assert "id" in edge
        assert "source" in edge
        assert "target" in edge
        assert "label" in edge
        assert isinstance(edge["id"], str)
        assert isinstance(edge["source"], str)
        assert isinstance(edge["target"], str)
        assert isinstance(edge["label"], str)

    # JSON serializability test
    json_str = json.dumps(subgraph)
    loaded = json.loads(json_str)
    assert len(loaded["nodes"]) == len(subgraph["nodes"])
    assert len(loaded["edges"]) == len(subgraph["edges"])


def test_format_triples_for_prompt(sample_facts):
    graph = build_knowledge_graph(sample_facts)
    subgraph = extract_subgraph_for_query(graph, "Widget Pro", max_hops=1)

    triples = format_triples_for_prompt(subgraph)
    assert isinstance(triples, list)
    assert len(triples) > 0

    # Each triple must match "(Subject) --[relation]--> (Object)"
    for triple in triples:
        assert triple.startswith("(")
        assert ") --[" in triple
        assert "]--> (" in triple
        assert triple.endswith(")")

    # Widget Pro connects to Acme Corp (incoming) and Cloud Platform X (outgoing)
    assert any(
        "(Acme Corp) --[developed_product]--> (Widget Pro)" in t for t in triples
    )
    assert any(
        "(Widget Pro) --[compatible_with]--> (Cloud Platform X)" in t for t in triples
    )


def test_empty_and_no_match_queries(sample_facts):
    graph = build_knowledge_graph(sample_facts)

    empty_subgraph = extract_subgraph_for_query(graph, "completely unknown term zz99")
    assert empty_subgraph == {"nodes": [], "edges": []}

    empty_triples = format_triples_for_prompt(empty_subgraph)
    assert empty_triples == []


def test_multigraph_multiple_edges():
    facts = [
        {
            "id": "fact-10",
            "subject": "Alice",
            "relation": "founder_of",
            "object": "Acme",
            "confidence": 0.99,
        },
        {
            "id": "fact-11",
            "subject": "Alice",
            "relation": "board_member_of",
            "object": "Acme",
            "confidence": 0.95,
        },
    ]
    graph = build_knowledge_graph(facts)
    assert graph.number_of_edges() == 2

    subgraph = extract_subgraph_for_query(graph, "Alice", max_hops=1)
    assert len(subgraph["edges"]) == 2
    rel_labels = {e["label"] for e in subgraph["edges"]}
    assert rel_labels == {"founder_of", "board_member_of"}

    triples = format_triples_for_prompt(subgraph)
    assert len(triples) == 2
    assert "(Alice) --[founder_of]--> (Acme)" in triples
    assert "(Alice) --[board_member_of]--> (Acme)" in triples


def test_cyclic_graph_traversal():
    cyclic_facts = [
        {"id": "c1", "subject": "NodeA", "relation": "links_to", "object": "NodeB"},
        {"id": "c2", "subject": "NodeB", "relation": "links_to", "object": "NodeC"},
        {"id": "c3", "subject": "NodeC", "relation": "links_to", "object": "NodeA"},
    ]
    graph = build_knowledge_graph(cyclic_facts)
    subgraph = extract_subgraph_for_query(graph, "NodeA", max_hops=5)
    node_labels = {n["label"] for n in subgraph["nodes"]}
    assert node_labels == {"NodeA", "NodeB", "NodeC"}
    assert len(subgraph["edges"]) == 3


def test_0_hops_and_3_hops(sample_facts):
    graph = build_knowledge_graph(sample_facts)

    # 0 hops: only the anchor node itself
    sub_0 = extract_subgraph_for_query(graph, "Acme Corp", max_hops=0)
    node_labels_0 = {n["label"] for n in sub_0["nodes"]}
    assert node_labels_0 == {"Acme Corp"}
    assert len(sub_0["edges"]) == 0

    # 3 hops: reaches Global Tech (Acme -> Widget -> Cloud -> Global Tech)
    sub_3 = extract_subgraph_for_query(graph, "Acme Corp", max_hops=3)
    node_labels_3 = {n["label"] for n in sub_3["nodes"]}
    assert "Global Tech" in node_labels_3
    edge_labels_3 = {e["label"] for e in sub_3["edges"]}
    assert "operated_by" in edge_labels_3


def test_format_triples_directly_from_graph(sample_facts):
    graph = build_knowledge_graph(sample_facts[:2])
    triples = format_triples_for_prompt(graph)
    assert len(triples) == 2
    assert any("headquartered_in" in t for t in triples)
    assert any("chief_executive_officer_of" in t for t in triples)


def test_find_query_anchor_nodes_string_input(sample_facts):
    graph = build_knowledge_graph(sample_facts)
    anchors = find_query_anchor_nodes(graph, "Where is Stockholm located?")
    assert len(anchors) >= 1
    assert any("Stockholm" == graph.nodes[n]["label"] for n in anchors)

