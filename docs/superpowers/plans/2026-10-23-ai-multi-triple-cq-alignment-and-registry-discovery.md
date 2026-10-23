# AI Multi-Triple Competency Question Alignment & Registry Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable multi-triple graph patterns for Competency Questions, integrate external registry discovery with a human-in-the-loop vocabulary checkpoint, and synthesize a formal OWL ontology as the knowledge graph data model.

**Architecture:** A normalized `ontology_cq_triples` table stores ordered multi-hop graph patterns per CQ. A two-phase guided generation wizard queries external registries (OLS4, LOV, BARTOC, etc.) to differentiate active vs. missing ontologies, presents a human-in-the-loop selection checkpoint, and guides the LLM to synthesize connected multi-triple paths grounded in confirmed standards.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM, PostgreSQL, Zod, TanStack Query, Tailwind CSS, shadcn/ui.

**Spec:** [docs/superpowers/specs/2026-10-23-ai-multi-triple-cq-alignment-and-registry-discovery-design.md](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-10-23-ai-multi-triple-cq-alignment-and-registry-discovery-design.md)

## Global Constraints

- Use pnpm only (`npm exec pnpm -- <command>` on Windows).
- Maintain App Router and Server Component patterns; keep React Flow / interactive editors in client components.
- Run database modifications transactionally using `db.transaction`.
- Avoid breaking changes to existing single-triple CQs: migrate existing bindings to `sort_order = 0` in `ontology_cq_triples`.
- Colors and typography must follow single points of truth in `src/app/globals.css` and `src/lib/colors.ts`.
- Every route used in navigation must come from `src/lib/routes.ts`.

## Review Focus

- CQs with zero triples must evaluate to `unmapped` status in coverage calculations without throwing runtime errors.
- Deleting an ontology class or relation must set foreign keys in `ontology_cq_triples` to NULL (`onDelete: "set null"`), preserving the CQ and remaining hops.
- Registry discovery timeouts or offline endpoints must fall back to local reference ontologies gracefully without crashing the generation wizard.
- LLM outputs containing disjoint intermediate nodes (e.g. triple 1 object does not match triple 2 subject) must be auto-healed or preserved without failing Zod validation.
- Applying a draft with 0 selected external vocabularies must proceed smoothly with standard schema synthesis.

---

### Task 1: Relational Schema & Migration for `ontology_cq_triples`

**Files:**

- Modify: `src/server/db/schema.ts`
- Create: `scripts/migrations/migrate-cq-triples.mjs`
- Test: `tests/cq-triples-schema.test.ts`

**Interfaces:**

- Consumes: `ontologyCompetencyQuestions`, `ontologyClasses`, `ontologyRelations`, `ontologyExamples` from `src/server/db/schema.ts`
- Produces: `ontologyCqTriples` table and TypeScript type `OntologyCqTriple`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cq-triples-schema.test.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ontologyCqTriples } from "../src/server/db/schema.js"

