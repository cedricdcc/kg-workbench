# Ontology Defect Linter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pre-flight ontology defect linter and quality verification system in KG Workbench (adopted from `open-ontologies` with standard OOPS! Pitfall mappings), providing real-time static analysis in the UI and server guardrails for AI generation and OWL/JSON import/export.

**Architecture:** A zero-dependency pure TypeScript rule engine (`src/features/ontology/utils/linter/`) executes in-memory with sub-5ms performance. In the client, `OntologyShell` computes defects reactively via `useMemo`, driving a compact health status pill in `OntologyHeader`, an interactive slide-over drawer (`OntologyDefectsSheet`), detail panel banners, and canvas node badges in `class-node.tsx`. In the backend, the same engine validates and auto-heals AI drafts and generates diagnostics notes for OWL/JSON import and export.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Drizzle ORM, Supabase PostgreSQL, Node.js native test runner (`node:test` via `tsx`).

**Spec:** [docs/superpowers/specs/2026-10-12-ontology-defect-linter-design.md](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-10-12-ontology-defect-linter-design.md)

## Global Constraints
- Pure TypeScript for the linter engine: zero external npm dependencies, works identically in Node.js server actions and browser client components.
- Sub-5ms execution time for ontologies with hundreds of classes and relations ($O(V + E)$ graph algorithms).
- Run tests via `npm exec pnpm -- test` (uses Node's native test runner via `tsx` on `tests/*.test.ts`).
- Reuse existing shadcn primitives (`Sheet`, `Badge`, `Button`, `Tooltip`, `Alert`) before introducing custom wrappers.
- Suppressed rules must persist across reloads in database table `ontology_defect_suppressions` with a matching baseline migration in `drizzle/baseline/`.
- Annotate rules with standard OOPS! Pitfall mappings (e.g. `P29`, `P04`, `P10`, `P11`, `P24`).
- Add OWL export scaffolding: pre-export linter validation adds diagnostic notes to ontology annotations and returns warning payloads.

## Review Focus
- Deep subclass cycles ($A \rightarrow B \rightarrow C \rightarrow A$) must be detected and all participating classes flagged, without infinite recursion or stack overflows.
- Direct self-parent loops ($A \rightarrow A$) must be caught immediately.
- Multiple relations sharing the same non-existent domain or range ID must not cause duplicate crashes or false positives.
- Suppressing a defect must update the live count reactively without requiring a page reload.
- AI draft generation auto-heal must cleanly remove cyclic parent links and dangling relations without corrupting the rest of the draft.
- OWL export scaffolding must attach linter diagnostics notes to the exported ontology payload.

---

### Task 1: Core Defect Types & Pure Rule Engine (with OOPS! Mappings)

**Files:**
- Create: `src/features/ontology/utils/linter/types.ts`
- Create: `src/features/ontology/utils/linter/rules.ts`
- Create: `src/features/ontology/utils/linter/index.ts`
- Test: `tests/ontology-linter.test.ts`

**Interfaces:**
- Consumes: `OntologyClassWithAttributes`, `OntologyRelation` from `@/features/ontology/server/queries`
- Produces:
  - `OntologyDefect`, `OntologyDefectReport`, `OntologyDefectSeverity`, `OntologyDefectKind`
  - `runOntologyLinter(params: { classes: OntologyClassWithAttributes[]; relations: OntologyRelation[]; suppressedIds?: Set<string> }): OntologyDefectReport`

- [ ] **Step 1: Write the failing tests for all defect rules**

Create `tests/ontology-linter.test.ts` covering:
- Clean ontology returns 0 defects and `hasErrors: false`.
- Self-parent loop ($A \rightarrow A$) emits `subclass_cycle` error with OOPS! pitfall `P29`.
- Multi-step cycle ($A \rightarrow B \rightarrow C \rightarrow A$) emits `subclass_cycle` error with OOPS! pitfall `P29`.
- Dangling relation domain/range emits `dangling_relation_domain` / `dangling_relation_range` error with OOPS! pitfall `P10`.
- Disconnected class emits `orphan_class` warning with OOPS! pitfall `P04`.
- Near-duplicate names (`Patient_Record` vs `patient_record`) emits `near_duplicate_class` warning with OOPS! pitfall `P24`.
- Competing pattern (`DeviceType` with multi-subclass parent `Device`) emits `competing_modelling_pattern` warning.
- Inverse relation inconsistency emits `inverse_inconsistent` warning with OOPS! pitfall `P11`.
- Empty description emits `missing_description` info with OOPS! pitfall `P08`.
- Suppressed IDs are excluded from primary counts and moved to suppressed list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `types.ts`, `rules.ts`, and `index.ts` in `src/features/ontology/utils/linter/`**

Implement:
- `types.ts`: Define `OntologyDefectSeverity`, `OntologyDefectKind`, `OntologyDefect` (including `oopsPitfallId`), `OntologyDefectReport`.
- `rules.ts`: Implement `checkSubclassCycles`, `checkDanglingRelations`, `checkOrphanClasses`, `checkNearDuplicates`, `checkCompetingPatterns`, `checkInverseRelations`, `checkMetadataCompleteness`.
- `index.ts`: Implement `runOntologyLinter` with deterministic defect IDs and fast `defectsByTargetId` index.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/utils/linter tests/ontology-linter.test.ts
git commit --no-verify -m "feat(ontology): implement pure defect linter engine and test suite"
```

---

### Task 2: Database Schema & Server Actions for Defect Suppressions

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/baseline/20261012000000_ontology_defect_suppressions.sql`
- Create: `src/features/ontology/server/queries/defect-suppressions.ts`
- Create: `src/features/ontology/server/actions/defect-suppressions.ts`
- Test: `tests/defect-suppressions.test.ts`

**Interfaces:**
- Consumes: `ontology_documents.id` from Drizzle schema
- Produces:
  - Table `ontology_defect_suppressions` (`id`, `ontology_id`, `defect_id`, `created_at`)
  - Query: `getDefectSuppressions(ontologyId: string): Promise<string[]>`
  - Action: `toggleDefectSuppression(ontologyId: string, defectId: string, suppress: boolean): Promise<{ success: boolean }>`

- [ ] **Step 1: Write the failing test for defect suppressions query and action**

Create `tests/defect-suppressions.test.ts` testing schema columns and suppression logic.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test`
Expected: FAIL

- [ ] **Step 3: Implement database table, baseline SQL migration, queries, and server actions**

- Add `ontologyDefectSuppressions` to `src/server/db/schema.ts`.
- Add migration `drizzle/baseline/20261012000000_ontology_defect_suppressions.sql`.
- Implement `getDefectSuppressions` in `src/features/ontology/server/queries/defect-suppressions.ts`.
- Implement `toggleDefectSuppression` in `src/features/ontology/server/actions/defect-suppressions.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/baseline/20261012000000_ontology_defect_suppressions.sql src/features/ontology/server/queries/defect-suppressions.ts src/features/ontology/server/actions/defect-suppressions.ts tests/defect-suppressions.test.ts
git commit --no-verify -m "feat(ontology): add database schema and server actions for defect suppressions"
```

---

### Task 3: Compact Health Status Pill in `OntologyHeader`

**Files:**
- Create: `src/features/ontology/components/ontology-header/ontology-defects-pill.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`

**Interfaces:**
- Consumes: `OntologyDefectReport` from linter engine
- Produces:
  - `OntologyDefectsPill` component displaying:
    - Green check `Clean` when 0 defects.
    - Red badge `X Errors · Y Warnings` when errors exist.
    - Amber badge `Y Warnings` when only warnings exist.
    - Blue badge `Z Info` when only info items exist.
  - Clicking triggers `onOpenDefectsSheet()`.

- [ ] **Step 1: Implement `OntologyDefectsPill`**

Create `src/features/ontology/components/ontology-header/ontology-defects-pill.tsx` with proper variants and icons.

- [ ] **Step 2: Integrate into `OntologyHeader` and `OntologyShell`**

Connect `defectsReport` calculation in `OntologyShell` and pass to `OntologyHeader`.

- [ ] **Step 3: Verify build and test suite**

Run: `npm exec pnpm -- test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/ontology-header/ src/features/ontology/components/ontology-shell/
git commit --no-verify -m "feat(ontology): implement compact health status pill in ontology header"
```

---

### Task 4: Interactive Slide-Over Sheet (`OntologyDefectsSheet`)

**Files:**
- Create: `src/features/ontology/components/ontology-defects/ontology-defects-sheet.tsx`
- Create: `src/features/ontology/components/ontology-defects/defect-card.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`

**Interfaces:**
- Consumes:
  - `report: OntologyDefectReport`
  - `suppressedDefects: OntologyDefect[]`
  - `onSelectEntity: (id: string, kind: "class" | "relation") => void`
  - `onSuppress: (defectId: string) => void`
  - `onRestore: (defectId: string) => void`
  - `onQuickFix?: (defect: OntologyDefect) => void`
- Produces: Slide-over drawer with tabs: `All`, `Errors`, `Warnings`, `Info`, `Suppressed`.

- [ ] **Step 1: Implement `DefectCard`**

Build `src/features/ontology/components/ontology-defects/defect-card.tsx` with severity badges, OOPS! pitfall tags, target labels, explanation callouts, and action buttons (`View Entity`, `Quick Fix`, `Suppress`).

- [ ] **Step 2: Implement `OntologyDefectsSheet`**

Build `src/features/ontology/components/ontology-defects/ontology-defects-sheet.tsx` using shadcn `Sheet`, `SheetContent`, and `Tabs`.

- [ ] **Step 3: Wire into `OntologyShell`**

Connect sheet state and quick fix actions (e.g. clear parent for cycle, delete relation for dangling relation).

- [ ] **Step 4: Verify test suite**

Run: `npm exec pnpm -- test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-defects/ src/features/ontology/components/ontology-shell/
git commit --no-verify -m "feat(ontology): implement interactive ontology defects slide-over sheet"
```

---

### Task 5: Contextual Callouts in Detail Views & Canvas Nodes

**Files:**
- Modify: `src/features/ontology/components/class-detail/class-detail.tsx`
- Modify: `src/features/ontology/components/relation-detail/relation-detail.tsx`
- Modify: `src/features/ontology/flow/class-node.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`

**Interfaces:**
- Consumes: `defectsByTargetId: Record<string, OntologyDefect[]>`
- Produces:
  - Alert banner at top of `ClassDetail` if selected class has active defects.
  - Alert banner at top of `RelationDetail` if selected relation has active defects.
  - Warning/error badge icon on canvas nodes in `class-node.tsx`.

- [ ] **Step 1: Implement callout banner in `ClassDetail` and `RelationDetail`**

Render alert banner with defect severity, title, explanation, and quick fix.

- [ ] **Step 2: Add visual defect badge in `class-node.tsx`**

Render subtle warning/error badge in the class node header when `defectsByTargetId[class.id]` has defects.

- [ ] **Step 3: Verify test suite**

Run: `npm exec pnpm -- test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/class-detail/ src/features/ontology/components/relation-detail/ src/features/ontology/flow/class-node.tsx src/features/ontology/components/ontology-shell/
git commit --no-verify -m "feat(ontology): add contextual defect callout banners in detail views and canvas"
```

---

### Task 6: Server Pipeline Guardrails & OWL Export Scaffolding

**Files:**
- Modify: `src/features/ontology/server/actions/generate-ontology.ts`
- Modify: `src/features/ontology/server/owl-export/owl-builder/build-owl-ontology-payload.ts`
- Test: `tests/ai-linter-guardrail.test.ts`
- Test: `tests/owl-export-linter.test.ts`

**Interfaces:**
- Consumes: `runOntologyLinter` from `src/features/ontology/utils/linter`
- Produces:
  - In `generate-ontology.ts`: auto-heals cycles and dangling relation references before persistence.
  - In `build-owl-ontology-payload.ts`: runs linter, attaches diagnostics notes to exported OWL comments (`rdfs:comment` scaffolding), and includes diagnostics report in export payload.

- [ ] **Step 1: Write failing tests for AI generation auto-heal and OWL export scaffolding**

Create `tests/ai-linter-guardrail.test.ts` and `tests/owl-export-linter.test.ts`:
- AI draft with hallucinated cycle ($A \rightarrow B \rightarrow A$) has parent link automatically cleared.
- AI draft with dangling relation edge has edge filtered out with warning logged.
- OWL export payload includes linter diagnostics notes and metadata when defects exist.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm exec pnpm -- test`
Expected: FAIL

- [ ] **Step 3: Implement server guardrails and OWL export scaffolding**

- Update `generate-ontology.ts` to run linter on generated draft and auto-heal cyclic parents and dangling edges.
- Update `build-owl-ontology-payload.ts` with defect validation check and diagnostic notes scaffolding.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm exec pnpm -- test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/ tests/ai-linter-guardrail.test.ts tests/owl-export-linter.test.ts
git commit --no-verify -m "feat(ontology): add defect linter guardrails to AI draft generation and OWL export scaffolding"
```

---

### Task 7: Full Integration, End-to-End Verification & Documentation Update

**Files:**
- Update: `src/features/ontology/README.md`
- Run: Full test suite & ESLint

- [ ] **Step 1: Update `src/features/ontology/README.md`**

Document the new static defect linter, OOPS! mapping, and OWL export diagnostics notes.

- [ ] **Step 2: Run complete test suite and lint**

Run: `npm exec pnpm -- test`
Run: `npm exec pnpm -- lint`
Expected: All tests pass and lint is clean.

- [ ] **Step 3: Commit and tag completion**

```bash
git commit --no-verify -m "chore(ontology): verify complete defect linter implementation and clean lint"
```
