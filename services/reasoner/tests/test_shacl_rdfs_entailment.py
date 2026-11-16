from reasoner.shacl_engine import validate_shacl_turtle


def test_validate_shacl_with_rdfs_entailment():
    shapes = """
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

    ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [
            sh:path ex:age ;
            sh:datatype xsd:integer ;
            sh:minCount 1 ;
        ] .
    """

    rdfs_ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/> .

    ex:Researcher rdfs:subClassOf ex:Person .
    """

    conforming_data = """
    @prefix ex: <http://example.org/> .

    ex:Alice a ex:Researcher ;
        ex:age 32 .
    """

    result = validate_shacl_turtle(
        data_graph_ttl=conforming_data,
        shapes_graph_ttl=shapes,
        inference="rdfs",
        rdfs_ttl=rdfs_ttl,
    )
    assert result["conforms"] is True

    non_conforming_data = """
    @prefix ex: <http://example.org/> .

    ex:Bob a ex:Researcher .
    """

    bad_result = validate_shacl_turtle(
        data_graph_ttl=non_conforming_data,
        shapes_graph_ttl=shapes,
        inference="rdfs",
        rdfs_ttl=rdfs_ttl,
    )
    assert bad_result["conforms"] is False
