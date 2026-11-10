# Phase 1: Core `@neverblink/linkml` AST Mapper, Compiler & Importer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: `done`

**Goal:** Install `@neverblink/linkml@0.18.2`, build the lossless Workbench DTO ↔ LinkML YAML AST mapper (`src/features/ontology/server/linkml/ast-mapper.ts`), build the multi-format compiler (`shacl`, `rdfs`, `owl`, `pydantic`, `jsonSchema`, `frictionless`, `erDiagram`, `lint`), and replace the handwritten SHACL/OWL string builders and Turtle importer.

**Architecture:** A focused server-side toolchain in `src/features/ontology/server/linkml/` wraps `@neverblink/linkml` (`LinkML.loadFromString`, `LinkML.fromOwl`, `LinkML.lint`). It maps workbench domain structures (`OntologyDocument`, `OntologyModule`, `OntologyClass`, `OntologyAttribute`, `OntologyRelation`, `OntologyRelationAttribute`, restrictions, disjointness, notes, examples, localized texts) to and from canonical LinkML YAML using deterministic symbol keys (`<classKey>`, `<classKey>.<attrKey>`, `<relationKey>`, `<relationKey>.<attrKey>`).

**Tech Stack:** TypeScript, `@neverblink/linkml@0.18.2`, Node.js `crypto`, `n3`, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md` (Sections 5.2 & 5.4)

## Global Constraints

- Use `pnpm` only (`npm exec pnpm -- <cmd>` if `pnpm` is not on PATH).
- Guard browser environments before importing `@neverblink/linkml`: `if (typeof globalThis.process === "undefined") { (globalThis as Record<string, unknown>).process = { cwd: () => "/" } }`.
- Avoid `any`; keep all LinkML AST structures and compiler outputs strictly typed.
- Run `pnpm check` at the end of the phase to verify lint, typecheck, tests, and build.

## Review Focus

1. **Duplicate Relation Names Across Different Classes:** Two relations with the same label (e.g. `part_of` between `Chapter → Book` and `Engine → Car`) must not overwrite each other in LinkML top-level `slots:`; disambiguate colliding slot keys as `<domainKey>__<relationName>__<rangeKey>` with `slot_uri` / `annotations.kg_display_name` preserving `part_of`.
2. **Invalid / Non-NCName Identifiers in User Class Names:** User class or attribute names with spaces or special characters must be sanitized or quoted cleanly in LinkML YAML without breaking `LinkML.loadFromString`.
3. **Cyclic Class Inheritance (`is_a` cycles):** If a user creates a parent cycle (`A -> B -> A`), `compileLinkmlOntology` must return a structured lint report issue rather than throwing an unhandled exception.
4. **Empty Ontology Compilation:** A newly created ontology with zero classes or relations must still compile valid LinkML YAML, SHACL, RDFS, OWL, and Pydantic code without crashing.
5. **Lossless Metadata Round-Trip:** Workbench-specific fields (`instance_policy`, `notes`, `localized_texts`, `examples`, `relation_attributes`, `cardinality`) stored in LinkML `annotations` must round-trip 100% intact through `dtoToLinkmlYaml` → `linkmlYamlToDto`.

---

### Task 1: Install `@neverblink/linkml` & Define Canonical Types `done`

**Files:**

- Modify: `package.json`
- Create: `src/features/ontology/server/linkml/types.ts`
- Test: `tests/linkml-types-and-shim.test.ts`

**Interfaces:**

- Produces:
  - `CompiledOntologyArtifacts` (`source_sha256`, `compiled_at`, `shacl_ttl`, `rdfs_ttl`, `owl_ttl`, `pydantic_py`, `json_schema`, `er_diagram`, `lint_issues`)
  - `OntologyUiLayout` (`classPositions: Record<string, Record<string, { x: number; y: number }>>`, `moduleLayouts: Record<string, { x: number; y: number; width: number; height: number }>`)
  - `CanonicalOntologySnapshot` (full DTO bundle representing an ontology document and all nested entities for AST mapping)
  - `loadLinkmlRuntime()` helper in `src/features/ontology/server/linkml/runtime.ts`

- [ ] **Step 1: Install `@neverblink/linkml@0.18.2`**
      Run: `npm exec pnpm -- add @neverblink/linkml@0.18.2`

- [ ] **Step 2: Write the failing runtime & types test**
      Create `tests/linkml-types-and-shim.test.ts` verifying `loadLinkmlRuntime()` loads `LinkML.buildInfo()` and parses a minimal schema with `LinkML.loadFromString`.

- [ ] **Step 3: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-types-and-shim.test.ts`

