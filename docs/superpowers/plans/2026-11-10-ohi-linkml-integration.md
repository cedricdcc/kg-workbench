# `ohi.dev` & `@neverblink/linkml` Canonical Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan phase-by-phase and task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `kg-workbench` into a LinkML-first canonical ontology workbench (Option 2A) powered by `ohi.dev` and `@neverblink/linkml@0.18.2`, enabling SHA-256 locked ontology dependencies, single-source compilation to W3C SHACL, RDFS, OWL 2, and Pydantic v2 models, Pydantic-guided LLM document extraction, and W3C `PROV-O` provenance bundle exports.

**Architecture:** `ontology_documents` stores canonical `linkml_yaml`, `ohi_yaml`, `ohi_lockfile` (`ohi.lock.json` v2), `ui_layout`, and `compiled_artifacts`, replacing 14 legacy relational tables while projecting clean DTOs (`id: string` using LinkML symbol keys) to the React Flow and CQ UI. Next.js compiles schemas via `@neverblink/linkml` (`LinkML.loadFromString`, `view.shacl()`, `view.rdfs()`, `view.owl()`, `view.pydantic()`, `view.jsonSchema()`, `LinkML.fromOwl()`, `LinkML.lint()`) and passes pre-compiled Pydantic, SHACL, RDFS, and lockfile artifacts to `services/internal-extractor` and `services/reasoner`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@neverblink/linkml@0.18.2`, Drizzle ORM (`1.0.0-rc.4`), PostgreSQL, Python 3.11+, FastAPI, Pydantic v2, Pytest.

**Spec:** `docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md`

**Phased Sub-Plans Directory:** `docs/plans/15-ohi-linkml-architecture/index.md`

## Global Constraints

- Use `pnpm` only (`npm exec pnpm -- <cmd>` if `pnpm` is not on PATH).
- Guard browser environments before importing `@neverblink/linkml`: `if (typeof globalThis.process === "undefined") { (globalThis as Record<string, unknown>).process = { cwd: () => "/" } }`.
- Every phase must leave the repository passing `npm exec pnpm -- check`.
- Follow `AGENT_CONTRACT.md` for routes (`src/lib/routes.ts`), multi-file components (`components/<name>/<name>.tsx`), and feature `README.md` updates.

## Review Focus

1. **Duplicate Relation Names Across Different Classes:** Disambiguate colliding LinkML slot keys as `<domainKey>__<relationName>__<rangeKey>` while preserving the display name in `slot_uri` / `annotations`.
2. **SHA-256 Tamper / Drift Detection:** Modifying any cached `ohi` artifact string when `ohi.lock.json` has a pinned `sha256` must trigger `OhiLockfileDriftError` during lockfile verification.
3. **Transactional Cascade on Class/Relation Rename & Delete:** Renaming `"Person"` → `"Individual"` must atomically update `document_entities.class_id`, prefix-match `entity_attribute_values.attribute_id` (`"Person.age"` → `"Individual.age"`), CQs, and `dataset_sources`.
4. **AST Safety Check on `pydantic_code` in Python Extractor:** `pydantic_loader.py` must validate `pydantic_code` with `ast.parse` against whitelisted imports/nodes before executing `exec`.
5. **W3C `PROV-O` Digest Integrity:** Exported KG bundles must emit `prov:Entity` triples for every file in `ohi.lock.json` with its exact `sha256` digest and release URL, linked via `prov:used` to the extraction run's `prov:Activity`.

---

## Phase Execution Map

Execute the 5 phases in order. Each phase has its own detailed task-by-task plan in `docs/plans/15-ohi-linkml-architecture/`:

- [ ] **Phase 1: Core `@neverblink/linkml` AST Mapper, Compiler & Importer**
  - Plan: [`docs/plans/15-ohi-linkml-architecture/01-phase-1-linkml-engine-and-compiler.md`](../../plans/15-ohi-linkml-architecture/01-phase-1-linkml-engine-and-compiler.md)
  - Deliverable: `@neverblink/linkml@0.18.2` installed; lossless `ast-mapper.ts`; multi-format compiler (`shacl`, `rdfs`, `owl`, `pydantic`, `jsonSchema`, `erDiagram`, `lint`); legacy SHACL/OWL string builders and Turtle importer replaced.

- [ ] **Phase 2: `ohi.dev` Package Manager, SHA-256 Lockfiles & Registry Replacement**
  - Plan: [`docs/plans/15-ohi-linkml-architecture/02-phase-2-ohi-package-manager-and-lockfiles.md`](../../plans/15-ohi-linkml-architecture/02-phase-2-ohi-package-manager-and-lockfiles.md)
  - Deliverable: `ohi.yaml` & `ohi.lock.json` v2 parser/serializer; `ohi.dev` catalog client with transitive dependency resolution (`w3c/dcat@3` → `dcterms`, `skos`, `prov-o@2013`); SHA-256 drift verifier; LinkML `importMap` builder; removal of legacy OLS4/LOV/BARTOC/OntoPortal/EU scrapers.

- [ ] **Phase 3: Option 2A Canonical LinkML Document Store & Symbol Cascades**
  - Plan: [`docs/plans/15-ohi-linkml-architecture/03-phase-3-canonical-store-migration-and-cascades.md`](../../plans/15-ohi-linkml-architecture/03-phase-3-canonical-store-migration-and-cascades.md)
  - Deliverable: Drizzle schema migration dropping 14 redundant SQL tables and migrating 3 external boundaries (`facts`/`document_entities`, CQs, `dataset_sources`) to `text` LinkML symbol keys; transactional `cascadeSymbolRename` & `cascadeSymbolDelete`; all ontology & tabular server queries and write actions reading/writing `ontology_documents.linkml_yaml` + `ui_layout`.

- [ ] **Phase 4: Workbench UI — LinkML & Code Compiler Studio + `ohi.dev` Dependency Browser**
  - Plan: [`docs/plans/15-ohi-linkml-architecture/04-phase-4-workbench-ui-and-compiler-studio.md`](../../plans/15-ohi-linkml-architecture/04-phase-4-workbench-ui-and-compiler-studio.md)
  - Deliverable: `<CompilerStudioDialog />` for live preview/download of `.linkml.yaml`, `.shacl.ttl`, `.rdfs.ttl`, `.owl.ttl`, `models.py`, JSON Schema, Mermaid ER, and `ohi.lock.json` + raw LinkML editor; `<StandardsBrowser />` for `ohi.dev` dependency management; LinkML lint & lockfile drift warnings in `ontology-issues-sheet.tsx`.

- [ ] **Phase 5: Pydantic-Guided Extraction, RDFS/SHACL Validation & W3C `PROV-O` Bundle Export**
  - Plan: [`docs/plans/15-ohi-linkml-architecture/05-phase-5-pydantic-shacl-rdfs-extraction-and-provo.md`](../../plans/15-ohi-linkml-architecture/05-phase-5-pydantic-shacl-rdfs-extraction-and-provo.md)
  - Deliverable: Compiled `pydantic_code`, `json_schema`, `shacl_ttl`, `rdfs_ttl`, and `ohi_lockfile` sent to `services/internal-extractor`; safe AST-verified dynamic Pydantic v2 loader enforcing structured LLM extraction; RDFS + SHACL validation in `validator.ts` and `services/reasoner`; `<ExportKgBundleDialog />` exporting RDF instances with W3C `PROV-O` lineage + SHACL + RDFS + Pydantic `models.py`.