describe("ontologyCqTriples schema", () => {
  it("defines the table with required foreign keys and sort_order", () => {
    assert.ok(ontologyCqTriples)
    assert.equal(ontologyCqTriples.cq_id.name, "cq_id")
    assert.equal(ontologyCqTriples.sort_order.name, "sort_order")
    assert.equal(ontologyCqTriples.subject_class_id.name, "subject_class_id")
    assert.equal(
      ontologyCqTriples.predicate_relation_id.name,
      "predicate_relation_id"
    )
    assert.equal(ontologyCqTriples.object_class_id.name, "object_class_id")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cq-triples-schema.test.ts`
Expected: FAIL with `ontologyCqTriples is not exported from schema`

- [ ] **Step 3: Define `ontologyCqTriples` in `src/server/db/schema.ts` and write migration script**

Add `ontologyCqTriples` pgTable definition with indexes and foreign keys. Create `scripts/migrations/migrate-cq-triples.mjs` to execute DDL and backfill existing single triples from `ontology_competency_questions`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cq-triples-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts scripts/migrations/migrate-cq-triples.mjs tests/cq-triples-schema.test.ts
git commit -m "feat(schema): add ontology_cq_triples table and migration backfill"
```

---

### Task 2: Multi-Triple CQ Coverage Engine & Query Integration

**Files:**

- Modify: `src/features/ontology/utils/cq-coverage.ts`
- Modify: `src/features/ontology/server/queries/competency-questions.ts`
- Modify: `src/features/ontology/server/queries/types.ts`
- Test: `tests/cq-coverage-multi-triple.test.ts`

**Interfaces:**

- Consumes: `OntologyCqTriple` from schema
- Produces: `evaluateCqCoverage`, `calculateCqCoverageSummary` supporting multi-triple paths, `getOntologyCQs` returning CQs with `triples: OntologyCqTriple[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cq-coverage-multi-triple.test.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { evaluateCqCoverage } from "../src/features/ontology/utils/cq-coverage.js"

describe("evaluateCqCoverage multi-triple", () => {
  const classes = [
    { id: "c1", name: "Station" },
    { id: "c2", name: "Sensor" },
  ]
  const relations = [{ id: "r1", name: "hasSensor" }]

  it("evaluates to full when all triples in a multi-hop path are mapped", () => {
    const cq = {
      id: "cq-1",
      question: "Which sensors are on the station?",
      triples: [
        {
          subject_class_id: "c1",
          predicate_relation_id: "r1",
          object_class_id: "c2",
        },
      ],
    }
    const result = evaluateCqCoverage(cq, classes, relations)
    assert.equal(result.status, "full")
  })

  it("evaluates to partial when only some hops in a multi-hop path are mapped", () => {
    const cq = {
      id: "cq-2",
      question: "Which sensors measure temp on station?",
      triples: [
        {
          subject_class_id: "c1",
          predicate_relation_id: "r1",
          object_class_id: "c2",
        },
        {
          subject_class_id: "c2",
          predicate_relation_id: null,
          object_class_id: null,
        },
      ],
    }
    const result = evaluateCqCoverage(cq, classes, relations)
    assert.equal(result.status, "partial")
  })

  it("evaluates to unmapped when zero triples exist", () => {
    const cq = { id: "cq-3", question: "Unmapped?", triples: [] }
    const result = evaluateCqCoverage(cq, classes, relations)
    assert.equal(result.status, "unmapped")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cq-coverage-multi-triple.test.ts`
Expected: FAIL due to missing `triples` support in `evaluateCqCoverage`.

- [ ] **Step 3: Update `cq-coverage.ts` and `getOntologyCQs` query**

Update `evaluateCqCoverage` and `calculateCqCoverageSummary` to iterate over `cq.triples ?? []` (with fallback to legacy columns if triples array is empty). Update `getOntologyCQs` in `competency-questions.ts` to join `ontologyCqTriples`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cq-coverage-multi-triple.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/utils/cq-coverage.ts src/features/ontology/server/queries/ tests/cq-coverage-multi-triple.test.ts
git commit -m "feat(ontology): update CQ coverage evaluation to support multi-triple paths"
```

---

### Task 3: Domain Vocabulary Discovery & Registry Diffing Service

**Files:**

- Create: `src/features/ontology/server/services/vocabulary-registries/domain-discovery.ts`
- Test: `tests/registry-discovery-diff.test.ts`

**Interfaces:**

- Consumes: `searchRegistries` from `src/features/ontology/server/services/vocabulary-registries`
- Produces: `discoverCandidateRegistries(ontologyId, usecase, cqs)` returning `{ activeVocabularies, recommendedVocabularies }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/registry-discovery-diff.test.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { extractDomainKeywords } from "../src/features/ontology/server/services/vocabulary-registries/domain-discovery.js"

describe("domain-discovery keyword extraction", () => {
  it("extracts relevant noun phrases and removes stop words from CQs", () => {
    const cqs = [
      {
        question:
          "Which sensors measure water temperature on the weather station?",
      },
      { question: "What is the platform observation interval?" },
    ]
    const keywords = extractDomainKeywords(
      "Marine Environmental Monitoring",
      cqs
    )
    assert.ok(keywords.includes("sensor") || keywords.includes("sensors"))
    assert.ok(keywords.includes("temperature"))
    assert.ok(!keywords.includes("which"))
    assert.ok(!keywords.includes("what"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/registry-discovery-diff.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `domain-discovery.ts`**

Implement `extractDomainKeywords` and `discoverCandidateRegistries(trimmedOntologyId, usecase, cqs)`. Query existing `reference_ontologies` in the DB to filter out already imported vocabularies and query `searchRegistries` for candidates, returning categorized results with match rationale.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/registry-discovery-diff.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/vocabulary-registries/domain-discovery.ts tests/registry-discovery-diff.test.ts
git commit -m "feat(vocabularies): add domain concept extraction and registry diffing service"
```

---

### Task 4: AI Generation Zod Schema, Multi-Hop Prompting, & Auto-Healer

**Files:**

- Modify: `src/features/ontology/schemas/ai-generation.ts`
- Modify: `src/features/ontology/server/services/ai-ontology-generator/prompt-builder.ts`
- Modify: `src/features/ontology/server/services/ai-ontology-generator/auto-healer.ts`
- Test: `tests/ai-cq-multi-triple-schema.test.ts`
- Test: `tests/ai-auto-healer-multi-triple.test.ts`

**Interfaces:**

- Consumes: `GeneratedCQTripleSchema`, `GeneratedCQMappingSchema`
- Produces: Updated `GeneratedOntologyDraftSchema` with `triples: GeneratedCQTriple[]`, multi-triple prompt instructions, and auto-healer supporting multi-hop paths.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ai-cq-multi-triple-schema.test.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { GeneratedCQMappingSchema } from "../src/features/ontology/schemas/ai-generation.js"

describe("GeneratedCQMappingSchema multi-triple", () => {
  it("validates an ordered array of connected triples", () => {
    const raw = {
      cqId: "550e8400-e29b-41d4-a716-446655440000",
      moduleNames: ["Sensors"],
      triples: [
        {
          subjectClassName: "Station",
          predicateRelationName: "hasSensor",
          objectClassName: "Sensor",
        },
        {
          subjectClassName: "Sensor",
          predicateRelationName: "measuresProperty",
          objectClassName: "Temperature",
        },
      ],
    }
    const parsed = GeneratedCQMappingSchema.parse(raw)
    assert.equal(parsed.triples.length, 2)
    assert.equal(parsed.triples[0].predicateRelationName, "hasSensor")
    assert.equal(parsed.triples[1].predicateRelationName, "measuresProperty")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-cq-multi-triple-schema.test.ts`
Expected: FAIL with schema mismatch (expecting old single triple fields).

- [ ] **Step 3: Update `ai-generation.ts`, `prompt-builder.ts`, and `auto-healer.ts`**

1. In `ai-generation.ts`, add `GeneratedCQTripleSchema` and update `GeneratedCQMappingSchema` with `triples: z.array(GeneratedCQTripleSchema).min(1)`.
2. In `prompt-builder.ts`, instruct the LLM to decompose each CQ into a chain of connected triples and ground the schema in confirmed reference standards.
3. In `auto-healer.ts`, iterate over all triples in each CQ mapping, ensuring referenced subject/object classes and predicate relations are synthesized into the schema if missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-cq-multi-triple-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/schemas/ai-generation.ts src/features/ontology/server/services/ai-ontology-generator/ tests/ai-cq-multi-triple-schema.test.ts
git commit -m "feat(ai-generator): update Zod schemas and prompt builder for multi-triple graph patterns"
```

---

### Task 5: Transactional Draft Application & Service Integration

**Files:**

- Modify: `src/features/ontology/server/actions/generate-ontology.ts`
- Test: `tests/apply-draft-multi-triple.test.ts`

**Interfaces:**

- Consumes: `GeneratedOntologyDraft` with `triples`
- Produces: `applyOntologyDraft(ontologyId, draft)` writing to `ontology_cq_triples` atomically

- [ ] **Step 1: Write the failing test**

```typescript
// tests/apply-draft-multi-triple.test.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { GeneratedOntologyDraftSchema } from "../src/features/ontology/schemas/ai-generation.js"

describe("Draft application validation", () => {
  it("parses draft with multi-triple mappings", () => {
    const draft = {
      modules: [{ name: "Core", description: "" }],
      classes: [
        { name: "Buoy", moduleName: "Core", description: "", attributes: [] },
        { name: "Sensor", moduleName: "Core", description: "", attributes: [] },
      ],
      relations: [
        {
          name: "hasSensor",
          domainClassName: "Buoy",
          rangeClassName: "Sensor",
          description: "",
        },
      ],
      cqMappings: [
        {
          cqId: "550e8400-e29b-41d4-a716-446655440000",
          moduleNames: ["Core"],
          triples: [
            {
              subjectClassName: "Buoy",
              predicateRelationName: "hasSensor",
              objectClassName: "Sensor",
            },
          ],
        },
      ],
      suggestedContext: [],
    }
    const parsed = GeneratedOntologyDraftSchema.parse(draft)
    assert.equal(parsed.cqMappings[0].triples.length, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/apply-draft-multi-triple.test.ts`
Expected: PASS or initial baseline check.

- [ ] **Step 3: Update `applyOntologyDraft` in `generate-ontology.ts`**

Update the transaction loop in `applyOntologyDraft`:

1. Clean out previous triples for mapped CQs in `ontologyCqTriples`.
2. Insert each triple from `mapping.triples` into `ontologyCqTriples` with resolved `subject_class_id`, `predicate_relation_id`, `object_class_id`, and `sort_order: index`.
3. Update legacy columns on `ontology_competency_questions` with the first triple for backward compatibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/apply-draft-multi-triple.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/actions/generate-ontology.ts tests/apply-draft-multi-triple.test.ts
git commit -m "feat(ontology): apply draft writes multi-triple mappings atomically to ontology_cq_triples"
```

---

### Task 6: Guided AI Generation Wizard UI (Explanatory Stepper & Vocabulary Checkpoint)

**Files:**

- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-dialog.tsx`
- Create: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-vocabulary-checkpoint-step.tsx`
- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-review-step.tsx`
- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-config-step.tsx`

**Interfaces:**

- Consumes: `discoverCandidateRegistries`, `generateOntologyDraft`, `applyOntologyDraft`
- Produces: Guided 3-step wizard with explanatory header, vocabulary checkpoint, multi-triple CQ review, and OWL foundation summary.

- [ ] **Step 1: Create `ai-vocabulary-checkpoint-step.tsx`**

Build component showing active reference ontologies and recommended external vocabularies with checkboxes, description, source registry badge, and "Import Selected & Generate" action.

- [ ] **Step 2: Update `ai-generate-dialog.tsx` with Stepper and Explanatory Header**

Add 3-step stepper:

1. `Discover Standards`
2. `Synthesize Graph Patterns`
3. `Staged Review & OWL Preview`
   Add context header explaining that the output is a formal OWL ontology data model.

- [ ] **Step 3: Update `ai-generate-review-step.tsx` for Multi-Triple Paths**

Render CQ mappings with interactive connected triple chips:
`[Subject] ──(predicate)──► [Object] ──(predicate)──► [Target]`

- [ ] **Step 4: Run linter and typecheck**

Run: `npm exec pnpm -- typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/
git commit -m "feat(ui): add guided generation wizard with vocabulary checkpoint and multi-triple review"
```

---

### Task 7: CQ Workbench Multi-Triple Path Visualization & Editing UI

**Files:**

- Modify: `src/features/ontology/components/cq-workbench/cq-list-panel/cq-list-item.tsx`
- Modify: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-concept-mapping-card.tsx`
- Modify: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-detail-panel.tsx`
- Modify: `src/features/ontology/server/actions/competency-questions.ts`

**Interfaces:**

- Consumes: `cq.triples` on `OntologyCQWithModules`
- Produces: Multi-hop graph path chips in list panel, multi-triple card editor in detail panel with "+ Add Triple" and delete controls.

- [ ] **Step 1: Update `competency-questions.ts` server actions**

Add `updateCQTriples(cqId, triples: Array<{ subjectClassId, predicateRelationId, objectClassId, sortOrder }>)`.

- [ ] **Step 2: Update `cq-list-item.tsx`**

Display multi-hop path chips (e.g. `2 hops` or `[A] -> [B] -> [C]`) instead of just a single class badge.

- [ ] **Step 3: Update `cq-concept-mapping-card.tsx`**

Render a list of triple rows with reordering, class/relation pickers per row, and an "+ Add Hop" button to formulate multi-hop graph patterns.

- [ ] **Step 4: Run typecheck**

Run: `npm exec pnpm -- typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/cq-workbench/ src/features/ontology/server/actions/competency-questions.ts
git commit -m "feat(cq-workbench): support multi-triple graph pattern visualization and editing"
```

---

### Task 8: Full Verification & Integration Testing

**Files:**

- Test: All unit and integration test files
- Verification: End-to-end linting, typechecking, and build

- [ ] **Step 1: Run complete test suite**

Run: `npm exec pnpm -- test`
Expected: All tests pass.

- [ ] **Step 2: Run linter and format check**

Run: `npm exec pnpm -- lint`
Expected: 0 lint errors.

- [ ] **Step 3: Run full build check**

Run: `npm exec pnpm -- check`
Expected: All checks pass (lint, typecheck, test, build).

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: verify multi-triple CQ alignment and registry discovery test suite"
```
