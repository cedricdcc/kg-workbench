# Competency Questions-Centric Workflow & Workbench Design

- **Date:** 2026-10-22
- **Status:** Approved
- **Scope:** Architectural Subsystem (Sub-project 2 of Workflow & Configuration Initiative)

---

## 1. Overview & Problem Statement

Competency Questions (CQs) represent the functional requirements of an ontology—defining the exact domain queries the knowledge graph must be capable of answering.

Currently in KG Workbench, CQs are tucked into a secondary tab inside the `OntologyDetailsDialog` or module detail summaries. As a result:
1. Users lack a dedicated, prominent surface to formulate, inspect, and organize their CQs as the initial stage of ontology engineering.
2. There is no high-level visibility into schema coverage (e.g. which CQs are fully mapped to classes and relations vs. which ones are unmapped).
3. Moving between CQs, schema editing, and visual diagramming requires opening and closing modal dialogs instead of fluidly switching views.

This specification elevates Competency Questions into a first-class mode within the primary Ontology workspace, introducing a dedicated CQ Workbench with real-time coverage evaluation, split-pane concept mapping, and direct integration with AI draft generation and KG extraction.

---

## 2. Information Architecture & View Modes

### 2.1 Three-Way Workspace View Modes
In `src/features/ontology/components/ontology-shell/ontology-shell.tsx`:
```typescript
export type OntologyViewMode = "schema" | "questions" | "visual"
```
- **`schema`**: Two-pane browser (Classes, Relations, Reference Standards) and Detail Inspector.
- **`questions`**: Full-workspace Competency Questions Workbench.
- **`visual`**: React Flow canvas and collapsible Detail Inspector.

### 2.2 Navigation Landmark (`OntologyViewToggle`)
- Located in `src/features/ontology/components/ontology-header/ontology-view-toggle.tsx`.
- Replaces the binary switch `VisualToggle` with a compact segmented toggle:
  - **Schema** (Browser/Detail)
  - **Questions** (CQ Workbench with dynamic count badge, e.g. `(12)`)
  - **Visual** (React Flow Canvas)
- **URL Synchronization:**
  - View mode synchronizes with the `?view=` query parameter (`?view=questions`, `?view=schema`, `?view=visual`).
  - Switching views uses `router.replace` with `scroll: false` to avoid page remounts.
  - An ontology with 0 classes defaults to `questions` mode to guide users through CQ formulation first.

---

## 3. Real-Time Coverage Evaluation Engine

Located in `src/features/ontology/utils/cq-coverage.ts`:

### 3.1 Status Model
For each Competency Question:
- **`full` (Covered)**: Has a valid `subject_class_id`, `predicate_relation_id`, and `object_class_id` mapped to existing classes and relations in the ontology.
- **`partial`**: Has at least one concept mapped, but incomplete.
- **`unmapped`**: Has zero concept bindings.

```typescript
export type CqCoverageStatus = "full" | "partial" | "unmapped"

export interface EvaluatedCqCoverage {
  status: CqCoverageStatus
  hasSubject: boolean
  hasPredicate: boolean
  hasObject: boolean
  subjectClassName?: string
  predicateRelationName?: string
  objectClassName?: string
}

export interface CqCoverageSummary {
  totalCount: number
  fullCount: number
  partialCount: number
  unmappedCount: number
  coveragePercentage: number
}
```

### 3.2 Evaluation Function
- `evaluateCqCoverage(cq: OntologyCQWithModules, classes: OntologyClassWithAttributes[], relations: OntologyRelation[]): EvaluatedCqCoverage`
- `calculateCqCoverageSummary(cqs: OntologyCQWithModules[], classes: OntologyClassWithAttributes[], relations: OntologyRelation[]): CqCoverageSummary`

---

## 4. CQ Workbench UI Architecture

Located in `src/features/ontology/components/cq-workbench/`:

```text
src/features/ontology/components/cq-workbench/
  cq-workbench.tsx
  cq-metrics-bar.tsx
  cq-list-panel/
    cq-list-panel.tsx
    cq-list-item.tsx
  cq-detail-panel/
    cq-detail-panel.tsx
    cq-concept-mapping-card.tsx
    cq-module-selector.tsx
  types.ts
```

### 4.1 `CqMetricsBar`
- **Coverage Progress Bar**: Clean percentage indicator with color-coded count badges:
  - `X Covered` (Emerald)
  - `Y Partial` (Amber)
  - `Z Unmapped` (Slate)
- **Search & Filters**:
  - Live text search across question strings.
  - Module filter dropdown (e.g. "All Modules" or specific module).
  - Coverage filter tabs: `All`, `Unmapped / Incomplete`, `Fully Covered`.
- **Primary Actions**:
  - `+ Add Question`: Opens inline drafting row or adds quick CQ.
  - `AI Draft from CQs`: Directly launches the `AiGenerateDialog` using credentials from `/settings` to draft modules, classes, and relations satisfying all unmapped CQs.

### 4.2 `CqListPanel` (Left/Center Pane, ~55% width)
- Scrollable list of CQs matching active filters.
- Reordering support via drag handles or move buttons.
- Item Card displays:
  - Question text with highlighted search keywords.
  - Coverage Pill:
    - Green: `Mapped (Subject → Predicate → Object)`
    - Amber: `Partial (Missing concept)`
    - Slate: `Unmapped`
  - Module association badges.
  - Inline actions: duplicate question, delete confirmation.
  - Selected state syncing with `selectedCqId`.

### 4.3 `CqDetailPanel` (Right Pane, ~45% width)
- **Question Formulation Card**: Textarea for refining the CQ phrasing.
- **Module Association**: Multi-select pill selector linking the CQ to one or more ontology modules.
- **Concept Mapping Card**:
  - **Subject Class**: Searchable combobox of existing ontology classes.
  - **Predicate Relation**: Searchable combobox of ontology relations.
  - **Object Class**: Searchable combobox of existing ontology classes.
  - If a required concept does not exist, a quick-action button allows creating the missing class or relation in-place without leaving the workbench.
- **Domain Notes & Examples**:
  - Pinned example values/triples attached to the CQ.
  - Domain notes explaining query context.
- **Fact Inspector Bridge**:
  - Button: `"Inspect in Knowledge Graph"`. Navigates to `/knowledge-graph` or documents view filtered to facts matching this CQ.

---

## 5. Server Logic & Persistence

Reuses and enhances existing Server Actions in `src/features/ontology/server/actions/competency-questions.ts`:
- `createCQ(ontologyId, data)`
- `updateCQ(id, data)`
- `deleteCQ(id)`
- `reorderCQs(ontologyId, cqIds)`
- `setCQModules(cqId, moduleIds)`

Server queries in `src/features/ontology/server/queries/competency-questions.ts`:
- `getOntologyCQs(ontologyId)` returns all CQs with joined modules, subject classes, predicate relations, and object classes.

---

## 6. Integration & Verification Plan

1. **Unit Tests (`tests/cq-coverage.test.ts`)**:
   - Verify `evaluateCqCoverage` correctly flags full, partial, and unmapped CQs.
   - Verify `calculateCqCoverageSummary` computes accurate percentages and counts.
2. **Component Integration**:
   - Verify three-way toggle in `OntologyHeader` cleanly switches between `schema`, `questions`, and `visual`.
   - Verify URL query parameter synchronization (`?view=questions`).
   - Verify adding, editing, and mapping CQs updates the coverage metrics instantly.
   - Verify "AI Draft from CQs" button opens generation modal using configured Settings keys.
3. **Build & Lint Verification**:
   - Execute `pnpm check` (tests, typecheck, lint, and build) to ensure zero regressions across the codebase.
