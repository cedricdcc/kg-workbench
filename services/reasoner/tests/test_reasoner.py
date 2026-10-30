from fastapi.testclient import TestClient
import pytest
from reasoner.main import app
from reasoner.shacl_engine import validate_shacl_turtle

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "kg-workbench-reasoner"


def test_info_endpoint():
    response = client.get("/reasoner/info")
    assert response.status_code == 200
    data = response.json()
    assert "shacl_validation" in data["capabilities"]


def test_validate_shacl_conforming():
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

    data = """
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

    ex:Alice a ex:Person ;
        ex:age 30 .
    """

    result = validate_shacl_turtle(data, shapes)
    assert result["conforms"] is True


def test_validate_shacl_non_conforming():
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

    # Alice is missing ex:age
    data = """
    @prefix ex: <http://example.org/> .

    ex:Alice a ex:Person .
    """

    result = validate_shacl_turtle(data, shapes)
    assert result["conforms"] is False

