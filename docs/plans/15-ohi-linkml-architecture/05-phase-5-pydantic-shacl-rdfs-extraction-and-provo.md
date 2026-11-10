# Phase 5: Pydantic-Guided Extraction, RDFS/SHACL Validation & W3C `PROV-O` Bundle Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: `open`

**Goal:** Upgrade the document extraction pipeline (`src/features/documents/` and `services/internal-extractor/`) to use `@neverblink/linkml`-generated **Pydantic v2 models**, **JSON Schema**, **RDFS**, and **W3C SHACL** for structured LLM extraction and validation across OpenAI, Anthropic, Gemini, and Ollama, and add a **Knowledge Graph Bundle Exporter** emitting RDF instance triples with **W3C `PROV-O` (`w3c/prov-o@2013`)** provenance (`ohi.lock.json` SHA-256 digests), RDFS, SHACL, and Pydantic `models.py`.

**Architecture:** When an extraction run starts in Next.js, the server compiles (or reads cached) `pydantic_py`, `json_schema`, `shacl_ttl`, `rdfs_ttl`, and `ohi_lockfile` from `ontology_documents`, snapshots `ohi_lockfile_snapshot` and `ontology_sha256` on `extraction_runs`, and forwards the artifacts in `ExtractionRequest`. In `services/internal-extractor`, `pydantic_loader.py` dynamically loads the generated Pydantic v2 models into an extraction envelope (`ChunkExtractionEnvelope`), enforces structured output and Pydantic field validation across all LLM providers, and returns symbol-keyed entities and facts. In Next.js, `export-kg-bundle.ts` packages accepted facts/entities into an archive/bundle containing `instances.ttl` (with `w3c/prov-o` triples tied to `ohi.lock.json` SHA-256 hashes), `ontology.rdfs.ttl`, `shapes.shacl.ttl`, `models.py`, and `instances.json`.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, Pytest (`uv run pytest`), TypeScript, Next.js Server Actions, `n3`.

**Spec:** `docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md` (Section 5.6)

## Global Constraints

- Safe execution of generated `pydantic_py` in `services/internal-extractor`: restrict globals to a whitelisted module dictionary (`pydantic`, `typing`, `datetime`, `enum`, `decimal`, `uuid`, `re`) and verify AST node types via Python's `ast.parse` (allowing only imports from whitelisted modules, class definitions, assignments, and type annotations) before `exec`.
- Maintain backward compatibility when `pydantic_code` is omitted in legacy external extractor calls.
- Update `src/features/documents/README.md` to document the Pydantic/SHACL/RDFS extraction and `PROV-O` bundle export flow.
- Run both `npm exec pnpm -- check` and Python extractor/reasoner pytest suites (`uv run --locked pytest` in `services/internal-extractor` and `services/reasoner`).

## Review Focus

1. **AST Safety Check on `pydantic_code`:** If a crafted `pydantic_code` string contains arbitrary function calls (`os.system`, `__import__`, `eval`, `open`), `pydantic_loader.py`'s `ast.parse` validator must reject it with `UnsafePydanticCodeError` before executing a single line.
2. **Pydantic Validation Recovery on Partial LLM Output:** If an LLM returns 4 valid entities and 1 entity with an invalid attribute datatype (e.g. `"unknown"` for an `int` field), the extractor must coerce or strip only the invalid attribute value rather than discarding the entire chunk's entities and facts.
3. **Consistent LinkML Symbol Keys from Extractor to DB:** Extracted entities and facts persisted by `extraction-results-persistence.ts` must map `class_id` to the LinkML `classKey` (`"Person"`), `relation_type_id` to the LinkML `relationKey` (`"works_for"`), and `attribute_id` to the composite key (`"Person.age"`).
4. **W3C `PROV-O` Digest Integrity:** Every entry in `extraction_runs.ohi_lockfile_snapshot.files[]` must be emitted as a `prov:Entity` in `instances.ttl` with its exact `sha256` digest, canonical `base_url`, and download `url`, linked via `prov:used` to the extraction run's `prov:Activity`.
5. **Pydantic `instances.json` Compatibility:** The exported `instances.json` inside the KG Bundle must validate cleanly when loaded by the exported `models.py` Pydantic classes.

---

### Slice 5.1: Enrich Extraction Job Payload & Provenance Snapshot in Next.js `open`