- [ ] **Step 4: Implement `src/features/ontology/server/linkml/types.ts` and `src/features/ontology/server/linkml/runtime.ts`**
      Define `CompiledOntologyArtifacts`, `OntologyUiLayout`, `LinkmlLintIssue`, and `CanonicalOntologySnapshot`, and wrap `@neverblink/linkml` import with the `process.cwd` guard.

- [ ] **Step 5: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/linkml-types-and-shim.test.ts`

- [ ] **Step 6: Commit**
      `git add package.json pnpm-lock.yaml src/features/ontology/server/linkml/types.ts src/features/ontology/server/linkml/runtime.ts tests/linkml-types-and-shim.test.ts`
      `git commit -m "feat(ontology): add @neverblink/linkml runtime and canonical types"`

---

### Task 2: Bidirectional Workbench DTO ↔ LinkML YAML AST Mapper `done`

**Files:**

- Create: `src/features/ontology/server/linkml/ast-mapper.ts`
- Test: `tests/linkml-ast-mapper.test.ts`

**Interfaces:**

- Consumes: `CanonicalOntologySnapshot`, `OntologyUiLayout` from `src/features/ontology/server/linkml/types.ts`
- Produces:
  - `snapshotToLinkmlYaml(snapshot: CanonicalOntologySnapshot): string`
  - `linkmlYamlToSnapshot(ontologyId: string, linkmlYaml: string, uiLayout?: OntologyUiLayout): CanonicalOntologySnapshot`
  - `makeAttributeKey(classKey: string, attrName: string): string` (`"${classKey}.${attrName}"`)
  - `makeRelationAttributeKey(relationKey: string, attrName: string): string` (`"${relationKey}.${attrName}"`)

- [ ] **Step 1: Write the failing round-trip AST mapper tests**
      Create `tests/linkml-ast-mapper.test.ts` testing: 1. Empty ontology round-trip. 2. Full ontology round-trip (modules/subsets, class hierarchy `is_a`, `disjoint_with`, class attributes with `xsd:*` types, relations with cardinalities `1:1`/`1:N`/`N:1` and colliding names across different domain/range pairs, relation attributes, restrictions, notes, localized texts, and examples). 3. Composite symbol key generation (`Person.email`, `works_for.since`).

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-ast-mapper.test.ts`

