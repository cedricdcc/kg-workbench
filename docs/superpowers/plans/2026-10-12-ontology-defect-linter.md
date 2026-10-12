# Ontology Defect Linter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pre-flight ontology defect linter and quality verification system in KG Workbench (adopted from `open-ontologies`), providing real-time static analysis in the UI and server guardrails for AI generation and imports.

**Architecture:** A zero-dependency pure TypeScript rule engine (`src/features/ontology/utils/linter/`) executes in-memory with sub-5ms performance. In the client, `OntologyShell` computes defects reactively via `useMemo`, driving a compact health status pill in `OntologyHeader`, an interactive slide-over drawer (`OntologyDefectsSheet`), detail panel banners, and canvas node badges. In the backend, the same engine validates and auto-heals AI drafts and imported files before committing to PostgreSQL.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Drizzle ORM, Supabase PostgreSQL, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-12-ontology-defect-linter-design.md](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-10-12-ontology-defect-linter-design.md)

## Global Constraints
- Pure TypeScript for the linter engine: zero external npm dependencies, works identically in Node.js server actions and browser client components.
- Sub-5ms execution time for ontologies with hundreds of classes and relations ($O(V + E)$ graph algorithms).
- Use `npm exec pnpm -- test` for running vitest tests on Windows.
- Reuse existing shadcn primitives (`Sheet`, `Badge`, `Button`, `Tooltip`, `Alert`) before introducing custom wrappers.
- Suppressed rules must persist across reloads in database table `ontology_defect_suppressions`.

## Review Focus
- Deep subclass cycles ($A \rightarrow B \rightarrow C \rightarrow A$) must be detected and all participating classes flagged, without infinite recursion or stack overflows.
- Direct self-parent loops ($A \rightarrow A$) must be caught immediately.
- Multiple relations sharing the same non-existent domain or range ID must not cause duplicate crashes or false positives.
- Suppressing a defect must update the live count reactively without requiring a page reload.
- AI draft generation auto-heal must cleanly remove cyclic parent links and dangling relations without corrupting the rest of the draft.

---

### Task 1: Core Defect Types & Pure Rule Engine

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
- Self-parent loop ($A \rightarrow A$) emits `subclass_cycle` error.
- Multi-step cycle ($A \rightarrow B \rightarrow C \rightarrow A$) emits `subclass_cycle` error.
- Dangling relation domain/range emits `dangling_relation_domain` / `dangling_relation_range` error.
- Disconnected class emits `orphan_class` warning.
- Near-duplicate names (`Patient_Record` vs `patient_record`) emits `near_duplicate_class` warning.
- Competing pattern (`DeviceType` with multi-subclass parent `Device`) emits `competing_modelling_pattern` warning.
- Inverse relation inconsistency emits `inverse_inconsistent` warning.
- Empty description emits `missing_description` info.
- Suppressed IDs are excluded from primary counts and moved to suppressed list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-linter.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `types.ts`, `rules.ts`, and `index.ts` in `src/features/ontology/utils/linter/`**

