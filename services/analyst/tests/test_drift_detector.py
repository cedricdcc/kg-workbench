import pytest
from analyst.drift_detector import detect_knowledge_contradictions


def test_functional_relation_value_mismatch_cross_document():
    facts = [
        {
            "id": "fact-1",
            "subject": "Acme Corp",
            "relation": "headquarters",
            "object": "Stockholm",
            "document_title": "Doc 1 - Annual Report 2023",
            "quote_text": "Acme Corp is headquartered in Stockholm, Sweden.",
            "created_at": "2023-05-01T10:00:00Z",
        },
        {
            "id": "fact-2",
            "subject": "Acme Corp",
            "relation": "headquarters",
            "object": "Helsinki",
            "document_title": "Doc 2 - Corporate Overview 2024",
            "quote_text": "Acme Corp maintains its corporate headquarters in Helsinki.",
            "created_at": "2024-01-15T12:00:00Z",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 1

    c = contradictions[0]
    assert c["entity_label"] == "Acme Corp"
    assert c["relation_name"] == "headquarters"
    assert c["conflict_type"] == "value_mismatch"
    assert c["status"] == "open"
    assert c["resolution_action"] is None

    # Check fact_a and fact_b structures
    values = {c["fact_a"]["value"], c["fact_b"]["value"]}
    assert values == {"Stockholm", "Helsinki"}

    docs = {c["fact_a"]["documentTitle"], c["fact_b"]["documentTitle"]}
    assert docs == {"Doc 1 - Annual Report 2023", "Doc 2 - Corporate Overview 2024"}

    # Explanation should describe the conflict clearly and suggest a resolution
    assert "Acme Corp" in c["explanation"]
    assert "headquarters" in c["explanation"]
    assert "Stockholm" in c["explanation"]
    assert "Helsinki" in c["explanation"]
    assert "Suggested resolution" in c["explanation"]


def test_multi_valued_relations_not_flagged_as_contradictions():
    facts = [
        {
            "id": "fact-mem-1",
            "subject": "Global Alliance",
            "relation": "has_member",
            "object": "Alice Smith",
            "document_title": "Doc 1",
        },
        {
            "id": "fact-mem-2",
            "subject": "Global Alliance",
            "relation": "has_member",
            "object": "Bob Jones",
            "document_title": "Doc 2",
        },
        {
            "id": "fact-auth-1",
            "subject": "Carl Sagan",
            "relation": "authored",
            "object": "Cosmos",
            "document_title": "Doc 1",
        },
        {
            "id": "fact-auth-2",
            "subject": "Carl Sagan",
            "relation": "authored",
            "object": "Contact",
            "document_title": "Doc 2",
        },
        {
            "id": "fact-collab-1",
            "subject": "Alice Smith",
            "relation": "collaborates_with",
            "object": "Bob Jones",
            "document_title": "Doc 1",
        },
        {
            "id": "fact-collab-2",
            "subject": "Alice Smith",
            "relation": "collaborates_with",
            "object": "Charlie Brown",
            "document_title": "Doc 2",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 0


def test_temporal_drift_detection():
    facts = [
        {
            "id": "fact-year-1",
            "subject": "Acme Corp",
            "relation": "founded_year",
            "object": "1995",
            "document_title": "Doc History 1990s",
            "quote_text": "Acme was founded in 1995.",
        },
        {
            "id": "fact-year-2",
            "subject": "Acme Corp",
            "relation": "founded_year",
            "object": "2002",
            "document_title": "Doc History 2000s",
            "quote_text": "The company was established in 2002 after restructuring.",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["conflict_type"] == "temporal_drift"
    assert c["relation_name"] == "founded_year"
    assert {c["fact_a"]["value"], c["fact_b"]["value"]} == {"1995", "2002"}
    assert "temporal" in c["explanation"].lower() or "chronological" in c["explanation"].lower()


def test_temporal_drift_birth_date():
    facts = [
        {
            "id": "fact-dob-1",
            "subject": "Marie Curie",
            "relation": "birth_date",
            "object": "1867-11-07",
            "document_title": "Biographical Archive A",
        },
        {
            "id": "fact-dob-2",
            "subject": "Marie Curie",
            "relation": "birth_date",
            "object": "1870-11-07",
            "document_title": "Biographical Archive B",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["conflict_type"] == "temporal_drift"
    assert c["relation_name"] == "birth_date"


def test_negation_boolean_and_polarity():
    facts = [
        {
            "id": "fact-act-1",
            "subject": "Project Titan",
            "relation": "is_active",
            "object": True,
            "document_title": "Status Report Q1",
            "quote_text": "Project Titan is currently active.",
        },
        {
            "id": "fact-act-2",
            "subject": "Project Titan",
            "relation": "is_active",
            "object": False,
            "document_title": "Status Report Q3",
            "quote_text": "Project Titan is no longer active.",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["conflict_type"] == "negation"
    assert {c["fact_a"]["value"].lower(), c["fact_b"]["value"].lower()} == {"true", "false"}
    assert "negation" in c["explanation"].lower() or "polarity" in c["explanation"].lower()


def test_negation_opposing_assertion_flag():
    facts = [
        {
            "id": "fact-sub-1",
            "subject": "Acme",
            "relation": "partner_of",
            "object": "Initech",
            "is_negated": False,
            "document_title": "Partnership Announcement",
        },
        {
            "id": "fact-sub-2",
            "subject": "Acme",
            "relation": "partner_of",
            "object": "Initech",
            "is_negated": True,
            "document_title": "Dispute Notice",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["conflict_type"] == "negation"


def test_identical_normalized_values_not_contradiction():
    facts = [
        {
            "id": "fact-hq-1",
            "subject": "Acme Corp",
            "relation": "headquarters",
            "object": "Stockholm",
            "document_title": "Doc 1",
        },
        {
            "id": "fact-hq-2",
            "subject": "Acme Corp",
            "relation": "headquarters",
            "object": "  stockholm  ",
            "document_title": "Doc 2",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 0


def test_cross_source_table_divergence():
    facts = [
        {
            "id": "fact-doc-1",
            "subject": "Sweden",
            "relation": "capital",
            "object": "Stockholm",
            "document_title": "Doc Geography",
            "quote_text": "The capital of Sweden is Stockholm.",
        }
    ]
    tables = [
        {
            "id": "table-countries",
            "name": "Country_Capitals.csv",
            "rows": [
                {
                    "name": "Sweden",
                    "capital": "Gothenburg",
                }
            ],
        }
    ]

    contradictions = detect_knowledge_contradictions(facts, tables=tables)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["conflict_type"] == "value_mismatch"
    assert c["relation_name"] == "capital"
    assert {c["fact_a"]["value"], c["fact_b"]["value"]} == {"Stockholm", "Gothenburg"}


def test_entity_resolution_and_aliases():
    entities = [
        {
            "id": "ent-swe",
            "label": "Sweden",
            "aliases": ["Kingdom of Sweden"],
        }
    ]
    facts = [
        {
            "id": "fact-cc-1",
            "subject_entity_id": "ent-swe",
            "relation": "country_code",
            "object": "SE",
            "document_title": "Doc Standard",
        },
        {
            "id": "fact-cc-2",
            "subject": "Kingdom of Sweden",
            "relation": "country_code",
            "object": "FI",
            "document_title": "Doc Errata",
        },
    ]

    contradictions = detect_knowledge_contradictions(facts, entities=entities)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["entity_id"] == "ent-swe"
    assert c["entity_label"] == "Sweden"
    assert c["conflict_type"] == "value_mismatch"


def test_empty_facts_returns_empty_list():
    assert detect_knowledge_contradictions([]) == []
    assert detect_knowledge_contradictions([], entities=[], tables=[]) == []


def test_different_entities_same_relation_not_contradiction():
    facts = [
        {
            "id": "fact-hq-a",
            "subject": "Acme Corp",
            "relation": "headquarters",
            "object": "Stockholm",
        },
        {
            "id": "fact-hq-b",
            "subject": "Initech Corp",
            "relation": "headquarters",
            "object": "Helsinki",
        },
    ]
    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 0


def test_entity_attributes_divergence_with_document_facts():
    entities = [
        {
            "id": "ent-acme",
            "label": "Acme Corp",
            "attributes": {"headquarters": "Stockholm"},
            "source": "CRM Profile",
        }
    ]
    facts = [
        {
            "id": "fact-hq-news",
            "subject_entity_id": "ent-acme",
            "relation": "headquarters",
            "object": "Oslo",
            "document_title": "Press Release",
        }
    ]
    contradictions = detect_knowledge_contradictions(facts, entities=entities)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["entity_id"] == "ent-acme"
    assert c["conflict_type"] == "value_mismatch"
    assert {c["fact_a"]["value"], c["fact_b"]["value"]} == {"Stockholm", "Oslo"}


def test_explicit_functional_metadata_flag():
    # A relation that is usually multi-valued, but explicitly flagged functional: True
    facts = [
        {
            "id": "fact-f-1",
            "subject": "System Alpha",
            "relation": "primary_maintainer",
            "object": "Alice",
            "functional": True,
            "document_title": "Doc 1",
        },
        {
            "id": "fact-f-2",
            "subject": "System Alpha",
            "relation": "primary_maintainer",
            "object": "Bob",
            "functional": True,
            "document_title": "Doc 2",
        },
    ]
    contradictions = detect_knowledge_contradictions(facts)
    assert len(contradictions) == 1
    assert contradictions[0]["conflict_type"] == "value_mismatch"

