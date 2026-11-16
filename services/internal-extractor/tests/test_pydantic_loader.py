import base64

import pytest

from internal_extractor.models import (
    ExtractionEntityAttribute,
    ExtractionEntityResult,
    ExtractionFactResult,
    ExtractionFile,
    ExtractionRequest,
    ExtractionResultsResponse,
    ExtractionSchema,
    ParagraphResult,
    SectionResult,
)
from internal_extractor.pydantic_loader import (
    UnsafePydanticCodeError,
    load_pydantic_extraction_models,
    validate_and_repair_entities,
    validate_pydantic_ast,
)

REALISTIC_LINKML_PYDANTIC = """
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EmploymentStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Person(BaseModel):
    name: str = Field(...)
    age: Optional[int] = Field(default=None, ge=0)
    score: Optional[float] = None
    active: Optional[bool] = None
    birth_date: Optional[date] = None
    status: Optional[EmploymentStatus] = None


class Organization(BaseModel):
    title: str
    founded_year: Optional[int] = None
"""


def test_load_realistic_linkml_pydantic_models_and_validate_attributes():
    loaded = load_pydantic_extraction_models(REALISTIC_LINKML_PYDANTIC)

    assert "Person" in loaded.models_by_name
    assert "Organization" in loaded.models_by_name

    attrs = [
        ExtractionEntityAttribute(attribute_name="name", value="Ada Lovelace"),
        ExtractionEntityAttribute(attribute_name="age", value="36"),
        ExtractionEntityAttribute(attribute_name="score", value="9.5"),
        ExtractionEntityAttribute(attribute_name="active", value="true"),
        ExtractionEntityAttribute(attribute_name="birth_date", value="1815-12-10"),
        ExtractionEntityAttribute(attribute_name="status", value="active"),
    ]
    validated, warnings = loaded.validate_entity_attributes("Person", attrs)

    assert warnings == []
    by_name = {a.attribute_name: a.value for a in validated}
    assert by_name["name"] == "Ada Lovelace"
    assert by_name["age"] == "36"
    assert by_name["score"] == "9.5"
    assert by_name["birth_date"] == "1815-12-10"
    assert by_name["status"] == "active"
    assert by_name["active"] in ("True", "true")


@pytest.mark.parametrize(
    "malicious_code",
    [
        'import os\nos.system("echo pwned")',
        '__import__("os").system("echo pwned")',
        'eval("1 + 1")',
        'open("/etc/passwd").read()',
        'import subprocess\nsubprocess.run(["ls"])',
        'from pydantic import BaseModel\nclass Evil(BaseModel):\n    x: int = eval("1")',
    ],
)
def test_ast_safety_gate_rejects_dangerous_code(malicious_code: str):
    with pytest.raises(UnsafePydanticCodeError):
        validate_pydantic_ast(malicious_code)

    with pytest.raises(UnsafePydanticCodeError):
        load_pydantic_extraction_models(malicious_code)


def test_validate_and_repair_entities_strips_only_invalid_attribute():
    loaded = load_pydantic_extraction_models(REALISTIC_LINKML_PYDANTIC)

    entities = [
        ExtractionEntityResult(
            temp_id="e1",
            text="Alice",
            className="Person",
            attributes=[
                ExtractionEntityAttribute(attribute_name="name", value="Alice"),
                ExtractionEntityAttribute(attribute_name="age", value="30"),
            ],
        ),
        ExtractionEntityResult(
            temp_id="e2",
            text="Bob",
            className="Person",
            attributes=[
                ExtractionEntityAttribute(attribute_name="name", value="Bob"),
                ExtractionEntityAttribute(attribute_name="age", value="unknown"),
                ExtractionEntityAttribute(attribute_name="active", value="true"),
            ],
        ),
        ExtractionEntityResult(
            temp_id="e3",
            text="Carol",
            className="Person",
            attributes=[
                ExtractionEntityAttribute(attribute_name="name", value="Carol"),
                ExtractionEntityAttribute(attribute_name="age", value="42"),
            ],
        ),
        ExtractionEntityResult(
            temp_id="e4",
            text="Acme",
            className="Organization",
            attributes=[
                ExtractionEntityAttribute(attribute_name="title", value="Acme"),
                ExtractionEntityAttribute(attribute_name="founded_year", value="1999"),
            ],
        ),
        ExtractionEntityResult(
            temp_id="e5",
            text="Globex",
            className="Organization",
            attributes=[
                ExtractionEntityAttribute(attribute_name="title", value="Globex"),
                ExtractionEntityAttribute(attribute_name="founded_year", value="2005"),
            ],
        ),
    ]
    facts = [
        ExtractionFactResult(
            subject_temp_id="e1",
            relation_text="worksFor",
            object_temp_id="e4",
            subjectClassName="Person",
            objectClassName="Organization",
            relationName="worksFor",
            confidence=0.95,
        ),
        ExtractionFactResult(
            subject_temp_id="e2",
            relation_text="worksFor",
            object_temp_id="e5",
            subjectClassName="Person",
            objectClassName="Organization",
            relationName="worksFor",
            confidence=0.90,
        ),
    ]
    result = ExtractionResultsResponse(
        sections=[
            SectionResult(
                id="sec-1",
                title="Overview",
                paragraphs=[ParagraphResult(id="p-1", content="Alice and Bob work.")],
            )
        ],
        entities=entities,
        facts=facts,
    )

    repaired = validate_and_repair_entities(loaded, result)

    assert len(repaired.entities) == 5
    assert len(repaired.facts) == 2

    bob = next(e for e in repaired.entities if e.temp_id == "e2")
    bob_attrs = {a.attribute_name: a.value for a in bob.attributes}
    assert "age" not in bob_attrs
    assert bob_attrs["name"] == "Bob"
    assert bob_attrs["active"] in ("True", "true")

    alice = next(e for e in repaired.entities if e.temp_id == "e1")
    assert {a.attribute_name: a.value for a in alice.attributes} == {
        "name": "Alice",
        "age": "30",
    }