**Files:**

- Modify: `src/features/documents/schemas/extraction.ts`
- Modify: `src/features/documents/server/actions/extraction.ts`
- Modify: `src/features/documents/server/actions/enqueue-extraction-job.ts`
- Modify: `src/features/documents/server/actions/extraction-results-persistence.ts`
- Test: `tests/extraction-linkml-payload.test.ts`

**Interfaces:**

- Consumes: `loadCanonicalOntology`, `compileLinkmlOntology`
- Produces:
  - Extended `ExtractionRequestPayload` including `linkml_yaml`, `pydantic_code`, `json_schema`, `shacl_ttl`, `rdfs_ttl`, `ohi_lockfile`
  - Snapshot of `ohi_lockfile_snapshot` and `ontology_sha256` saved onto `extraction_runs`
  - Symbol-key resolution in `extraction-results-persistence.ts` (`classKey`, `relationKey`, `"${classKey}.${attrName}"`)

- [ ] **Step 1: Write failing test for extraction payload compilation and symbol-key result persistence**
      Create `tests/extraction-linkml-payload.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/extraction-linkml-payload.test.ts`

- [ ] **Step 3: Update `extraction.ts`, `enqueue-extraction-job.ts`, `extraction-results-persistence.ts`, and `schemas/extraction.ts`**

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/extraction-linkml-payload.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/documents/ tests/extraction-linkml-payload.test.ts`
      `git commit -m "feat(documents): include compiled Pydantic, SHACL, RDFS, and ohi lockfile in extraction runs"`

---

### Slice 5.2: Dynamic Pydantic v2 Loader & Structured Extraction in `services/internal-extractor` `open`

**Files:**

- Modify: `services/internal-extractor/src/internal_extractor/models.py`
- Create: `services/internal-extractor/src/internal_extractor/pydantic_loader.py`
- Modify: `services/internal-extractor/src/internal_extractor/schema_mapper.py`
- Modify: `services/internal-extractor/src/internal_extractor/kg_builder.py`
- Create: `services/internal-extractor/tests/test_pydantic_loader.py`

**Interfaces:**

- Consumes: `pydantic_code`, `json_schema`, `shacl_ttl`, `rdfs_ttl` on `ExtractionRequest` in `models.py`
- Produces:
  - `load_pydantic_extraction_models(pydantic_code: str, extraction_schema: ExtractionSchema) -> LoadedOntologyModels` in `pydantic_loader.py` (with `ast.parse` safety gate and per-entity attribute validation/repair)
  - Updated `to_graph_schema` and `run_extraction` in `schema_mapper.py` and `kg_builder.py` enforcing Pydantic validation on extracted entities and relations

- [ ] **Step 1: Write failing pytest suite in `services/internal-extractor/tests/test_pydantic_loader.py`**
      Test: 1. Loading `@neverblink/linkml`-generated Pydantic v2 classes and validating entity attributes. 2. Rejecting unsafe code in `pydantic_code` via the AST safety gate (`UnsafePydanticCodeError`). 3. Graceful repair when a single attribute on an extracted entity fails Pydantic type coercion while preserving valid entities.

- [ ] **Step 2: Run pytest to verify it fails**
      Run: `uv run --directory services/internal-extractor pytest tests/test_pydantic_loader.py -v`

- [ ] **Step 3: Implement `pydantic_loader.py` and update `models.py`, `schema_mapper.py`, and `kg_builder.py`**

- [ ] **Step 4: Run pytest to verify all extractor tests pass**
      Run: `uv run --directory services/internal-extractor pytest -v`

- [ ] **Step 5: Commit**
      `git add services/internal-extractor/`
      `git commit -m "feat(extractor): enforce LinkML-compiled Pydantic v2 models during document extraction"`

---

### Slice 5.3: RDFS Entailment & W3C SHACL Validation Upgrade `open`

**Files:**

- Modify: `src/features/ontology/server/shacl/validator.ts`
- Modify: `services/reasoner/src/reasoner/` (accept `rdfs_ttl`, `shacl_ttl`, and `ohi` locked imports)
- Test: `tests/rdfs-shacl-fact-validation.test.ts`

**Interfaces:**

- Consumes: `CompiledOntologyArtifacts` (`shacl_ttl`, `rdfs_ttl`)
- Produces:
  - Updated `validateFactsAgainstShacl` in `validator.ts` respecting RDFS `rdfs:subClassOf` / `rdfs:subPropertyOf` closure and SHACL property shapes compiled by `@neverblink/linkml`.

- [ ] **Step 1: Write failing test for RDFS subclass entailment + SHACL fact validation**
      Create `tests/rdfs-shacl-fact-validation.test.ts` verifying that an entity of subclass `Researcher` (`is_a: Person`) satisfies a relation whose domain is `Person` under RDFS + SHACL validation.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/rdfs-shacl-fact-validation.test.ts`

