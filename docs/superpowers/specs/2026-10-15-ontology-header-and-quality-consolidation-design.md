# Header & Quality Consolidation Design Specification

- **Feature**: Ontology Quality & Header Ribbon Consolidation (Phase 1)
- **Status**: Draft / Under Review
- **Date**: 2026-10-15
- **Branch**: `feat/ontology-header-quality-consolidation`
- **Target Files**:
  - `src/features/ontology/components/ontology-header/`
  - `src/features/ontology/components/ontology-quality/` (or `src/features/ontology/components/ontology-issues/`)
  - `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
  - Retire: `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/`

---

## 1. Executive Summary

As the ontology workbench evolved, multiple diagnostic, analysis, and management tools were added as standalone header icon buttons and separate modal dialogs. This created severe UI clutter ("header button salad"), conceptual overlap (duplicate health scores vs. defect reports), and spatial disorientation (dialogs popping over dialogs).

This project implements **Phase 1 of the UI Streamlining Initiative**:
1. **Header Ribbon Consolidation**: Collapses 8 disparate header controls into 4 clear landmarks (`DocumentSelector`, expanded `Actions ▾` dropdown, `OntologyIssuesPill`, and `VisualToggle`).
2. **Issue-Typed Info Pill**: Replaces arbitrary "Health %" scores with concrete, typed issue indicators (`🔴 1 Error · 2 Warnings`, `🟡 3 Warnings`, `🔵 2 Suggestions`, or `🟢 Clean`).
3. **Unified Quality & Issues Inspector (`OntologyIssuesSheet`)**: Replaces both the 567-line `OntologyAnalysisReportDialog` modal and the `OntologyDefectsSheet` with a single slide-over drawer that keeps the visual canvas visible while inspecting and fixing issues.

---

## 2. Friction Points & Architecture Diagnosis

### 2.1 The Duplicate Quality Tools
Currently, the user has two conflicting tools that attempt to diagnose ontology health:
- **`OntologyAnalysisReportDialog`** (accessed via header `Activity` icon): A 567-line modal computing an arbitrary "Health Score %", semantic redundancy clusters, an alignment matrix, and vocabulary recommendations.
- **`OntologyDefectsSheet`** (accessed via header status pill): A slide-over drawer computing real-time in-memory OOPS! structural defects (subclass cycles, dangling edges, orphan nodes, near duplicates, inverse inconsistencies, missing metadata).

**Resolution**: Fully retire `OntologyAnalysisReportDialog`. Merge its useful semantic clustering and vocabulary recommendation tabs into the responsive slide-over drawer alongside real-time structural defects.

### 2.2 Header Button Salad
The 48px header strip currently crams:
1. Logo / title
2. `DocumentSelector`
3. `CreateImportActions` split-button
4. Standalone `Settings2` button (`OntologyDetailsDialog`)
5. Standalone `BookMarked` button (`ReferenceVocabulariesDialog`)
6. Standalone `Activity` button (`OntologyAnalysisReportDialog`)
7. `OntologyDefectsPill`
8. `VisualToggle`

**Resolution**: Move `Settings2` (Ontology Details & CQs) and `BookMarked` (Reference Vocabularies) into an organized `Actions ▾` dropdown menu. Remove the `Activity` button entirely.

---

## 3. Header Ribbon Specification

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Ontology  [ Select Document ▾ ]  [ + New | ▾ ]       ···       [ 🔴 1 Error · 2 Warnings ]   [ ▤ | ☩ ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Landmarks
1. **Document Brand & Selector**:
   - `DocumentSelector`: Selects active ontology document; disabled when none loaded.
2. **`[ + New | ▾ ]` Split Actions Menu**:
   - Primary button: `+ New` (opens `CreateOntologyDialog`).
   - Dropdown menu (`DropdownMenuContent`):
     - **Document Group**:
       - `Import from JSON...` (`Import` icon)
       - `Export as JSON...` (`Download` icon)
       - `Export as OWL...` (`Download` icon, includes diagnostics notes)
     - **Separator**
     - **Ontology Tools & Metadata Group**:
       - `Ontology Details & CQs` (`Settings2` icon, opens `OntologyDetailsDialog`)
       - `Reference Vocabularies (OLS4 & LOV)` (`BookMarked` icon, opens `ReferenceVocabulariesDialog`)
       - `JSON Schema Reference` (`FileJson` icon, opens `ImportFormatDialog`)
     - **Separator**
     - **Danger Zone**:
       - `Delete Ontology...` (`Trash2` icon, red text, opens `DeleteConfirmationDialog`)
3. **Unified Issue Info Pill (`OntologyIssuesPill`)**:
   - Replaces both `OntologyDefectsPill` and the `Activity` button.
   - Computes state directly from active issues:
     - **Critical Errors present**: `🔴 {errorCount} Error(s) · {warningCount} Warning(s)`
     - **Warnings only**: `🟡 {warningCount} Warning(s)`
     - **Semantic Redundancies/Suggestions only**: `🔵 {suggestionCount} Suggestions`
     - **Zero Issues**: `🟢 Clean`
   - Clicking opens the `OntologyIssuesSheet`.
4. **Visual Toggle (`VisualToggle`)**:
   - Toggles between List Browser mode and React Flow Canvas mode.

---

## 4. Unified Quality & Issues Inspector (`OntologyIssuesSheet`)

The inspector is implemented as a slide-over `Sheet` (right-side drawer, width 520px–640px) rather than a centered modal dialog. This keeps the canvas/browser visible in the background, allowing instant visual feedback when selecting entities or applying quick fixes.

### 4.1 Sheet Header Summary
The top of the drawer displays concrete counts instead of an arbitrary percentage:
```
┌────────────────────────────────────────────────────────────────────────┐
│  Ontology Quality Inspector                                         ✕  │
│  Active issues:  [ 1 Error ]   [ 2 Warnings ]   [ 2 Redundancies ]     │
├────────────────────────────────────────────────────────────────────────┤
│  [ Structural Defects (3) ]  [ Redundancies (2) ]  [ Standards (1) ]   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tab Structure