def test_extraction_request_backward_compatibility_and_linkml_fields():
    base_kwargs = dict(
        documentId="doc-1",
        ontologyId="ont-1",
        modelName="gpt-4o-mini",
        provider="openai",
        apiKey="sk-test",
        file=ExtractionFile(
            name="doc.txt",
            contentType="text/plain",
            base64=base64.b64encode(b"Hello").decode("ascii"),
        ),
        schema=ExtractionSchema(
            nodeTypes=[{"label": "Person", "properties": []}],
            relationshipTypes=[{"label": "knows"}],
            patterns=[("Person", "knows", "Person")],
        ),
    )

    legacy_req = ExtractionRequest(**base_kwargs)
    assert legacy_req.linkml_yaml is None
    assert legacy_req.pydantic_code is None
    assert legacy_req.json_schema is None
    assert legacy_req.shacl_ttl is None
    assert legacy_req.rdfs_ttl is None
    assert legacy_req.ohi_lockfile is None
    assert legacy_req.ontology_sha256 is None

    full_req = ExtractionRequest(
        **base_kwargs,
        linkml_yaml="id: https://example.org/ont",
        pydantic_code=REALISTIC_LINKML_PYDANTIC,
        json_schema='{"$defs": {}}',
        shacl_ttl="@prefix sh: <http://www.w3.org/ns/shacl#> .",
        rdfs_ttl="@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        ohi_lockfile={"version": 1},
        ontology_sha256="abc123",
    )
    assert full_req.pydantic_code == REALISTIC_LINKML_PYDANTIC
    assert full_req.ontology_sha256 == "abc123"
    assert full_req.ohi_lockfile == {"version": 1}


def test_to_graph_schema_enriches_descriptions_from_json_schema():
    import json

    from internal_extractor.schema_mapper import to_graph_schema

    json_schema = json.dumps(
        {
            "$defs": {
                "Person": {
                    "description": "A human individual.",
                    "properties": {
                        "age": {"description": "Age in years."},
                    },
                }
            }
        }
    )
    request = ExtractionRequest(
        documentId="doc-2",
        ontologyId="ont-2",
        modelName="llama3.1",
        provider="ollama",
        file=ExtractionFile(
            name="doc.txt",
            contentType="text/plain",
            base64=base64.b64encode(b"Alice is 30.").decode("ascii"),
        ),
        schema=ExtractionSchema(
            nodeTypes=[
                {
                    "label": "Person",
                    "description": None,
                    "properties": [{"name": "age", "type": "INTEGER", "description": None}],
                }
            ],
            relationshipTypes=[],
            patterns=[],
        ),
        json_schema=json_schema,
    )

    dumped = to_graph_schema(request).model_dump()
    assert dumped["node_types"][0]["description"] == "A human individual."
    age_prop = next(
        p for p in dumped["node_types"][0]["properties"] if p["name"] == "age"
    )
    assert age_prop["description"] == "Age in years."


@pytest.mark.asyncio
async def test_run_extraction_validates_and_repairs_for_ollama(monkeypatch):
    from neo4j_graphrag.experimental.components.types import Neo4jGraph, Neo4jNode

    from internal_extractor import kg_builder

    class FakeExtractor:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        async def run(self, chunks, schema):
            del chunks, schema
            return Neo4jGraph(
                nodes=[
                    Neo4jNode(
                        id="0:1",
                        label="Person",
                        properties={"name": "Bob", "age": "unknown", "active": "true"},
                    )
                ],
                relationships=[],
            )

    monkeypatch.setattr(kg_builder, "create_llm", lambda *args, **kwargs: object())
    monkeypatch.setattr(kg_builder, "LLMEntityRelationExtractor", FakeExtractor)

    request = ExtractionRequest(
        documentId="doc-3",
        ontologyId="ont-3",
        modelName="llama3.1",
        provider="ollama",
        file=ExtractionFile(
            name="doc.txt",
            contentType="text/plain",
            base64=base64.b64encode(b"Bob is active.").decode("ascii"),
        ),
        schema=ExtractionSchema(
            nodeTypes=[
                {
                    "label": "Person",
                    "properties": [
                        {"name": "name", "type": "STRING"},
                        {"name": "age", "type": "INTEGER"},
                        {"name": "active", "type": "BOOLEAN"},
                    ],
                }
            ],
            relationshipTypes=[],
            patterns=[],
        ),
        pydantic_code=REALISTIC_LINKML_PYDANTIC,
    )

    result = await kg_builder.run_extraction(request)
    assert len(result.entities) == 1
    attrs = {a.attribute_name: a.value for a in result.entities[0].attributes}
    assert "age" not in attrs
    assert attrs["name"] == "Bob"
    assert attrs["active"] in ("True", "true")