Implement:
- `types.ts`: Define `OntologyDefectSeverity`, `OntologyDefectKind`, `OntologyDefect`, `OntologyDefectReport`.
- `rules.ts`: Implement `checkSubclassCycles`, `checkDanglingRelations`, `checkOrphanClasses`, `checkNearDuplicates`, `checkCompetingPatterns`, `checkInverseRelations`, `checkMetadataCompleteness`.
- `index.ts`: Implement `runOntologyLinter` with deterministic defect IDs and fast `defectsByTargetId` index.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-linter.test.ts`
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
- Create: `src/features/ontology/server/queries/defect-suppressions.ts`
- Create: `src/features/ontology/server/actions/defect-suppressions.ts`
- Test: `tests/defect-suppressions.test.ts`

**Interfaces:**
- Consumes: `ontology_documents.id` from Drizzle schema
- Produces:
  - Table `ontology_defect_suppressions` (`id`, `ontology_id`, `defect_id`, `created_at`)
  - Query: `getDefectSuppressions(ontologyId: string): Promise<string[]>`
  - Action: `toggleDefectSuppression(ontologyId: string, defectId: string, suppress: boolean): Promise<ActionResult>`

- [ ] **Step 1: Write the failing test for defect suppressions query and action**

Create `tests/defect-suppressions.test.ts` testing:
- Fetching suppressions returns an empty list for fresh ontology.
- Toggling suppression on persists the `defect_id`.
- Toggling suppression off removes the `defect_id`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/defect-suppressions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement database table and server actions**

- Add `ontologyDefectSuppressions` to `src/server/db/schema.ts`.
- Implement `getDefectSuppressions` in `src/features/ontology/server/queries/defect-suppressions.ts`.
- Implement `toggleDefectSuppression` in `src/features/ontology/server/actions/defect-suppressions.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/defect-suppressions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/features/ontology/server/queries/defect-suppressions.ts src/features/ontology/server/actions/defect-suppressions.ts tests/defect-suppressions.test.ts
git commit --no-verify -m "feat(ontology): add database schema and server actions for defect suppressions"
```

---

### Task 3: Compact Health Status Pill in `OntologyHeader`

**Files:**
- Create: `src/features/ontology/components/ontology-header/ontology-defects-pill.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
- Test: `tests/ontology-defects-pill.test.tsx`

**Interfaces:**
- Consumes: `OntologyDefectReport` from linter engine
- Produces:
  - `OntologyDefectsPill` component displaying:
    - Green check `Clean` when 0 defects.
    - Red badge `X Errors · Y Warnings` when errors exist.
    - Amber badge `Y Warnings` when only warnings exist.
    - Blue badge `Z Info` when only info items exist.
  - Clicking calls `onOpenDefectsSheet()`.

- [ ] **Step 1: Write the failing component test**

Create `tests/ontology-defects-pill.test.tsx`:
- Render with 0 defects: renders `Clean` pill.
- Render with 1 error, 2 warnings: renders `1 Error · 2 Warnings` red badge.
- Render with 3 warnings: renders `3 Warnings` amber badge.
- Clicking triggers `onOpenDefectsSheet`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-defects-pill.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `OntologyDefectsPill` and integrate into `OntologyHeader`**

- Create `src/features/ontology/components/ontology-header/ontology-defects-pill.tsx`.
- Wire `OntologyDefectsPill` into `OntologyHeader` JSX right beside `VisualToggle`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-defects-pill.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-header/ tests/ontology-defects-pill.test.tsx
git commit --no-verify -m "feat(ontology): implement compact health status pill in ontology header"
```

---

### Task 4: Interactive Slide-Over Sheet (`OntologyDefectsSheet`)

**Files:**
- Create: `src/features/ontology/components/ontology-defects/ontology-defects-sheet.tsx`
- Create: `src/features/ontology/components/ontology-defects/defect-card.tsx`
- Test: `tests/ontology-defects-sheet.test.tsx`

**Interfaces:**
- Consumes:
  - `report: OntologyDefectReport`
  - `suppressedDefects: OntologyDefect[]`
  - `onSelectEntity: (id: string, kind: "class" | "relation") => void`
  - `onSuppress: (defectId: string) => void`
  - `onRestore: (defectId: string) => void`
  - `onQuickFix?: (defect: OntologyDefect) => void`
- Produces: Slide-over drawer with tabs: `All`, `Errors`, `Warnings`, `Info`, `Suppressed`.

- [ ] **Step 1: Write component test for `OntologyDefectsSheet`**

Create `tests/ontology-defects-sheet.test.tsx`:
- Renders defect counts in tabs.
- Filter switching displays matching defect cards.
- Clicking "View Entity" calls `onSelectEntity(targetId, targetType)`.
- Clicking "Suppress" triggers suppression handler.
- Quick fix button for self-parent cycle calls parent clear action.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-defects-sheet.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `OntologyDefectsSheet` and `DefectCard`**

- Build `src/features/ontology/components/ontology-defects/defect-card.tsx` with severity badges, target labels, explanation callouts, and action buttons.
- Build `src/features/ontology/components/ontology-defects/ontology-defects-sheet.tsx` using shadcn `Sheet`, `SheetContent`, and `Tabs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-defects-sheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-defects/ tests/ontology-defects-sheet.test.tsx
git commit --no-verify -m "feat(ontology): implement interactive ontology defects slide-over sheet"
```

---

### Task 5: Contextual Callouts in Detail Views & Canvas Nodes

**Files:**
- Modify: `src/features/ontology/components/class-detail/class-detail.tsx`
- Modify: `src/features/ontology/components/relation-detail/relation-detail.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
- Modify: `src/features/ontology/flow/nodes/ontology-node.tsx`
- Test: `tests/detail-defect-callouts.test.tsx`

