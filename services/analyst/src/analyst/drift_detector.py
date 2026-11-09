import logging
import re
from typing import Any, Optional

logger = logging.getLogger("analyst.drift_detector")

KNOWN_FUNCTIONAL_RELATIONS = {
    "headquarters",
    "headquartered_in",
    "hq",
    "hq_location",
    "headquarters_location",
    "main_office",
    "capital",
    "capital_city",
    "country_code",
    "country_code_iso",
    "iso_code",
    "iso_alpha2",
    "iso_alpha3",
    "iso2",
    "iso3",
    "currency",
    "currency_code",
    "birth_date",
    "date_of_birth",
    "birthdate",
    "born_on",
    "birth_place",
    "place_of_birth",
    "death_date",
    "date_of_death",
    "died_on",
    "founded_year",
    "founded_date",
    "founding_date",
    "year_founded",
    "date_founded",
    "established_year",
    "established_date",
    "year_established",
    "inception",
    "inception_year",
    "inception_date",
    "ceo",
    "chief_executive_officer",
    "president",
    "legal_name",
    "official_name",
    "primary_name",
    "ticker_symbol",
    "stock_symbol",
    "ticker",
    "parent_company",
    "ultimate_parent",
    "status",
    "operational_status",
    "legal_status",
    "state_of_incorporation",
    "website",
    "official_website",
    "primary_domain",
    "population",
    "area_km2",
    "gdp",
    "is_active",
}

KNOWN_MULTI_VALUED_RELATIONS = {
    "member_of",
    "has_member",
    "member",
    "members",
    "collaborates_with",
    "collaborator",
    "collaborator_of",
    "collaborated_with",
    "cooperation_with",
    "authored",
    "author",
    "author_of",
    "has_author",
    "co_authored",
    "written_by",
    "investor_in",
    "invested_in",
    "has_investor",
    "investor",
    "product",
    "produces",
    "manufactures",
    "sells",
    "developed_product",
    "developer_of",
    "partner",
    "partnered_with",
    "partner_of",
    "has_partner",
    "subsidiary",
    "has_subsidiary",
    "subsidiaries",
    "board_member",
    "director",
    "employee",
    "employs",
    "advises",
    "advisor",
    "parent",
    "child",
    "sibling",
    "relative",
    "genre",
    "tag",
    "category",
    "keyword",
    "topic",
    "theme",
    "award",
    "awarded",
    "honored_with",
    "client",
    "customer",
    "supplier",
    "vendor",
    "operates_in",
    "location",
    "office",
    "branch",
    "language",
    "languages",
    "skill",
    "skills",
    "attended",
    "related_to",
    "interacts_with",
    "mentions",
    "references",
}

OPPOSITE_PAIRS = {
    ("true", "false"),
    ("false", "true"),
    ("yes", "no"),
    ("no", "yes"),
    ("1", "0"),
    ("0", "1"),
    ("active", "inactive"),
    ("inactive", "active"),
    ("active", "defunct"),
    ("defunct", "active"),
    ("active", "dormant"),
    ("dormant", "active"),
    ("operational", "non-operational"),
    ("non-operational", "operational"),
    ("operational", "inoperative"),
    ("inoperative", "operational"),
    ("valid", "invalid"),
    ("invalid", "valid"),
    ("enabled", "disabled"),
    ("disabled", "enabled"),
    ("alive", "deceased"),
    ("deceased", "alive"),
    ("alive", "dead"),
    ("dead", "alive"),
}


def normalize_relation(rel: str) -> str:
    """Normalize relation string to snake_case identifier and canonical alias."""
    if not rel:
        return "related_to"
    cleaned = re.sub(r"[\s\-]+", "_", str(rel).strip().lower())
    cleaned = re.sub(r"[^a-z0-9_]", "", cleaned)

    aliases = {
        "headquartered_in": "headquarters",
        "hq": "headquarters",
        "hq_location": "headquarters",
        "headquarters_location": "headquarters",
        "capital_city": "capital",
        "country_code_iso": "country_code",
        "iso_code": "country_code",
        "iso2": "country_code",
        "iso3": "country_code",
        "currency_code": "currency",
        "date_of_birth": "birth_date",
        "birthdate": "birth_date",
        "born_on": "birth_date",
        "date_of_death": "death_date",
        "died_on": "death_date",
        "founded_date": "founded_year",
        "founding_date": "founded_year",
        "year_founded": "founded_year",
        "established_year": "founded_year",
        "established_date": "founded_year",
        "year_established": "founded_year",
        "chief_executive_officer": "ceo",
        "stock_symbol": "ticker_symbol",
        "ticker": "ticker_symbol",
        "author": "authored",
        "author_of": "authored",
        "has_author": "authored",
        "written_by": "authored",
        "has_member": "member_of",
        "members": "member_of",
        "collaborator": "collaborates_with",
        "collaborated_with": "collaborates_with",
    }
    return aliases.get(cleaned, cleaned)


