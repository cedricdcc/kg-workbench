# Archived Dataset Mapping State Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where mapping an archived dataset displays columns and data of the previously added/profiled file, and preserve the dataset UUID through the profiler modal to update the archive entry.

**Architecture:** Use composite identity tracking (`${id}:${sourceName}`) and explicit React component keying for `DatasetMappingModal` to guarantee isolated state lifecycles. Propagate `datasetId` through `TabularProfilerModal` and clean up ephemeral profiling results on modal close in `ontology-shell.tsx`.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, TanStack Query, Radix UI Dialog / shadcn, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-11-09-archived-dataset-mapping-state-fix-design.md`

## Global Constraints

- Do not use `any` unless strictly justified.
- App Router patterns: keep Client Components focused; no unnecessary extra wrappers.
- Do not introduce breaking changes to existing database queries or schema contracts.
- Ensure all Node tests pass with `pnpm check`.

## Review Focus

1. Consecutive datasets with empty ID (`id: ""`) must re-synchronize state and reset the active step to "entity" without retaining previous column mappings.
2. Opening `DatasetMappingModal` directly from the archive browser after uploading a different file must show the archived dataset's columns and row preview.
3. Inspecting an archived dataset profile and clicking "Map to KG" must retain the dataset's UUID so `commitDatasetMappingAction` updates the database record.
4. Profiling a new file or database inside `TabularProfilerModal` must override any previously passed external `result` prop.
5. Closing `TabularProfilerModal` must clear `profiledDatasetResult` and `inspectedDatasetId` in `ontology-shell.tsx`.

---

### Task 1: Wizard Re-Sync & Keying

**Files:**

- Modify: `src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx:40-50`
- Test: `tests/dataset-mapping-wizard-dom.test.ts`

- [ ] **Step 1: Write the failing tests**
      Add unit tests in `tests/dataset-mapping-wizard-dom.test.ts` verifying:
  - `computeDatasetKey(dataset)` produces a distinct composite key for datasets with empty IDs (`id: ""`) and different source names.
  - Consecutive datasets with different source names and identical/empty IDs trigger state re-initialization.

- [ ] **Step 2: Run tests to confirm failure**
      Run `node --test tests/dataset-mapping-wizard-dom.test.ts` to confirm new tests fail.

- [ ] **Step 3: Implement composite key re-sync in `dataset-mapping-modal.tsx`**
  - Export helper `getDatasetCompositeKey(dataset: ArchivedDatasetSource | null): string` in `src/features/tabular/components/dataset-mapping-wizard/types.ts`.
  - Update `dataset-mapping-modal.tsx` to compare `lastDatasetKey` using `getDatasetCompositeKey(dataset)`.
  - On key change, re-run `setWizardState(initializeWizardState(dataset))` and `setCurrentStep("entity")`.

- [ ] **Step 4: Run tests to verify they pass**
      Run `node --test tests/dataset-mapping-wizard-dom.test.ts` and ensure all tests pass.

- [ ] **Step 5: Commit changes**
      `git add src/features/tabular/components/dataset-mapping-wizard/ tests/dataset-mapping-wizard-dom.test.ts`
      `git commit -m "fix(tabular): add composite key re-sync to dataset mapping modal"`

---

### Task 2: Profiler Identity Preservation & Modal Lifecycle Cleanup

**Files:**

- Modify: `src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx:40-110`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx:180-210,840-860,960-1015`
- Test: `tests/tabular-profiler-modal-dom.test.ts`

- [ ] **Step 1: Write the failing tests**
      Add tests in `tests/tabular-profiler-modal-dom.test.ts` verifying:
  - `resolveEffectiveProfilerResult(result, internalResult, isDismissed)` prioritizes fresh `internalResult` over stale initial `result`.
  - `onMapToKg` passes `datasetId` when provided.

- [ ] **Step 2: Run tests to confirm failure**
      Run `node --test tests/tabular-profiler-modal-dom.test.ts`.

- [ ] **Step 3: Implement identity preservation and effective result resolution**
  - In `tabular-profiler-modal.tsx`:
    - Add `datasetId?: string` to `TabularProfilerModalProps`.
    - Update `onMapToKg` signature: `(result, connConfig, format, datasetId?: string) => void`.
    - Fix `effectiveResult`: `isDismissed ? internalResult : (internalResult ?? result)`.
    - Pass `datasetId` to `onMapToKg(activeResult, connectionConfig, fileFormat, datasetId)`.
  - In `ontology-shell.tsx`:
    - Add state: `const [inspectedDatasetId, setInspectedDatasetId] = useState<string | null>(null)`.
    - In `onInspectProfile`: set `setInspectedDatasetId(dataset.id)`.
    - In `TabularProfilerModal`: pass `datasetId={inspectedDatasetId ?? undefined}`.
    - In `onOpenChange`: when `open === false`, call `setProfiledDatasetResult(null)` and `setInspectedDatasetId(null)`.
    - In `onMapToKg`: set `id: datasetId || inspectedDatasetId || ""`.
    - In `<DatasetMappingModal>`: add `key={selectedDatasetForMapping ? `${selectedDatasetForMapping.id || "ephemeral"}:${selectedDatasetForMapping.sourceName}` : "none"}` and conditionally render only when `Boolean(selectedDatasetForMapping)`.

- [ ] **Step 4: Run tests to verify they pass**
      Run `node --test tests/tabular-profiler-modal-dom.test.ts`.

- [ ] **Step 5: Commit changes**
      `git add src/features/tabular/components/tabular-profiler-modal/ src/features/ontology/components/ontology-shell/ tests/tabular-profiler-modal-dom.test.ts`
      `git commit -m "fix(tabular): preserve dataset identity in profiler and clean up modal state"`

---

### Task 3: Full Verification & E2E Validation

**Files:**

- Test: Entire test suite via `pnpm check`

- [ ] **Step 1: Run comprehensive check suite**
      Execute `npm exec pnpm -- check` to verify TypeScript compilation, linting, and all unit tests.

- [ ] **Step 2: Verify database sync integration**
      Execute `node --test tests/tabular-mapping-e2e-smoke.test.ts` to ensure end-to-end dataset mapping persistence operates without regression.

- [ ] **Step 3: Commit and summarize**
      Verify git status is clean and report results to user.
