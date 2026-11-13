import json
from typing import Any

from neo4j_graphrag.experimental.components.schema import GraphSchema

from .models import ExtractionRequest, SchemaAttribute


def description_or_fallback(value: str | None, fallback: str) -> str:
    return value or fallback


def _parse_json_schema_defs(raw_json_schema: str | None) -> dict[str, dict[str, Any]]:
    if not raw_json_schema:
        return {}
    try:
        parsed = json.loads(raw_json_schema)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    defs = parsed.get("$defs") or parsed.get("definitions") or {}
    return defs if isinstance(defs, dict) else {}


def to_graph_schema(request: ExtractionRequest) -> GraphSchema:
    json_defs = _parse_json_schema_defs(request.json_schema)
    node_types = []
    for node in request.extraction_schema.nodeTypes:
        class_def = json_defs.get(node.label, {})
        class_props = class_def.get("properties", {}) if isinstance(class_def, dict) else {}
        properties = list(node.properties)
        if not any(prop.name == "entity_text" for prop in properties):
            properties.insert(
                0,
                SchemaAttribute(
                    name="entity_text",
                    type="STRING",
                    description=(
                        "Short human-readable name for this entity, such as "
                        "the employee name, company name, product name, or "
                        "other natural display label from the document."
                    ),
                ),
            )

        node_description = node.description or (
            class_def.get("description") if isinstance(class_def, dict) else None
        )
        node_type: dict[str, Any] = {
            "label": node.label,
            "description": description_or_fallback(
                node_description, f"Ontology class {node.label}."
            ),
        }
        if properties:
            node_type["properties"] = [
                {
                    "name": prop.name,
                    "type": prop.type,
                    "description": description_or_fallback(
                        prop.description
                        or (
                            class_props.get(prop.name, {}).get("description")
                            if isinstance(class_props.get(prop.name), dict)
                            else None
                        ),
                        f"Ontology attribute {prop.name}.",
                    ),
                }
                for prop in properties
            ]
        node_types.append(node_type)

    return GraphSchema.model_validate(
        {
            "node_types": node_types,
            "relationship_types": [
                {
                    "label": rel.label,
                    "description": description_or_fallback(
                        rel.description, f"Ontology relation {rel.label}."
                    ),
                    "properties": [
                        {
                            "name": "evidence",
                            "type": "STRING",
                            "description": "Short source quote supporting the relation.",
                        },
                        {
                            "name": "section_title",
                            "type": "STRING",
                            "description": (
                                "Exact source heading when visible. If no heading is "
                                "visible, use a short human-readable topic label "
                                "for the local passage."
                            ),
                        },
                    ],
                }
                for rel in request.extraction_schema.relationshipTypes
            ],
            "patterns": request.extraction_schema.patterns,
            "additional_node_types": False,
        }
    )
