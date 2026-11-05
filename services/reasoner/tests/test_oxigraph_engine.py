import pytest
from reasoner.oxigraph_engine import analyze_ontology_consistency


def test_detects_disjointness_conflict():
    ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .

    ex:LivingThing a owl:Class .
    ex:InanimateThing a owl:Class ;
        owl:disjointWith ex:LivingThing .

    ex:Animal rdfs:subClassOf ex:LivingThing .
    ex:Rock rdfs:subClassOf ex:InanimateThing .

    # Conflict: Cyborg inherits from both LivingThing and InanimateThing
    ex:Cyborg rdfs:subClassOf ex:Animal, ex:Rock .
    """
    result = analyze_ontology_consistency(ttl)
    assert result["consistent"] is False
    assert len(result["violations"]) >= 1
    assert any("disjoint" in v["message"].lower() for v in result["violations"])


def test_detects_inheritance_cycles():
    ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/> .

    ex:A rdfs:subClassOf ex:B .
    ex:B rdfs:subClassOf ex:C .
    ex:C rdfs:subClassOf ex:A .
    """
    result = analyze_ontology_consistency(ttl)
    assert result["consistent"] is False
    assert any("cycle" in v["message"].lower() for v in result["violations"])


def test_computes_transitive_inferred_subclasses():
    ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/> .

    ex:A rdfs:subClassOf ex:B .
    ex:B rdfs:subClassOf ex:C .
    """
    result = analyze_ontology_consistency(ttl)
    assert result["consistent"] is True
    # Inferred: A subClassOf C
    inferred = result["inferredTriples"]
    assert any(
        t["subject"] == "http://example.org/A" and t["object"] == "http://example.org/C"
        for t in inferred
    )
