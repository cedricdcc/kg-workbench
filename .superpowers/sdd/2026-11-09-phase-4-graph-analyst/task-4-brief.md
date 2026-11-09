# Task 4: Contradiction & Semantic Drift Detection Engine

**Files:**

- Create: `services/analyst/src/analyst/drift_detector.py`
- Create: `services/analyst/tests/test_drift_detector.py`

## Instructions

1. **`services/analyst/src/analyst/drift_detector.py`**:
   Implement contradiction and semantic drift detection over extracted facts and tabular data:
   - Contradiction Types:
     - `value_mismatch`: Same entity, same functional relation / single-valued attribute, conflicting values (e.g., entity "Acme" has `headquarters`: "Stockholm" in Document 1 and "Helsinki" in Document 2).
     - `temporal_drift`: Conflicting dates or timestamps (e.g. `founded_year`: 1995 vs 2002).
     - `negation`: Conflicting polarity or negated assertions (e.g. `is_active`: true vs false).
   - Functions:
     - `detect_knowledge_contradictions(facts: list[dict], entities: list[dict] = None, tables: list[dict] = None) -> list[dict]`:
       Returns a list of structured contradiction objects:
       ```python
       {
           "entity_id": str,
           "entity_label": str,
           "relation_name": str,
           "conflict_type": "value_mismatch" | "temporal_drift" | "negation",
           "fact_a": {
               "id": str,
               "value": str,
               "documentTitle": str,
               "quoteText": str,
               "createdAt": str
           },
           "fact_b": {
               "id": str,
               "value": str,
               "documentTitle": str,
               "quoteText": str,
               "createdAt": str
           },
           "explanation": str,
           "status": "open",
           "resolution_action": None
       }
       ```

2. **`services/analyst/tests/test_drift_detector.py`**:
   - Test detecting functional relation value mismatch between two facts across different documents.
   - Test non-conflicting facts (multiple values for non-functional relations like `has_member` or `author`) are NOT flagged as contradictions.
   - Test generated explanation clearly describes the discrepancy.

3. Commit:
   `git add services/analyst/src/analyst/drift_detector.py services/analyst/tests/test_drift_detector.py`
   `git commit -m "feat(analyst): implement contradiction and semantic drift detector"`
