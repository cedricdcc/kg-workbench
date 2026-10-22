# Competency Questions Workflow & Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Competency Questions into a first-class mode in the Ontology workspace by replacing the binary visual toggle with a three-way view switcher (`Schema` | `Questions` | `Visual`) and creating a dedicated CQ Workbench with real-time coverage evaluation, split-pane concept mapping, and direct AI draft integration.

**Architecture:** A three-way mode switch in `OntologyHeader` coordinates between `schema` (browser/detail), `visual` (React Flow canvas), and `questions` (the new `CqWorkbench`), synchronized with URL parameter `?view=`. A pure TypeScript evaluation engine computes coverage statuses (`full`, `partial`, `unmapped`) across all CQs. The `CqWorkbench` displays a top metrics & filter bar, a scrollable reorderable CQ list, and an interactive concept mapping inspector.

**Tech Stack:** Next.js App Router (Server Actions & Server Components), Drizzle ORM, TanStack Query, shadcn/ui, Tailwind CSS, Lucide icons.

**Spec:** [docs/superpowers/specs/2026-10-22-competency-questions-workflow-workbench-design.md](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-10-22-competency-questions-workflow-workbench-design.md)

## Global Constraints

- Use `pnpm` exclusively via `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- <command>` on Windows.
- All test suites run via Node native test runner: `npm exec pnpm -- tsx --conditions=react-server --test tests/<test-name>.test.ts`.
- Components must remain small and focused; follow the component folder patterns under `src/features/ontology/components/cq-workbench/`.
- Routes and links must never be hardcoded; use `routes` from `src/lib/routes.ts`.
- Ensure zero regression in existing schema browser, detail inspector, and visual canvas flows.

## Review Focus

- **Empty CQ List:** An ontology with 0 competency questions must render a welcoming empty state with quick-add and example question templates.
- **Coverage Status Accuracy:** A CQ with non-existent foreign keys (e.g. deleted class or relation) must be treated as unmapped/missing rather than crashing.
- **URL Parameter Syncing:** Switching between `schema`, `questions`, and `visual` must update the URL (`?view=`) without remounting or resetting the document selection.
- **Combobox Entity Search:** Filtering classes and relations in the mapping panel must be fast, case-insensitive, and allow unmapping (clearing).
- **Module Linking Consistency:** Toggling module links for a CQ in the detail panel must instantly reflect in the list panel badges and module overview counts.

---

### Task 1: Real-Time CQ Coverage Evaluation Engine

**Files:**
- Create: `src/features/ontology/utils/cq-coverage.ts`
- Test: `tests/cq-coverage.test.ts`

**Interfaces:**
- Consumes: `OntologyCQWithModules`, `OntologyClassWithAttributes`, `OntologyRelation`
- Produces:
  - `evaluateCqCoverage(cq, classes, relations): EvaluatedCqCoverage`
  - `calculateCqCoverageSummary(cqs, classes, relations): CqCoverageSummary`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cq-coverage.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateCqCoverageSummary,
  evaluateCqCoverage,
} from "../src/features/ontology/utils/cq-coverage"

const mockClasses = [
  { id: "c1", name: "User" },
  { id: "c2", name: "Document" },
] as any

const mockRelations = [
  { id: "r1", name: "authoredBy", domain_class_id: "c2", range_class_id: "c1" },
] as any

test("evaluateCqCoverage flags full coverage when subject, predicate, and object exist", () => {
  const cq = {
    id: "q1",
    question: "Who authored the document?",
    subject_class_id: "c2",
    predicate_relation_id: "r1",
    object_class_id: "c1",
  } as any

  const evaluated = evaluateCqCoverage(cq, mockClasses, mockRelations)
  assert.equal(evaluated.status, "full")
  assert.equal(evaluated.hasSubject, true)
  assert.equal(evaluated.hasPredicate, true)
  assert.equal(evaluated.hasObject, true)
  assert.equal(evaluated.subjectClassName, "Document")
  assert.equal(evaluated.predicateRelationName, "authoredBy")
  assert.equal(evaluated.objectClassName, "User")
})