#### Tab 1: Structural Defects (`StructuralDefectsTab`)
- **Engine**: Real-time in-memory OOPS! linter (`runOntologyLinter`).
- **Sub-filters**: `All`, `Errors`, `Warnings`, `Info`, `Suppressed`.
- **Items**: Renders `DefectCard` with severity badge, target name, explanation, and action buttons:
  - `Quick Fix`: Instant 1-click mutation (e.g. sever cycle parent link, delete dangling edge).
  - `View Entity`: Selects entity on canvas or in left browser and centers viewport.
  - `Mute / Suppress`: Persists suppression to `ontologyDefectSuppressions`.

#### Tab 2: Redundancy Clusters (`RedundanciesTab`)
- **Engine**: Async semantic clustering from `runFullOntologyAnalysis` (`useQuery`).
- **Items**: Displays clusters of classes that share near-identical semantic vectors or overlapping token names.
- **Actions**:
  - `Inspect Entities`: Highlights the cluster entities.
  - `Merge / Refactor`: Deep-links into the class refactor flow.

#### Tab 3: Standard Alignments & Vocabularies (`StandardsTab`)
- **Engine**: Term recommendations and vocabulary matching from `runFullOntologyAnalysis`.
- **Items**:
  - High-confidence term matches against cached reference vocabularies.
  - Recommended external ontologies (e.g. SOSA, Schema.org, ENVO) with **1-click direct import & index**.
- **Actions**:
  - `Import Vocabulary`: Invokes `addReferenceOntology` action and invalidates `["reference-ontologies"]`.
  - `Manage All Vocabularies`: Opens `ReferenceVocabulariesDialog`.

---

## 5. Data Flow & Performance Architecture

```
                  ┌─────────────────────────────────────┐
                  │           OntologyShell             │
                  └───────┬─────────────────────┬───────┘
                          │                     │
           In-Memory live │                     │ On-demand query
          (sub-5ms useMemo)                     │ (staleTime: 5 min)
                          ▼                     ▼
              ┌─────────────────────┐   ┌───────────────────────────┐
              │   runOntologyLinter │   │  runFullOntologyAnalysis  │
              └───────────┬─────────┘   └─────────────┬─────────────┘
                          │                           │
                          │   defectsReport           │   analysisData
                          ▼                           ▼
            ┌──────────────────────────────────────────────┐
            │          OntologyIssuesSheet (Drawer)         │
            │  - Tab 1: Structural Defects & Quick-Fixes   │
            │  - Tab 2: Redundancy Clusters                │
            │  - Tab 3: Standard Vocabularies & Alignment  │
            └──────────────────────────────────────────────┘
```