def is_functional_relation(
    rel_name: str, fact_or_meta: Optional[dict[str, Any]] = None
) -> bool:
    """Determine whether a relation is functional (single-valued per entity)."""
    if fact_or_meta:
        for key in ("functional", "single_valued", "is_functional"):
            if fact_or_meta.get(key) is True:
                return True
            if fact_or_meta.get(key) is False:
                return False
        meta = fact_or_meta.get("metadata") or {}
        for key in ("functional", "single_valued", "is_functional"):
            if meta.get(key) is True:
                return True
            if meta.get(key) is False:
                return False

    norm = normalize_relation(rel_name)
    if norm in KNOWN_MULTI_VALUED_RELATIONS:
        return False
    if norm in KNOWN_FUNCTIONAL_RELATIONS:
        return True

    # Suffix heuristics for functional relations
    if any(
        norm.endswith(sfx)
        for sfx in (
            "_date",
            "_year",
            "_code",
            "_id",
            "_city",
            "_country",
            "_symbol",
            "_status",
        )
    ):
        return True

    # Prefix heuristics
    if any(
        norm.startswith(pfx)
        for pfx in ("date_of_", "year_of_", "place_of_", "headquarter", "capital_", "is_")
    ):
        return True

    # Infix heuristics
    if any(
        infix in norm
        for infix in ("birth_date", "death_date", "founded", "inception", "country_code", "ticker")
    ):
        return True

    return False


def is_temporal_conflict(rel_name: str, val_a: str, val_b: str) -> bool:
    """Check if the relation or value formats correspond to temporal / chronological drift."""
    norm_rel = normalize_relation(rel_name)
    temporal_rel_tokens = (
        "year",
        "date",
        "time",
        "timestamp",
        "founded",
        "birth",
        "death",
        "established",
        "inception",
    )
    if any(token in norm_rel for token in temporal_rel_tokens):
        return True

    year_pattern = r"^(1[789]\d\d|20\d\d)$"
    iso_date_pattern = r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}"

    is_val_a_year = bool(re.match(year_pattern, val_a.strip()))
    is_val_b_year = bool(re.match(year_pattern, val_b.strip()))
    if is_val_a_year and is_val_b_year:
        return True

    is_val_a_date = bool(re.match(iso_date_pattern, val_a.strip()))
    is_val_b_date = bool(re.match(iso_date_pattern, val_b.strip()))
    if is_val_a_date and is_val_b_date:
        return True

    return False


def is_negation_conflict(
    val_a_norm: str,
    val_b_norm: str,
    is_neg_a: bool,
    is_neg_b: bool,
) -> bool:
    """Check if two facts represent conflicting polarity or direct negation."""
    if (val_a_norm, val_b_norm) in OPPOSITE_PAIRS:
        return True
    if val_a_norm == val_b_norm and (is_neg_a != is_neg_b):
        return True
    return False


def build_explanation(
    entity_label: str,
    relation_name: str,
    val_a: str,
    doc_a: str,
    val_b: str,
    doc_b: str,
    conflict_type: str,
) -> str:
    """Format structured explanation and suggested resolution action."""
    source_a = f"'{doc_a}'" if doc_a else "Source A"
    source_b = f"'{doc_b}'" if doc_b else "Source B"

    if conflict_type == "temporal_drift":
        return (
            f"Temporal drift detected for '{relation_name}' on '{entity_label}': "
            f"value '{val_a}' in {source_a} conflicts with '{val_b}' in {source_b}. "
            f"Suggested resolution: Inspect chronology or timestamp metadata to confirm the most recent or historically accurate date."
        )
    elif conflict_type == "negation":
        return (
            f"Polarity / negation conflict detected for '{relation_name}' on '{entity_label}': "
            f"'{val_a}' in {source_a} directly contradicts '{val_b}' in {source_b}. "
            f"Suggested resolution: Reconcile current status with recent records or verify if a status transition occurred."
        )
    else:  # value_mismatch
        return (
            f"Contradictory values detected for single-valued relation '{relation_name}' on '{entity_label}': "
            f"'{val_a}' in {source_a} conflicts with '{val_b}' in {source_b}. "
            f"Suggested resolution: Compare source credibility and designate one fact as authoritative or update the ontology."
        )