- [ ] **Step 3: Update `src/features/ontology/server/shacl/validator.ts` and `services/reasoner`**

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/rdfs-shacl-fact-validation.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/shacl/ services/reasoner/ tests/rdfs-shacl-fact-validation.test.ts`
      `git commit -m "feat(shacl): integrate LinkML RDFS subclass closure and SHACL shapes into fact validator"`

---

### Slice 5.4: W3C `PROV-O` + SHACL + RDFS + Pydantic Knowledge Graph Bundle Exporter & UI `open`

**Files:**

- Create: `src/features/documents/server/actions/export-kg-bundle.ts`
- Create: `src/features/documents/components/export-kg-bundle-dialog/export-kg-bundle-dialog.tsx`
- Create: `src/features/documents/components/export-kg-bundle-dialog/bundle-artifact-selector.tsx`
- Create: `src/features/documents/components/export-kg-bundle-dialog/provo-lineage-preview.tsx`
- Create: `src/features/documents/components/export-kg-bundle-dialog/pydantic-usage-snippet.tsx`
- Create: `src/features/documents/components/export-kg-bundle-dialog/types.ts`
- Modify: `src/features/documents/components/document-workspace-header/document-workspace-header.tsx`
- Modify: `src/features/documents/README.md`
- Test: `tests/export-kg-bundle-provo.test.ts`

**Interfaces:**

- Consumes: `loadCanonicalOntology`, `compileLinkmlOntology`, `extractionRuns` (`ohi_lockfile_snapshot`, `ontology_sha256`), accepted `facts` & `documentEntities`
- Produces:
  - `exportKnowledgeGraphBundleAction(documentId: string): Promise<KnowledgeGraphExportBundle>` returning:
    - `instances_ttl`: RDF Turtle graph of accepted entities, attributes, facts, evidence quotes, and **W3C `PROV-O` (`http://www.w3.org/ns/prov#`)** provenance (`prov:Activity` for the extraction run, `prov:Entity` for each file in `ohi.lock.json` with `sha256` digest, `prov:used`, `prov:wasGeneratedBy`, `prov:wasDerivedFrom`)
    - `rdfs_ttl`: compiled RDFS vocabulary (`.rdfs.ttl`)
    - `shacl_ttl`: compiled W3C SHACL shapes (`.shacl.ttl`)
    - `pydantic_py`: compiled Pydantic v2 models (`models.py`)
    - `instances_json`: structured JSON instances matching `models.py`
    - `ohi_lock_json`: exact `ohi.lock.json` v2 snapshot
  - `<ExportKgBundleDialog />` mounted in `document-workspace-header.tsx`

- [ ] **Step 1: Write failing test for `exportKnowledgeGraphBundleAction`**
      Create `tests/export-kg-bundle-provo.test.ts` asserting that `instances_ttl` parses cleanly with `n3`, emits `prov:Activity`, `prov:Entity` with `ohi.lock.json` `sha256` digests, `prov:used`, and `prov:wasGeneratedBy`, and includes matching `rdfs_ttl`, `shacl_ttl`, `pydantic_py`, and `instances_json`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/export-kg-bundle-provo.test.ts`

- [ ] **Step 3: Implement `export-kg-bundle.ts`, `/src/features/documents/components/export-kg-bundle-dialog/`, wire into `document-workspace-header.tsx`, and update `src/features/documents/README.md`**

- [ ] **Step 4: Run full check suite**
      Run: `npm exec pnpm -- check`
      Expected: All lint, typecheck, test, and build checks PASS.

- [ ] **Step 5: Commit**
      `git add src/features/documents/ tests/export-kg-bundle-provo.test.ts`
      `git commit -m "feat(documents): add W3C PROV-O, SHACL, RDFS, and Pydantic KG bundle exporter"`