1. **Instant Feedback**: Structural defects compute purely in-memory on every class/relation mutation. The info pill and Tab 1 update instantly without network lag.
2. **Lazy Semantic Fetching**: The heavier semantic analysis query runs in the background with `enabled: open` (or cached when opened), showing skeleton loaders in Tabs 2 and 3 so the drawer opens with zero delay.
3. **Mutation Invalidation**:
   - `onQuickFix`: triggers class/relation mutation $\rightarrow$ invalidates `["ontology-document"]` and updates linter.
   - `onSuppress`: calls `toggleDefectSuppression` $\rightarrow$ invalidates `["ontology-defect-suppressions"]`.
   - `onDirectImportVocab`: calls `addReferenceOntology` $\rightarrow$ invalidates `["reference-ontologies"]`, `["reference-terms"]`, and `["ontology-analysis"]`.

---

## 6. Retirement & Cleanup Plan

### Files to Retire / Delete:
- `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/ontology-analysis-report-dialog.tsx`
- `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/redundancy-clusters-tab.tsx`
- `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/class-alignment-matrix-tab.tsx`
- `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/recommended-vocabularies-tab.tsx`
- `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/refactor-example-preview-dialog.tsx`

### Files to Create / Refactor:
- Refactor `src/features/ontology/components/ontology-header/create-import-actions.tsx` $\rightarrow$ expanded `OntologyActionsMenu`.
- Refactor `src/features/ontology/components/ontology-header/ontology-defects-pill.tsx` $\rightarrow$ `OntologyIssuesPill` (concrete issue types).
- Refactor `src/features/ontology/components/ontology-header/ontology-header.tsx` $\rightarrow$ streamlined 4-control layout.
- Consolidate `src/features/ontology/components/ontology-defects/ontology-defects-sheet.tsx` $\rightarrow$ `OntologyIssuesSheet` (hosting the 3 unified tabs).
- Refactor `src/features/ontology/components/ontology-shell/ontology-shell.tsx` $\rightarrow$ wire unified drawer state.

---

## 7. Testing & Verification

1. **Unit Tests**:
   - Test `OntologyIssuesPill`:
     - Displays error and warning counts when errors exist (`🔴 1 Error · 2 Warnings`).
     - Displays warnings when only warnings exist (`🟡 2 Warnings`).
     - Displays suggestions when only suggestions exist (`🔵 3 Suggestions`).
     - Displays `🟢 Clean` when zero issues are present.
2. **Integration Tests**:
   - Test `OntologyIssuesSheet`:
     - Switching between Structural Defects, Redundancies, and Standards tabs.
     - Applying a Quick Fix from the drawer and confirming reactive update.
     - Entity selection callback triggers navigation in shell.
3. **Full Regression Check**:
   - All 79 existing tests must pass (`npm exec pnpm -- test`).
   - Typecheck must be clean (`npm exec pnpm -- typecheck`).
   - Lint must have 0 errors and 0 warnings (`npm exec pnpm -- lint`).

---

## 8. Implementation Steps Breakdown

- **Step 1**: Expand `create-import-actions.tsx` into an all-in-one Actions Dropdown menu hosting Details, Vocabularies, Import/Export, and Delete.
- **Step 2**: Upgrade `ontology-defects-pill.tsx` to `ontology-issues-pill.tsx` with typed issue badges (`Error`, `Warning`, `Suggestion`, `Clean`).
- **Step 3**: Reorganize `ontology-header.tsx` to eliminate standalone `Activity`, `Settings2`, and `BookMarked` buttons.
- **Step 4**: Build `OntologyIssuesSheet` by migrating redundancy clusters and vocabulary recommendations into dedicated drawer tabs alongside structural defects.
- **Step 5**: Wire `OntologyIssuesSheet` in `ontology-shell.tsx` and delete the obsolete `ontology-analysis-report-dialog` directory.
- **Step 6**: Run tests, typecheck, lint, and verify clean hot-reload in Turbopack.