- [ ] **Step 3: Implement `src/features/ontology/server/linkml/ast-mapper.ts`**
      Map workbench entities to standard LinkML YAML (`id`, `name`, `description`, `in_language`, `prefixes`, `imports: ["linkml:types"]`, `subsets`, `classes`, `slots`) with `annotations` preserving workbench metadata (`kg_instance_policy`, `kg_notes`, `kg_localized_texts`, `kg_examples`, `kg_relation_attributes`, `kg_cardinality`).

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/linkml-ast-mapper.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/linkml/ast-mapper.ts tests/linkml-ast-mapper.test.ts`
      `git commit -m "feat(ontology): implement bidirectional LinkML YAML AST mapper"`

---

### Task 3: Multi-Format Compiler (`shacl`, `rdfs`, `owl`, `pydantic`, `jsonSchema`, `erDiagram`, `lint`) `done`

**Files:**

- Create: `src/features/ontology/server/linkml/compiler.ts`
- Test: `tests/linkml-compiler.test.ts`

**Interfaces:**

- Consumes: `loadLinkmlRuntime()` from `runtime.ts`, `CompiledOntologyArtifacts` from `types.ts`
- Produces:
  - `compileLinkmlOntology(linkmlYaml: string, options?: { imports?: Record<string, string>; importMap?: Record<string, string> }): CompiledOntologyArtifacts`
  - `compileSnapshotArtifacts(snapshot: CanonicalOntologySnapshot, options?: { imports?: Record<string, string>; importMap?: Record<string, string> }): { linkmlYaml: string; artifacts: CompiledOntologyArtifacts }`

- [ ] **Step 1: Write the failing compiler tests**
      Create `tests/linkml-compiler.test.ts` asserting that `compileLinkmlOntology` produces: - Valid W3C SHACL Turtle (`sh:NodeShape`, `sh:PropertyShape`) - Valid RDFS Turtle (`rdfs:Class`, `rdf:Property`, `rdfs:domain`, `rdfs:range`) - Valid OWL 2 Turtle (`owl:Class`, `owl:ObjectProperty`, `owl:DatatypeProperty`) - Valid Python Pydantic v2 code (`class Person(`, `BaseModel`) - Valid JSON Schema and Mermaid `erDiagram` - Deterministic `source_sha256` and structured `lint_issues` on cyclic or broken schemas without throwing unhandled exceptions.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-compiler.test.ts`

- [ ] **Step 3: Implement `src/features/ontology/server/linkml/compiler.ts`**
      Use `LinkML.loadFromString(linkmlYaml, imports, true, importMap)` and invoke `view.shacl({ format: "ttl" })`, `view.rdfs({ format: "ttl" })`, `view.owl({ format: "ttl" })`, `view.pydantic()`, `view.jsonSchema()`, `view.erDiagram()`, and `LinkML.lint(view)`.

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/linkml-compiler.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/linkml/compiler.ts tests/linkml-compiler.test.ts`
      `git commit -m "feat(ontology): add @neverblink/linkml multi-format compiler"`

---

### Task 4: Replace Legacy SHACL/OWL String Builders & Upgrade Importer `done`

**Files:**

- Modify: `src/features/ontology/server/shacl/generator.ts`
- Modify: `src/features/ontology/server/actions/ontology-owl-export.ts`
- Modify: `src/features/ontology/server/actions/ontology-shacl-export.ts`
- Modify: `src/features/ontology/server/services/turtle-importer/parse-turtle-to-ontology.ts`
- Test: `tests/linkml-export-import-integration.test.ts`

**Interfaces:**

- Consumes: `compileSnapshotArtifacts`, `snapshotToLinkmlYaml`, `linkmlYamlToSnapshot`, `LinkML.fromOwl`
- Produces:
  - Updated `buildShaclShapes` delegating to `@neverblink/linkml` `view.shacl()` (with fallback for legacy partial test inputs)
  - Updated `parseTurtleToOntology` using `LinkML.fromOwl` + `linkmlYamlToSnapshot` (with `n3` fallback for non-standard Turtle snippets)
  - New `exportOntologyArtifactsAction(ontologyId, format: "linkml-yaml" | "shacl-ttl" | "rdfs-ttl" | "owl-ttl" | "pydantic-py" | "json-schema" | "er-diagram")`

- [ ] **Step 1: Write failing integration tests for OWL/Turtle import & multi-format export**
      Create `tests/linkml-export-import-integration.test.ts` testing importing an OWL Turtle ontology via `LinkML.fromOwl` and exporting SHACL, RDFS, OWL, and Pydantic classes.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-export-import-integration.test.ts`

- [ ] **Step 3: Update `generator.ts`, `ontology-owl-export.ts`, `ontology-shacl-export.ts`, and `parse-turtle-to-ontology.ts`**
      Wire `@neverblink/linkml` into the existing export and import entry points while keeping all existing unit tests in `tests/` passing.

- [ ] **Step 4: Run full check suite**
      Run: `npm exec pnpm -- check`
      Expected: All lint, typecheck, test, and build checks PASS.

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/ tests/linkml-export-import-integration.test.ts`
      `git commit -m "feat(ontology): wire @neverblink/linkml into SHACL/OWL/RDFS/Pydantic exporters and importer"`
