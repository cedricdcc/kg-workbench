# Header & Quality Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the ontology workbench header ribbon into 4 clear landmarks, replace arbitrary health percentage scores with concrete typed issue indicators, and merge redundant quality modal dialogs into a single responsive slide-over drawer (`OntologyIssuesSheet`).

**Architecture:** A pure TypeScript calculation helper (`issues-summary.ts`) formats concrete issue counts (`Error`, `Warning`, `Suggestion`, `Clean`) for `OntologyIssuesPill`. `OntologyHeader` collapses 8 disparate controls down to 4 landmarks (`DocumentSelector`, expanded `OntologyActionsMenu`, `OntologyIssuesPill`, and `VisualToggle`), moving details and vocabulary triggers into the actions menu and retiring the standalone `Activity` button. `OntologyShell` mounts `OntologyIssuesSheet` (width 540px–640px) which unifies real-time in-memory OOPS! structural defects, semantic redundancy clusters, and standard vocabulary recommendations with 1-click import, retiring the 567-line `OntologyAnalysisReportDialog` modal and the `ontology-defects-sheet.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui (Sheet, DropdownMenu, Button, Badge, Tabs, Tooltip), TanStack Query, Lucide icons, Node.js native test runner (`node:test` via `tsx`).

**Spec:** [docs/superpowers/specs/2026-10-15-ontology-header-and-quality-consolidation-design.md](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-10-15-ontology-header-and-quality-consolidation-design.md)

## Global Constraints

- Never display arbitrary health percentages (`85% Health`); strictly display typed counts: `🔴 {errorCount} Error · {warningCount} Warnings`, `🟡 {warningCount} Warnings`, `🔵 {suggestionCount} Suggestions`, or `🟢 Clean`.
- Keep the visual canvas / entity browser visible while inspecting issues by using a slide-over `Sheet` (drawer) instead of a centered blocking modal `Dialog`.
- Run tests via `npm exec pnpm -- test` (uses Node's native test runner via `tsx` on `tests/*.test.ts`).
- Reuse existing shadcn primitives (`Sheet`, `DropdownMenu`, `Tabs`, `Button`, `Badge`, `Tooltip`) before introducing custom wrappers.
- All routes must be referenced from `src/lib/routes.ts` (never hardcoded).
- Maintain 100% pass rate across the existing 79 unit tests without regressions.
- Keep components focused and extract subcomponents under `src/features/ontology/components/<component-name>/<component-name>.tsx` with colocated parts.

## Review Focus

- When an ontology has 0 classes and 0 relations (clean empty state), the pill must display `🟢 Clean` and the drawer must show an empty state without throwing division-by-zero or undefined errors.
- If the async semantic analysis query fails or times out, the drawer must not crash; Tab 1 (structural defects) continues working smoothly in-memory while Tabs 2 and 3 display error/retry banners.
- When multiple quick-fixes are applied in rapid succession, queries must invalidate reactively without race conditions or stale linter states.
- When 1-click importing a reference vocabulary from the Standards tab, duplicate prefix additions must be caught gracefully and display a toast without leaving the button in an infinite loading state.
- When no document is loaded (`currentDocument === null`), actions requiring a document (Export, Delete, Details) must be disabled and the issues pill disabled or hidden.

---

### Task 1: Issue Pill Model & Calculation Helper (TDD)

**Files:**

- Create: `src/features/ontology/utils/issues-summary.ts`
- Test: `tests/ontology-issues-summary.test.ts`

**Interfaces:**

- Consumes: None (pure domain logic)
- Produces:

  ```ts
  export interface IssuesCounts {
    error: number
    warning: number
    suggestion?: number
    info?: number
  }

  export interface IssuesSummary {
    variant: "error" | "warning" | "suggestion" | "info" | "clean"
    label: string
    tooltip: string
    hasIssues: boolean
    hasErrors: boolean
    hasWarnings: boolean
    hasSuggestions: boolean
  }

  export function getOntologyIssuesSummary(counts: IssuesCounts): IssuesSummary
  ```

- [ ] **Step 1: Write the failing unit tests for `getOntologyIssuesSummary`**

Create `tests/ontology-issues-summary.test.ts` testing:

1. Returns `variant: "error"` with label `1 Error · 2 Warnings` when `error: 1, warning: 2`.
2. Returns `variant: "error"` with label `2 Errors` when `error: 2, warning: 0`.
3. Returns `variant: "warning"` with label `1 Warning` when `error: 0, warning: 1`.
4. Returns `variant: "warning"` with label `3 Warnings` when `error: 0, warning: 3`.
5. Returns `variant: "suggestion"` with label `2 Suggestions` when `error: 0, warning: 0, suggestion: 2`.
6. Returns `variant: "info"` with label `1 Info` when only `info: 1` is present.
7. Returns `variant: "clean"` with label `Clean` when all counts are 0.
8. Safely handles missing optional fields (`suggestion: undefined, info: undefined`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-issues-summary.test.ts`
Expected: FAIL with module not found or export undefined.

- [ ] **Step 3: Implement `src/features/ontology/utils/issues-summary.ts`**

Implement `getOntologyIssuesSummary` following the exact priority order:

- `error > 0` $\rightarrow$ `"error"`
- `warning > 0` $\rightarrow$ `"warning"`
- `(suggestion ?? 0) > 0` $\rightarrow$ `"suggestion"`
- `(info ?? 0) > 0` $\rightarrow$ `"info"`
- default $\rightarrow$ `"clean"`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-issues-summary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/utils/issues-summary.ts tests/ontology-issues-summary.test.ts
git commit -m "feat(ontology): add getOntologyIssuesSummary calculation helper with unit tests"
```

---

### Task 2: Expanded Header Actions Menu (`OntologyActionsMenu`)

**Files:**

- Create: `src/features/ontology/components/ontology-header/ontology-actions-menu.tsx`
- Modify: `src/features/ontology/components/ontology-header/create-import-actions.tsx`
- Test: `tests/ontology-actions-menu-structure.test.ts`

**Interfaces:**

- Consumes: `@/components/ui/button`, `@/components/ui/dropdown-menu`, `lucide-react` icons
- Produces: `OntologyActionsMenu` component with props:

  ```ts
  export interface OntologyActionsMenuProps {
    fileInputRef: React.RefObject<HTMLInputElement | null>
    isBusy: boolean
    hasCurrentDocument: boolean
    onCreate: () => void
    onImport: () => void
    onOpenImportFormat: () => void
    onExportJson: () => void
    onExportOwl: () => void
    onOpenOntologyDetails: () => void
    onOpenVocabularies: () => void
    onDelete: () => void
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  }
  ```

- [ ] **Step 1: Write test verifying actions menu contract**

Create `tests/ontology-actions-menu-structure.test.ts` asserting that `OntologyActionsMenu` and `CreateImportActions` are properly exported and compatible with expected handler props.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-actions-menu-structure.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/features/ontology/components/ontology-header/ontology-actions-menu.tsx` and re-export in `create-import-actions.tsx`**

Implement `OntologyActionsMenu`:

- Split button: `+ New` button + dropdown trigger chevron.
- Hidden file input for JSON import.
- Dropdown menu groups separated by `DropdownMenuSeparator`:
  - **Document Actions**:
    - `Import from JSON...` (`Import` icon)
    - `Export as JSON...` (`Download` icon, disabled if `!hasCurrentDocument`)
    - `Export as OWL...` (`Download` icon, disabled if `!hasCurrentDocument`)
  - **Ontology Tools & Metadata**:
    - `Ontology Details & CQs` (`Settings2` icon, disabled if `!hasCurrentDocument`)
    - `Reference Vocabularies (OLS4 & LOV)` (`BookMarked` icon)
    - `JSON Schema Reference` (`FileJson` icon)
  - **Danger Zone**:
    - `Delete Ontology...` (`Trash2` icon, `text-destructive`, disabled if `!hasCurrentDocument`)
- Update `create-import-actions.tsx` to re-export `OntologyActionsMenu` as `CreateImportActions` for backwards compatibility during migration.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-actions-menu-structure.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-header/ontology-actions-menu.tsx src/features/ontology/components/ontology-header/create-import-actions.tsx tests/ontology-actions-menu-structure.test.ts
git commit -m "feat(ontology): add expanded OntologyActionsMenu with tools and metadata"
```

---

### Task 3: Upgrade Header Issue Pill & Header Ribbon (`OntologyHeader`)

**Files:**

- Create: `src/features/ontology/components/ontology-header/ontology-issues-pill.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Modify: `src/features/ontology/components/ontology-header.tsx`
- Test: `tests/ontology-header-contract.test.ts`

**Interfaces:**

- Consumes: `getOntologyIssuesSummary` from `@/features/ontology/utils/issues-summary`, `OntologyActionsMenu`
- Produces:
  - `OntologyIssuesPill` component with props:
    ```ts
    export interface OntologyIssuesPillProps {
      counts: IssuesCounts
      onClick?: () => void
      disabled?: boolean
    }
    ```
  - `OntologyHeaderProps` updated to accept `issuesCounts?: IssuesCounts`, `onOpenIssuesSheet?: () => void`, `onOpenVocabularies?: () => void`.

- [ ] **Step 1: Write test for header and pill contract**

Create `tests/ontology-header-contract.test.ts` asserting that `OntologyIssuesPill` renders the correct variant classes and badges based on `IssuesCounts`, and that `OntologyHeaderProps` includes `issuesCounts` and `onOpenIssuesSheet`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-header-contract.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `ontology-issues-pill.tsx` and streamline `ontology-header.tsx`**

1. Create `ontology-issues-pill.tsx`:
   - Renders a compact shadcn button styled according to variant:
     - `error`: destructive styling with `AlertCircle` icon
     - `warning`: amber styling with `AlertTriangle` icon
     - `suggestion`: sky/blue styling with `Sparkles` icon
     - `info`: sky styling with `Info` icon
     - `clean`: emerald styling with `CheckCircle2` icon
   - Tooltip displaying the computed description.
2. In `ontology-header.tsx`:
   - Replace `CreateImportActions` with `OntologyActionsMenu`.
   - Wire `onOpenOntologyDetails` and `onOpenVocabularies` into `OntologyActionsMenu`.
   - Remove standalone `Settings2`, `BookMarked`, and `Activity` buttons.
   - Remove `OntologyAnalysisReportDialog` from `ontology-header.tsx`.
   - Render `OntologyIssuesPill` with `issuesCounts` (falling back to `defectsReport.counts` if not provided).
   - Re-export `OntologyIssuesPill` in `src/features/ontology/components/ontology-header.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-header-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-header/ontology-issues-pill.tsx src/features/ontology/components/ontology-header/ontology-header.tsx src/features/ontology/components/ontology-header.tsx tests/ontology-header-contract.test.ts
git commit -m "feat(ontology): streamline ontology header ribbon to 4 landmarks and add OntologyIssuesPill"
```

---

### Task 4: Build Consolidated `OntologyIssuesSheet` Drawer & Tabs

**Files:**

- Create: `src/features/ontology/components/ontology-issues/types.ts`
- Create: `src/features/ontology/components/ontology-issues/defect-card.tsx`
- Create: `src/features/ontology/components/ontology-issues/structural-defects-tab.tsx`
- Create: `src/features/ontology/components/ontology-issues/redundancies-tab.tsx`
- Create: `src/features/ontology/components/ontology-issues/standards-tab.tsx`
- Create: `src/features/ontology/components/ontology-issues/ontology-issues-sheet.tsx`
- Create: `src/features/ontology/components/ontology-issues/index.ts`
- Test: `tests/ontology-issues-sheet-contract.test.ts`

**Interfaces:**

- Consumes:
  - `OntologyDefectReport`, `OntologyDefect` from `@/features/ontology/utils/linter`
  - `RedundancyCluster`, `RecommendedVocabulary` from `@/features/ontology/server/services/ontology-analysis/analyze-ontology`
  - `IssuesCounts` from `@/features/ontology/utils/issues-summary`
- Produces:

  ```ts
  export interface OntologyIssuesSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    report: OntologyDefectReport
    redundancyClusters?: RedundancyCluster[]
    recommendedVocabularies?: RecommendedVocabulary[]
    isLoadingAnalysis?: boolean
    analysisError?: Error | null
    onSelectEntity: (id: string, kind: "class" | "relation") => void
    onSuppress: (defectId: string) => void
    onRestore: (defectId: string) => void
    onQuickFix?: (defect: OntologyDefect) => void
    onImportVocabulary?: (vocab: RecommendedVocabulary) => Promise<void>
    importingPrefix?: string | null
    onOpenVocabularies?: () => void
  }
  ```

- [ ] **Step 1: Write contract test for `OntologyIssuesSheet` and its tabs**

Create `tests/ontology-issues-sheet-contract.test.ts` verifying tab structure, prop types, and export contracts.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-issues-sheet-contract.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/features/ontology/components/ontology-issues/` components**

1. `types.ts`: Define props and tab values (`"defects" | "redundancies" | "standards"`).
2. `defect-card.tsx`: Port and refine the card from `ontology-defects/defect-card.tsx` with severity badge, target name, explanation, quick-fix button, and suppress/restore toggle.
3. `structural-defects-tab.tsx`: Sub-filters (`All`, `Errors`, `Warnings`, `Info`, `Muted`) with scrollable list of `DefectCard`.
4. `redundancies-tab.tsx`: Searchable redundancy cluster cards with member class pills and refactor link. Shows loading skeleton when `isLoadingAnalysis` is true, or empty state if 0 clusters.
5. `standards-tab.tsx`: Recommended external ontologies with 1-click import button and loading spinner (`isImporting`).
6. `ontology-issues-sheet.tsx`:
   - Slide-over `Sheet` (`side="right"`, responsive width `sm:max-w-xl md:max-w-2xl`).
   - Header with concrete summary badges:
     - `🔴 {errorCount} Error(s)` (if > 0)
     - `🟡 {warningCount} Warning(s)` (if > 0)
     - `🔵 {redundancyCount} Redundanc{ies|y}` (if > 0)
     - `🟢 Clean` (if all 0)
   - 3 tabs:
     - `Structural Defects ({report.total})`
     - `Redundancies ({redundancyClusters?.length ?? 0})`
     - `Standards ({recommendedVocabularies?.length ?? 0})`
7. `index.ts`: Re-export `OntologyIssuesSheet`, `DefectCard`, and types.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-issues-sheet-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-issues/ tests/ontology-issues-sheet-contract.test.ts
git commit -m "feat(ontology): create consolidated OntologyIssuesSheet with defects, redundancies, and standards tabs"
```

---

### Task 5: Wire `OntologyIssuesSheet` into `OntologyShell` and Retire Obsolete Dialog

**Files:**

- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
- Modify: `src/features/ontology/README.md`
- Delete:
  - `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/ontology-analysis-report-dialog.tsx`
  - `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/redundancy-clusters-tab.tsx`
  - `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/class-alignment-matrix-tab.tsx`
  - `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/recommended-vocabularies-tab.tsx`
  - `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/refactor-example-preview-dialog.tsx`
  - `src/features/ontology/components/ontology-defects/ontology-defects-sheet.tsx`
  - `src/features/ontology/components/ontology-defects/defect-card.tsx`
  - `src/features/ontology/components/ontology-defects/index.ts`
- Test: `tests/ontology-issues-integration.test.ts`

- [ ] **Step 1: Write integration cleanup test**

Create `tests/ontology-issues-integration.test.ts` verifying that:

1. `OntologyIssuesSheet` replaces `OntologyDefectsSheet`.
2. The obsolete `ontology-analysis-report-dialog` directory is completely removed from the filesystem.
3. Analysis query runs on-demand without crashing on empty ontologies.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/ontology-issues-integration.test.ts`
Expected: FAIL before cleanup.

- [ ] **Step 3: Wire `ontology-shell.tsx` and delete obsolete components**

1. In `ontology-shell.tsx`:
   - Replace import of `OntologyDefectsSheet` with `OntologyIssuesSheet` from `../ontology-issues`.
   - Add state: `const [issuesSheetOpen, setIssuesSheetOpen] = useState(false)`.
   - Add state: `const [importingPrefix, setImportingPrefix] = useState<string | null>(null)`.
   - Add TanStack query for full ontology analysis:
     ```ts
     const {
       data: analysisData,
       isLoading: isLoadingAnalysis,
       error: analysisError,
     } = useQuery({
       queryKey: ["ontology-analysis", currentDocument.id],
       queryFn: () => runFullOntologyAnalysis(currentDocument.id),
       enabled: issuesSheetOpen && Boolean(currentDocument.id),
     })
     ```
   - Calculate typed issue counts:
     ```ts
     const issuesCounts = useMemo(
       () => ({
         error: defectsReport.counts.error,
         warning: defectsReport.counts.warning,
         suggestion: analysisData?.redundancyClusters.length ?? 0,
         info: defectsReport.counts.info,
       }),
       [defectsReport.counts, analysisData?.redundancyClusters.length]
     )
     ```
   - Implement `handleImportVocabulary`:
     ```ts
     async function handleImportVocabulary(vocab: RecommendedVocabulary) {
       setImportingPrefix(vocab.prefix)
       try {
         await addReferenceOntology({
           prefix: vocab.prefix,
           name: vocab.name,
           baseIri: vocab.baseIri,
           sourceRegistry: vocab.suggestedSource,
           sourceId: vocab.prefix,
         })
         toast.success(
           `Imported "${vocab.name}" (${vocab.prefix.toUpperCase()}). Indexing terms.`
         )
         await Promise.all([
           queryClient.invalidateQueries({
             queryKey: ["reference-ontologies"],
           }),
           queryClient.invalidateQueries({ queryKey: ["reference-terms"] }),
           queryClient.invalidateQueries({
             queryKey: ["ontology-analysis", currentDocument.id],
           }),
         ])
       } catch (err) {
         toast.error(
           err instanceof Error ? err.message : "Failed to import vocabulary."
         )
       } finally {
         setImportingPrefix(null)
       }
     }
     ```
   - Pass `issuesCounts`, `onOpenIssuesSheet={() => setIssuesSheetOpen(true)}`, and `onOpenVocabularies={() => setReferenceDialogOpen(true)}` to `OntologyHeader`.
   - Mount `<OntologyIssuesSheet ... />` in place of `OntologyDefectsSheet`.
2. Delete obsolete files:
   - `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/` (all 5 files).
   - `src/features/ontology/components/ontology-defects/` (all 3 files).
3. Update `src/features/ontology/README.md` to document the consolidated header landmarks and `OntologyIssuesSheet`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/ontology-issues-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/ontology-shell/ontology-shell.tsx src/features/ontology/README.md tests/ontology-issues-integration.test.ts
git rm -rf src/features/ontology/components/dialogs/ontology-analysis-report-dialog src/features/ontology/components/ontology-defects
git commit -m "refactor(ontology): wire OntologyIssuesSheet, retire OntologyAnalysisReportDialog and legacy defects sheet"
```

---

### Task 6: Verification, Typecheck, and Full Regression Check

**Files:**

- None (verification run across entire codebase)

- [ ] **Step 1: Run full test suite**

Run: `npm exec pnpm -- test`
Expected: All 80+ tests pass with 0 failures.

- [ ] **Step 2: Run typecheck**

Run: `npm exec pnpm -- typecheck`
Expected: Clean output with 0 type errors.

- [ ] **Step 3: Run linter**

Run: `npm exec pnpm -- lint`
Expected: 0 errors and 0 warnings.

- [ ] **Step 4: Commit any remaining fixes if needed**

```bash
git commit --allow-empty -m "chore(ontology): complete Phase 1 header and quality consolidation"
```