def _extract_fact_value(fact: dict[str, Any]) -> tuple[Any, str]:
    """Safely extract raw value and string representation without falsey coalescing bugs."""
    val: Any = None
    for key in ("object", "object_text", "objectText", "object_entity", "value", "target"):
        if key in fact and fact[key] is not None:
            val = fact[key]
            break

    if isinstance(val, bool):
        val_str = "true" if val else "false"
    elif val is not None:
        val_str = str(val).strip()
    else:
        val_str = ""

    return val, val_str


def _format_fact_payload(fact: dict[str, Any]) -> dict[str, Any]:
    _, val_str = _extract_fact_value(fact)

    doc = (
        fact.get("documentTitle")
        or fact.get("document_title")
        or fact.get("document_name")
        or fact.get("document_id")
        or fact.get("documentId")
        or fact.get("source")
        or fact.get("source_document")
        or fact.get("table_id")
        or fact.get("table")
        or ""
    )
    quote = (
        fact.get("quoteText")
        or fact.get("quote_text")
        or fact.get("quote")
        or fact.get("snippet")
        or fact.get("evidence")
        or fact.get("text")
        or ""
    )
    created_at = (
        fact.get("createdAt")
        or fact.get("created_at")
        or fact.get("timestamp")
        or fact.get("date")
        or ""
    )
    fact_id = (
        fact.get("id")
        or fact.get("fact_id")
        or fact.get("factId")
        or ""
    )

    return {
        "id": str(fact_id),
        "value": val_str,
        "documentTitle": str(doc),
        "quoteText": str(quote),
        "createdAt": str(created_at),
    }


