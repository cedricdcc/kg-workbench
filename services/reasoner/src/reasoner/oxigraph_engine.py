import logging
from typing import Any
import pyoxigraph

logger = logging.getLogger("reasoner.oxigraph_engine")


def analyze_ontology_consistency(data_graph_ttl: str) -> dict[str, Any]:
    """Analyzes an RDF ontology in Turtle format using Oxigraph for disjointness, cycles, and entailments."""
    store = pyoxigraph.Store()
    try:
        format_val = getattr(pyoxigraph.RdfFormat, "TURTLE", "text/turtle")
        store.load(data_graph_ttl.encode("utf-8"), format_val)
    except Exception as exc:
        logger.exception("Failed to parse RDF turtle in Oxigraph: %s", exc)
        return {
            "consistent": False,
            "violations": [
                {
                    "severity": "Violation",
                    "focusNode": "rdf-parse",
                    "message": f"RDF parsing error: {exc}",
                    "source": "Oxigraph (Parser)",
                }
            ],
            "inferredTriples": [],
        }

    violations: list[dict[str, Any]] = []

    # 1. Check for Unsatisfiable Classes (Inheriting from mutually disjoint classes)
    disjoint_query = """
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT DISTINCT ?sub ?c1 ?c2 WHERE {
        ?sub rdfs:subClassOf* ?c1 .
        ?sub rdfs:subClassOf* ?c2 .
        { ?c1 owl:disjointWith ?c2 } UNION { ?c2 owl:disjointWith ?c1 } .
        FILTER(?c1 != ?c2)
    }
    """
    seen_disjoint_pairs = set()
    for sol in store.query(disjoint_query):
        sub = str(sol["sub"].value)
        c1 = str(sol["c1"].value)
        c2 = str(sol["c2"].value)
        pair_key = (sub, tuple(sorted([c1, c2])))
        if pair_key in seen_disjoint_pairs:
            continue
        seen_disjoint_pairs.add(pair_key)
        violations.append({
            "severity": "Violation",
            "focusNode": sub,
            "message": f"Class {sub} inherits from mutually disjoint classes {c1} and {c2}",
            "source": "Oxigraph (Disjointness)",
        })

    # 2. Check for Inheritance Cycles
    cycle_query = """
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?c WHERE {
        ?c rdfs:subClassOf+ ?c .
    }
    """
    seen_cycles = set()
    for sol in store.query(cycle_query):
        c = str(sol["c"].value)
        if c in seen_cycles:
            continue
        seen_cycles.add(c)
        violations.append({
            "severity": "Violation",
            "focusNode": c,
            "message": f"Inheritance cycle detected: class {c} transitively inherits from itself",
            "source": "Oxigraph (Cycle)",
        })

    # 3. Transitive Subclass Entailments
    inferred_query = """
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?sub ?super WHERE {
        ?sub rdfs:subClassOf+ ?super .
        FILTER(?sub != ?super)
        FILTER NOT EXISTS { ?sub rdfs:subClassOf ?super }
    }
    """
    inferred_triples: list[dict[str, Any]] = []
    seen_inferred = set()
    for sol in store.query(inferred_query):
        sub = str(sol["sub"].value)
        super_cls = str(sol["super"].value)
        key = (sub, super_cls)
        if key in seen_inferred:
            continue
        seen_inferred.add(key)
        inferred_triples.append({
            "subject": sub,
            "predicate": "rdfs:subClassOf",
            "object": super_cls,
            "derivation": "Transitively inferred via rdfs:subClassOf closure",
        })

    return {
        "consistent": len(violations) == 0,
        "violations": violations,
        "inferredTriples": inferred_triples,
    }
