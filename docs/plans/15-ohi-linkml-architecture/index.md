# 15 - `ohi.dev` & `@neverblink/linkml` Canonical Architecture

## Overview

Refactor `kg-workbench` into a **LinkML-first canonical ontology workbench** powered by **`ohi.dev`** and **`@neverblink/linkml` (`0.18.2`)**, as specified in [`/docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md`](../../superpowers/specs/2026-11-10-ohi-linkml-integration-design.md).

The work is divided into **5 self-contained, sequentially executable phases** so you can initiate and execute one phase (or individual slice) per session or delegate phases across parallel/sequential agents. After every phase, `pnpm check` passes and the application remains in a working state.

---

## Phased Sub-Plans (Execution Order)

- [Phase 1 - Core `@neverblink/linkml` AST Mapper, Compiler & Importer](./01-phase-1-linkml-engine-and-compiler.md) `open`
  - Slice 1.1: Install `@neverblink/linkml` & define canonical LinkML / compiler types `open`
  - Slice 1.2: Bidirectional Workbench DTO ↔ LinkML YAML AST mapper (`ast-mapper.ts`) `open`
  - Slice 1.3: Multi-format compiler (`shacl`, `rdfs`, `owl`, `pydantic`, `jsonSchema`, `erDiagram`, `lint`) `open`
  - Slice 1.4: Replace legacy SHACL/OWL string builders & Turtle importer with `@neverblink/linkml` `open`
- [Phase 2 - `ohi.dev` Package Manager, SHA-256 Lockfiles & Registry Replacement](./02-phase-2-ohi-package-manager-and-lockfiles.md) `open`
  - Slice 2.1: Add `ohi.yaml` & `ohi.lock.json` v2 columns to DB schema `open`
  - Slice 2.2: Implement `ohi.dev` catalog client & transitive dependency resolver `open`
  - Slice 2.3: Implement SHA-256 lockfile verifier, tamper/drift detector & term embedding indexer `open`
  - Slice 2.4: Remove legacy OLS4/LOV/BARTOC/OntoPortal/EU registry scrapers `open`
- [Phase 3 - Option 2A Canonical LinkML Document Store & Symbol Cascades](./03-phase-3-canonical-store-migration-and-cascades.md) `open`
  - Slice 3.1: Drizzle schema refactor (drop 13 ontology SQL tables, switch 3 external boundaries to `text` symbol keys) & seed update `open`
  - Slice 3.2: Implement transactional symbol cascade service (`cascadeSymbolRename`, `cascadeSymbolDelete`, `diffLinkmlAstSymbols`) `open`
  - Slice 3.3: Refactor ontology server queries (`src/features/ontology/server/queries/*`) to read from `linkml_yaml` + `ui_layout` `open`
  - Slice 3.4: Refactor ontology & tabular server write actions (`src/features/ontology/server/actions/*`, `commit-dataset-mapping.ts`) `open`
- [Phase 4 - Workbench UI: LinkML & Code Compiler Studio + `ohi.dev` Dependency Browser](./04-phase-4-workbench-ui-and-compiler-studio.md) `open`
  - Slice 4.1: Build `/src/features/ontology/components/compiler-studio-dialog` (SHACL, RDFS, OWL, Pydantic `.py`, LinkML YAML, `ohi.lock.json`) `open`
  - Slice 4.2: Build `/src/features/ontology/components/standards-browser` for `ohi.dev` package search, transitive tree & SHA-256 lock status `open`
  - Slice 4.3: Integrate `ohi` lockfile drift & LinkML lint warnings into `/src/features/ontology/components/ontology-issues-sheet` `open`
- [Phase 5 - Pydantic-Guided Extraction, RDFS/SHACL Validation & W3C `PROV-O` Bundle Export](./05-phase-5-pydantic-shacl-rdfs-extraction-and-provo.md) `open`
  - Slice 5.1: Pass compiled `pydantic_code`, `json_schema`, `shacl_ttl`, `rdfs_ttl`, and `ohi_lockfile` in extraction jobs `open`
  - Slice 5.2: Dynamic Pydantic v2 model loader & structured multi-provider LLM extraction in `services/internal-extractor` `open`
  - Slice 5.3: RDFS entailment & SHACL validation integration in `services/reasoner` and in-app validator `open`
  - Slice 5.4: W3C `PROV-O` (`w3c/prov-o@2013`) + SHACL + RDFS + Pydantic `.py` Knowledge Graph bundle exporter & UI dialog `open`

---

## Relevant Entry Points

- `/src/server/db/schema.ts` - PostgreSQL Drizzle schema definitions.
- `/src/domain/ontology.ts` and `/src/domain/documents.ts` - Domain DTOs and table type aliases.
- `/src/features/ontology/README.md` - Ontology feature documentation.
- `/src/features/documents/README.md` - Documents feature documentation.
- `/src/features/tabular/README.md` - Tabular feature documentation.
- `/src/features/ontology/server/linkml/` - New canonical LinkML AST mapper, compiler, and symbol cascade service.
- `/src/features/ontology/server/ohi/` - New `ohi.dev` catalog client, dependency resolver, and `ohi.lock.json` v2 verifier.
- `/src/features/ontology/server/queries/` - Ontology read layer projecting DTOs from `linkml_yaml` + `ui_layout`.
- `/src/features/ontology/server/actions/` - Ontology write layer mutating `linkml_yaml` and recompiling artifacts.
- `/src/features/ontology/components/ontology-header/ontology-actions-menu.tsx` - Entry point for the LinkML & Code Compiler Studio dialog.
- `/src/features/ontology/components/left-browser-panel.tsx` - Hosts the `ohi.dev` Standards / Dependencies tab.
- `/src/features/documents/server/actions/extraction.ts` and `/src/features/documents/server/actions/enqueue-extraction-job.ts` - Extraction job dispatchers.
- `/services/internal-extractor/src/internal_extractor/kg_builder.py` and `schema_mapper.py` - Python LLM extraction pipeline.
- `/services/reasoner/src/reasoner/` - Python Oxigraph RDFS + pySHACL validation worker.

---

## New or Changed Components & Subcomponents

- `/src/features/ontology/components/compiler-studio-dialog/compiler-studio-dialog.tsx`
  - `compiler-format-tabs.tsx`
  - `artifact-code-viewer.tsx`
  - `raw-linkml-editor-tab.tsx`
  - `ohi-manifest-lock-tab.tsx`
  - `types.ts`

- `/src/features/ontology/components/standards-browser/standards-browser.tsx`
  - `ohi-package-search-bar.tsx`
  - `ohi-package-card.tsx`
  - `ohi-dependency-tree-preview.tsx`
  - `ohi-lockfile-status-bar.tsx`
  - `types.ts`

- `/src/features/documents/components/export-kg-bundle-dialog/export-kg-bundle-dialog.tsx`
  - `bundle-artifact-selector.tsx`
  - `provo-lineage-preview.tsx`
  - `pydantic-usage-snippet.tsx`
  - `types.ts`