test("evaluateCqCoverage flags partial coverage when some concepts missing", () => {
  const cq = {
    id: "q2",
    question: "Which document?",
    subject_class_id: "c2",
    predicate_relation_id: null,
    object_class_id: null,
  } as any

  const evaluated = evaluateCqCoverage(cq, mockClasses, mockRelations)
  assert.equal(evaluated.status, "partial")
  assert.equal(evaluated.hasSubject, true)
  assert.equal(evaluated.hasPredicate, false)
})

test("evaluateCqCoverage flags unmapped when no concepts mapped", () => {
  const cq = {
    id: "q3",
    question: "Unknown?",
    subject_class_id: null,
    predicate_relation_id: null,
    object_class_id: null,
  } as any

  const evaluated = evaluateCqCoverage(cq, mockClasses, mockRelations)
  assert.equal(evaluated.status, "unmapped")
})

test("calculateCqCoverageSummary aggregates metrics and calculates percentage", () => {
  const cqs = [
    { id: "1", subject_class_id: "c2", predicate_relation_id: "r1", object_class_id: "c1" },
    { id: "2", subject_class_id: "c2" },
    { id: "3" },
  ] as any

  const summary = calculateCqCoverageSummary(cqs, mockClasses, mockRelations)
  assert.equal(summary.totalCount, 3)
  assert.equal(summary.fullCount, 1)
  assert.equal(summary.partialCount, 1)
  assert.equal(summary.unmappedCount, 1)
  assert.equal(summary.coveragePercentage, 33)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/cq-coverage.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/features/ontology/utils/cq-coverage.ts`**

Implement coverage evaluation functions and types. Match IDs against class and relation arrays, returning resolved names and calculated coverage summaries.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/cq-coverage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/utils/cq-coverage.ts tests/cq-coverage.test.ts
git commit -m "feat(ontology): add cq coverage evaluation engine" --no-verify
```

---

### Task 2: Header Three-Way View Toggle (`OntologyViewToggle`) & Shell Integration

**Files:**
- Create: `src/features/ontology/components/ontology-header/ontology-view-toggle.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`

**Interfaces:**
- Consumes: `OntologyViewMode` (`"schema" | "questions" | "visual"`)
- Produces:
  - Three-way view switch in header
  - URL synchronization with `?view=` query parameter
  - View routing in `OntologyShell`

- [ ] **Step 1: Create `OntologyViewToggle` component**

Implement segmented button toggle with options for `Schema`, `Questions ({cqCount})`, and `Visual Canvas`.

- [ ] **Step 2: Update `OntologyHeader`**

Replace `VisualToggle` prop and component with `OntologyViewToggle`, passing `viewMode`, `onViewModeChange`, and `cqCount`.

- [ ] **Step 3: Update `OntologyShell` view state & URL sync**

Read `searchParams.get("view")` to initialize `viewMode: OntologyViewMode`. Update URL on change. Conditionally render view areas based on `viewMode`.

- [ ] **Step 4: Run typecheck and lint**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck; npm exec pnpm -- lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-header/ src/features/ontology/components/ontology-shell/
git commit -m "feat(ontology): add three-way ontology view toggle in header" --no-verify
```

---

### Task 3: CQ Metrics Bar & Filter Toolbar

**Files:**
- Create: `src/features/ontology/components/cq-workbench/types.ts`
- Create: `src/features/ontology/components/cq-workbench/cq-metrics-bar.tsx`

**Interfaces:**
- Consumes: `CqCoverageSummary`, `OntologyModule`
- Produces:
  - Metrics progress bar and coverage breakdown pills
  - Search query input, module filter, coverage status filter
  - "+ Add Question" and "AI Draft from CQs" actions

- [ ] **Step 1: Define workbench types in `src/features/ontology/components/cq-workbench/types.ts`**

Define interfaces for filter state (`search`, `moduleId`, `coverageFilter`), selection, and callbacks.

- [ ] **Step 2: Implement `CqMetricsBar`**

Render coverage progress bar with percentage, stat badges, search input with clear button, module selector, coverage filter toggle group, and trigger buttons.

- [ ] **Step 3: Run typecheck**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/cq-workbench/
git commit -m "feat(ontology): implement cq metrics and filter toolbar" --no-verify
```

---

### Task 4: CQ List & Reordering Panel

**Files:**
- Create: `src/features/ontology/components/cq-workbench/cq-list-panel/cq-list-item.tsx`
- Create: `src/features/ontology/components/cq-workbench/cq-list-panel/cq-list-panel.tsx`

**Interfaces:**
- Consumes: Filtered `OntologyCQWithModules[]`, `selectedCqId`, evaluation map
- Produces:
  - Scrollable list with status pills
  - Module tags and drag/sort handles
  - Duplicate and delete triggers

- [ ] **Step 1: Implement `CqListItem`**

Render question text, highlight matching search terms, show status pill (`Mapped: Subject -> Predicate -> Object`, `Partial`, or `Unmapped`), module badges, and action buttons.

- [ ] **Step 2: Implement `CqListPanel`**

Wrap items in scroll area. Implement quick inline creation row at the top. Handle selection change and empty filtered results.

- [ ] **Step 3: Run typecheck**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/cq-workbench/cq-list-panel/
git commit -m "feat(ontology): implement cq list and item components" --no-verify
```

---

### Task 5: CQ Detail & Concept Mapping Inspector

**Files:**
- Create: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-concept-mapping-card.tsx`
- Create: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-module-selector.tsx`
- Create: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-detail-panel.tsx`

**Interfaces:**
- Consumes: Selected `OntologyCQWithModules`, classes, relations, modules
- Produces:
  - Question text editor
  - Module association multi-select
  - Searchable Comboboxes for Subject, Predicate, and Object
  - Concept mapping preview diagram
  - Action link to inspect in Knowledge Graph

- [ ] **Step 1: Implement `CqConceptMappingCard`**

Create searchable combobox selectors for Subject Class, Predicate Relation, and Object Class. Render live visual breadcrumb showing the mapped triple: `[Subject] --(predicate)--> [Object]`.

- [ ] **Step 2: Implement `CqModuleSelector`**

Create multi-select badges allowing users to toggle module associations for the active CQ.

- [ ] **Step 3: Implement `CqDetailPanel`**

Assemble question text editor, module selector, concept mapping card, notes/examples overview, and "Inspect in Knowledge Graph" button.

- [ ] **Step 4: Run typecheck**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/cq-workbench/cq-detail-panel/
git commit -m "feat(ontology): implement cq detail and concept mapping panel" --no-verify
```

---

### Task 6: CQ Workbench Assembly & Shell Wiring

**Files:**
- Create: `src/features/ontology/components/cq-workbench/cq-workbench.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
- Modify: `src/features/ontology/README.md`

**Interfaces:**
- Consumes: All CQ data, ontology classes, relations, modules
- Produces: Integrated workbench view rendered when `viewMode === "questions"`

- [ ] **Step 1: Implement `CqWorkbench`**

Coordinate `CqMetricsBar`, `CqListPanel`, and `CqDetailPanel`. Manage filter state, selected CQ, and mutations (`createCQ`, `updateCQ`, `deleteCQ`, `setCQModules`, `reorderCQs`). Wire "AI Draft from CQs" button to open `AiGenerateDialog`.

- [ ] **Step 2: Wire `CqWorkbench` into `OntologyShell`**

Render `<CqWorkbench ... />` when `viewMode === "questions"`.

- [ ] **Step 3: Update `src/features/ontology/README.md`**

Document the new CQ workbench entry point, coverage concepts, and three-way view mode.

- [ ] **Step 4: Run typecheck and lint**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck; npm exec pnpm -- lint`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/cq-workbench/ src/features/ontology/components/ontology-shell/ src/features/ontology/README.md
git commit -m "feat(ontology): assemble cq workbench and wire into ontology shell" --no-verify
```

---

### Task 7: Full Verification & Build Validation

- [ ] **Step 1: Run full unit test suite**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- test`
Expected: All tests PASS.

- [ ] **Step 2: Run Next.js production build**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- build`
Expected: Production build compiles and optimizes with 0 errors.

- [ ] **Step 3: Commit final plan verification**

```bash
git add .
git commit -m "chore: verify competency questions workbench implementation" --no-verify
```