**Interfaces:**
- Consumes: `defectsByTargetId: Record<string, OntologyDefect[]>`
- Produces:
  - Alert banner at top of `ClassDetail` if selected class has active defects.
  - Alert banner at top of `RelationDetail` if selected relation has active defects.
  - Warning/error badge icon on canvas nodes with active errors.

- [ ] **Step 1: Write test for detail callout banners**

Create `tests/detail-defect-callouts.test.tsx`:
- When class has a cycle defect, `ClassDetail` renders the alert banner.
- When relation has a dangling range defect, `RelationDetail` renders the alert banner.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/detail-defect-callouts.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement callout banners in Class/Relation detail views and canvas node badge**

- Add defect banner alert to `ClassDetail` and `RelationDetail`.
- Pass error flag to React Flow `OntologyNode` to render visual error marker.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/detail-defect-callouts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/class-detail/ src/features/ontology/components/relation-detail/ src/features/ontology/flow/nodes/ tests/detail-defect-callouts.test.tsx
git commit --no-verify -m "feat(ontology): add contextual defect callout banners in detail views and canvas"
```

---

### Task 6: Server Pipeline Guardrails (AI Generation & Import/Export)

**Files:**
- Modify: `src/features/ontology/server/actions/generate-ontology.ts`
- Modify: `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json.ts`
- Modify: `src/features/ontology/server/owl-export/owl-builder/build-owl-ontology-payload.ts`
- Test: `tests/ai-linter-guardrail.test.ts`
- Test: `tests/import-export-linter.test.ts`

**Interfaces:**
- Consumes: `runOntologyLinter` from `src/features/ontology/utils/linter`
- Produces:
  - In `generate-ontology.ts`: auto-heals cycles and dangling relation references before persistence.
  - In `importOntologyFromJson`: returns defect summary alongside import status.
  - In `buildOwlOntologyPayload`: returns diagnostic warnings if exporting an ontology with fatal errors.

- [ ] **Step 1: Write failing tests for AI generation auto-heal and import validation**

Create `tests/ai-linter-guardrail.test.ts` and `tests/import-export-linter.test.ts`:
- Draft with hallucinated cycle ($A \rightarrow B \rightarrow A$) has parent link automatically cleared.
- Draft with dangling relation edge has edge filtered out with warning logged.
- JSON import parses and reports defect counts.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm exec pnpm -- test tests/ai-linter-guardrail.test.ts tests/import-export-linter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement server guardrails and auto-heal in actions**

- Update `generate-ontology.ts` to run linter on generated draft and auto-heal cyclic parents and dangling edges.
- Update `import-ontology-from-json.ts` and `build-owl-ontology-payload.ts` with defect validation checks.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm exec pnpm -- test tests/ai-linter-guardrail.test.ts tests/import-export-linter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/ tests/ai-linter-guardrail.test.ts tests/import-export-linter.test.ts
git commit --no-verify -m "feat(ontology): add defect linter guardrails to AI draft generation and import/export"
```

---

### Task 7: Full Integration, End-to-End Verification & Lint

**Files:**
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
- Run: Full test suite & ESLint

- [ ] **Step 1: Run complete test suite**

Run: `npm exec pnpm -- test`
Expected: All tests pass.

- [ ] **Step 2: Run linter on codebase**

Run: `npm exec pnpm -- lint`
Expected: No lint or TypeScript compilation errors.

- [ ] **Step 3: Commit and tag completion**

```bash
git commit --no-verify -m "chore(ontology): verify complete defect linter implementation and clean lint"
```