def detect_knowledge_contradictions(
    facts: list[dict[str, Any]],
    entities: Optional[list[dict[str, Any]]] = None,
    tables: Optional[list[dict[str, Any]]] = None,
) -> list[dict[str, Any]]:
    """
    Detect semantic contradictions, temporal drift, and negation conflicts across
    extracted facts and tabular data.
    """
    # 1. Build entity resolution index
    id_to_label: dict[str, str] = {}
    label_to_id: dict[str, str] = {}
    alias_to_id: dict[str, str] = {}

    synthesized_facts: list[dict[str, Any]] = []

    if entities:
        for ent in entities:
            eid = str(
                ent.get("id")
                or ent.get("entity_id")
                or ent.get("entityId")
                or ent.get("label")
                or ent.get("name")
                or ""
            ).strip()
            elabel = str(
                ent.get("label")
                or ent.get("name")
                or ent.get("entity_text")
                or ent.get("entityText")
                or eid
            ).strip()
            if eid:
                id_to_label[eid] = elabel
                label_to_id[elabel.lower()] = eid
                label_to_id[eid.lower()] = eid

            aliases = ent.get("aliases") or []
            if isinstance(aliases, list):
                for alias in aliases:
                    if alias and eid:
                        alias_to_id[str(alias).strip().lower()] = eid

            # Extract entity attributes as facts
            attrs = ent.get("attributes") or ent.get("properties") or {}
            if isinstance(attrs, dict):
                for k, v in attrs.items():
                    synthesized_facts.append(
                        {
                            "id": f"entity-{eid}-{k}",
                            "subject_entity_id": eid,
                            "subject": elabel,
                            "relation": k,
                            "object": v,
                            "document_title": ent.get("source") or "entity_profile",
                        }
                    )

    # 2. Extract facts from tables
    if tables:
        for table in tables:
            table_id = str(table.get("id") or table.get("name") or "table")
            table_name = str(table.get("name") or table.get("title") or table_id)

            if "facts" in table and isinstance(table["facts"], list):
                for f in table["facts"]:
                    f_copy = dict(f)
                    if not f_copy.get("document_title") and not f_copy.get("documentTitle"):
                        f_copy["documentTitle"] = table_name
                    synthesized_facts.append(f_copy)

            if "rows" in table and isinstance(table["rows"], list):
                for idx, row in enumerate(table["rows"]):
                    if ("subject" in row or "subject_text" in row) and (
                        "object" in row or "object_text" in row or "value" in row
                    ):
                        f_copy = dict(row)
                        if not f_copy.get("document_title") and not f_copy.get("documentTitle"):
                            f_copy["documentTitle"] = table_name
                        synthesized_facts.append(f_copy)
                    elif isinstance(row, dict):
                        subject = (
                            row.get("name")
                            or row.get("company")
                            or row.get("entity")
                            or row.get("subject")
                            or row.get("entity_id")
                            or row.get("id")
                        )
                        if subject:
                            for col, cell in row.items():
                                if col.lower() in (
                                    "name",
                                    "company",
                                    "entity",
                                    "subject",
                                    "id",
                                    "row_id",
                                ):
                                    continue
                                if cell is not None and str(cell).strip():
                                    synthesized_facts.append(
                                        {
                                            "id": f"{table_id}-row-{idx}-{col}",
                                            "subject": str(subject),
                                            "relation": str(col),
                                            "object": cell,
                                            "documentTitle": table_name,
                                            "quoteText": (
                                                f"Table '{table_name}' row '{subject}' column '{col}' = '{cell}'"
                                            ),
                                        }
                                    )

    all_raw_facts = list(facts or []) + synthesized_facts

    # 3. Standardize and group facts by (entity_id, canonical_relation)
    grouped_facts: dict[tuple[str, str], list[dict[str, Any]]] = {}

    for idx, f in enumerate(all_raw_facts):
        sub_id = (
            f.get("subject_entity_id")
            or f.get("subjectEntityId")
            or f.get("subject_id")
        )
        sub_text = (
            f.get("subject")
            or f.get("subject_text")
            or f.get("subjectText")
            or f.get("subject_entity")
            or f.get("source")
        )
        sub_label = f.get("subject_label") or f.get("subjectLabel") or sub_text or sub_id

        # Resolve entity ID and label
        entity_id: str = ""
        entity_label: str = ""

        if sub_id and str(sub_id).strip() in id_to_label:
            entity_id = str(sub_id).strip()
            entity_label = id_to_label[entity_id]
        elif sub_text and str(sub_text).strip().lower() in label_to_id:
            entity_id = label_to_id[str(sub_text).strip().lower()]
            entity_label = id_to_label.get(entity_id, str(sub_text).strip())
        elif sub_text and str(sub_text).strip().lower() in alias_to_id:
            entity_id = alias_to_id[str(sub_text).strip().lower()]
            entity_label = id_to_label.get(entity_id, str(sub_text).strip())
        else:
            entity_id = str(sub_id or sub_text or f"ent-{idx}").strip()
            entity_label = str(sub_label or sub_text or sub_id or entity_id).strip()

        rel_raw = (
            f.get("relation")
            or f.get("relation_text")
            or f.get("relationText")
            or f.get("relation_name")
            or f.get("relationName")
            or f.get("predicate")
            or f.get("label")
            or "related_to"
        )
        rel_str = str(rel_raw).strip()

        # Check relation prefix for negation (e.g. not_partner_of)
        is_negated = False
        if f.get("is_negated") is True or f.get("negated") is True:
            is_negated = True
        if str(f.get("polarity", "")).lower() in ("negative", "negated"):
            is_negated = True

        norm_rel = normalize_relation(rel_str)
        if norm_rel.startswith("not_"):
            is_negated = True
            canonical_rel = normalize_relation(norm_rel[4:])
        elif norm_rel.startswith("is_not_"):
            is_negated = True
            canonical_rel = normalize_relation(norm_rel[7:])
        else:
            canonical_rel = norm_rel

        # Extract value
        _, val_str = _extract_fact_value(f)
        val_norm = val_str.lower().strip()

        parsed_fact = {
            "raw": f,
            "fact_id": str(f.get("id") or f.get("fact_id") or f.get("factId") or f"f-{idx}"),
            "entity_id": entity_id,
            "entity_label": entity_label,
            "relation_name": rel_str,
            "canonical_relation": canonical_rel,
            "val_str": val_str,
            "val_norm": val_norm,
            "is_negated": is_negated,
            "payload": _format_fact_payload(f),
        }

        group_key = (entity_id, canonical_rel)
        grouped_facts.setdefault(group_key, []).append(parsed_fact)

    contradictions: list[dict[str, Any]] = []

    # 4. Evaluate each group for contradictions
    for (eid, canon_rel), group_list in grouped_facts.items():
        if not group_list:
            continue

        entity_label = group_list[0]["entity_label"]
        display_relation = group_list[0]["relation_name"]
        functional = is_functional_relation(canon_rel, group_list[0]["raw"])

        # Check for direct negation on the same normalized value
        # e.g. Fact 1 asserts (Acme, partner_of, Initech) and Fact 2 asserts (Acme, not_partner_of, Initech)
        by_val_norm: dict[str, list[dict[str, Any]]] = {}
        for item in group_list:
            by_val_norm.setdefault(item["val_norm"], []).append(item)

        for val_norm_key, items_with_val in by_val_norm.items():
            positives = [it for it in items_with_val if not it["is_negated"]]
            negatives = [it for it in items_with_val if it["is_negated"]]
            if positives and negatives:
                item_a = positives[0]
                item_b = negatives[0]
                doc_a = item_a["payload"]["documentTitle"]
                doc_b = item_b["payload"]["documentTitle"]
                explanation = build_explanation(
                    entity_label=entity_label,
                    relation_name=display_relation,
                    val_a=item_a["val_str"],
                    doc_a=doc_a,
                    val_b=f"NOT {item_b['val_str']}",
                    doc_b=doc_b,
                    conflict_type="negation",
                )
                contradictions.append(
                    {
                        "entity_id": eid,
                        "entity_label": entity_label,
                        "relation_name": display_relation,
                        "conflict_type": "negation",
                        "fact_a": item_a["payload"],
                        "fact_b": item_b["payload"],
                        "explanation": explanation,
                        "status": "open",
                        "resolution_action": None,
                    }
                )

        # Check for differing values
        distinct_vals = list(by_val_norm.keys())
        if len(distinct_vals) < 2:
            continue

        # If not functional and not negation, multiple values are valid (multi-valued relation)
        # Check pairs of distinct values
        for i in range(len(distinct_vals)):
            for j in range(i + 1, len(distinct_vals)):
                val_i = distinct_vals[i]
                val_j = distinct_vals[j]
                item_a = by_val_norm[val_i][0]
                item_b = by_val_norm[val_j][0]

                doc_a = item_a["payload"]["documentTitle"]
                doc_b = item_b["payload"]["documentTitle"]

                if is_negation_conflict(
                    val_i, val_j, item_a["is_negated"], item_b["is_negated"]
                ):
                    explanation = build_explanation(
                        entity_label=entity_label,
                        relation_name=display_relation,
                        val_a=item_a["val_str"],
                        doc_a=doc_a,
                        val_b=item_b["val_str"],
                        doc_b=doc_b,
                        conflict_type="negation",
                    )
                    contradictions.append(
                        {
                            "entity_id": eid,
                            "entity_label": entity_label,
                            "relation_name": display_relation,
                            "conflict_type": "negation",
                            "fact_a": item_a["payload"],
                            "fact_b": item_b["payload"],
                            "explanation": explanation,
                            "status": "open",
                            "resolution_action": None,
                        }
                    )
                elif functional:
                    # Functional relation with distinct conflicting values
                    if is_temporal_conflict(canon_rel, item_a["val_str"], item_b["val_str"]):
                        conflict_type = "temporal_drift"
                    else:
                        conflict_type = "value_mismatch"

                    explanation = build_explanation(
                        entity_label=entity_label,
                        relation_name=display_relation,
                        val_a=item_a["val_str"],
                        doc_a=doc_a,
                        val_b=item_b["val_str"],
                        doc_b=doc_b,
                        conflict_type=conflict_type,
                    )
                    contradictions.append(
                        {
                            "entity_id": eid,
                            "entity_label": entity_label,
                            "relation_name": display_relation,
                            "conflict_type": conflict_type,
                            "fact_a": item_a["payload"],
                            "fact_b": item_b["payload"],
                            "explanation": explanation,
                            "status": "open",
                            "resolution_action": None,
                        }
                    )

    return contradictions
