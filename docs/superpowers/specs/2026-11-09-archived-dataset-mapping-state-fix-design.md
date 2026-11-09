# Archived Dataset Mapping State Synchronization Design

## Problem Statement

When a user archives a dataset source (or has existing archived datasets) and clicks **Map to KG** (either directly from the Dataset Archive browser or via **Profile -> Map to KG**), the mapping wizard displays the columns, schema, and sample data of the most recently uploaded or profiled file instead of the selected archived file.

Furthermore, when mapping an archived file from the profiler, the dataset source UUID is stripped (`id: ""`), preventing `commitDatasetMappingAction` from updating the dataset source's `mapping_spec` in Postgres.

## Root Cause Analysis

1. **Defective Re-Sync Condition in `DatasetMappingModal`**:
   `DatasetMappingModal` tracks `lastDatasetId` using `useState<string | null>(null)`. During render, it checks `if (dataset && dataset.id !== lastDatasetId)`. When a dataset is profiled without being pre-saved, its `id` is `""`. When an inspected archived dataset is mapped via the profiler, its `id` is also set to `""`. Because `"" !== ""` is `false`, React skips re-initializing `wizardState` and does not reset `currentStep` to `"entity"`. The wizard retains the entire state (columns, mappings, target class name, primary key) of the previous file.
2. **Missing Component Key in `ontology-shell.tsx`**:
   `<DatasetMappingModal open={Boolean(selectedDatasetForMapping)} dataset={selectedDatasetForMapping} ... />` is rendered without a `key` prop. React preserves the mounted modal's internal state across opens and closes when the component returns `null` instead of unmounting.
3. **Dataset Identity Stripping in Profiler Flow**:
   When the user inspects an archived dataset via `onInspectProfile(dataset)`, `ontology-shell.tsx` creates an ephemeral `TabularProfileResult` and forgets the dataset's database UUID. Clicking **Map to KG** inside `TabularProfilerModal` calls `onMapToKg`, which hardcodes `id: ""`.
4. **Stale State Leak in `TabularProfilerModal`**:
   `ontology-shell.tsx` passes `result={profiledDatasetResult}` to `TabularProfilerModal`. When `TabularProfilerModal` is closed, `setProfiledDatasetResult(null)` is not called. Consequently, `profiledDatasetResult` holds the last profiled file in `ontology-shell.tsx`. Inside `TabularProfilerModal`, `const effectiveResult = isDismissed ? internalResult : (result ?? internalResult)` gives precedence to `result` over `internalResult`, causing re-profiling attempts to mistakenly display the old `result`.

## Proposed Solution & Design

### 1. `DatasetMappingModal` Isolation & Composite Re-Sync

- Update `DatasetMappingModal` to track a composite identity:
  ```ts
  const datasetKey = dataset
    ? `${dataset.id || "ephemeral"}:${dataset.sourceName}`
    : null
  const [lastDatasetKey, setLastDatasetKey] = useState<string | null>(null)
  if (dataset && datasetKey !== lastDatasetKey) {
    setLastDatasetKey(datasetKey)
    setWizardState(initializeWizardState(dataset))
    setCurrentStep("entity")
  }
  ```
- In `ontology-shell.tsx`, provide a unique `key` to `DatasetMappingModal`:
  ```tsx
  {selectedDatasetForMapping && (
    <DatasetMappingModal
      key={`${selectedDatasetForMapping.id || "new"}:${selectedDatasetForMapping.sourceName}`}
      open={Boolean(selectedDatasetForMapping)}
      onOpenChange={(open) => {
        if (!open) setSelectedDatasetForMapping(null)
      }}
      dataset={selectedDatasetForMapping}
      ...
    />
  )}
  ```

### 2. Preserve Dataset Identity in Profiler Modal

- In `ontology-shell.tsx`, maintain `inspectedDatasetId: string | null` (or pass `datasetId` directly to `TabularProfilerModal`).
- Update `TabularProfilerModalProps` to accept optional `datasetId?: string`.
- Update `onMapToKg` signature in `TabularProfilerModalProps` and `ontology-shell.tsx` to accept `(result, connConfig, format, datasetId?: string)`.
- When clicking **Map to KG** from the profiler:
  ```tsx
  setSelectedDatasetForMapping({
    id: datasetId || inspectedDatasetId || "",
    ontologyId: currentDocument.id,
    groupKey: "shared",
    sourceName: res.fileName,
    ...
  })
  ```
- If the dataset has an existing `mappingSpec`, `initializeWizardState` restores the saved mappings automatically.

### 3. Clear Stale Profiler State on Modal Dismissal

- In `ontology-shell.tsx`, when `TabularProfilerModal` triggers `onOpenChange(false)`:
  ```tsx
  onOpenChange={(open) => {
    setProfilerModalOpen(open)
    if (!open) {
      setProfiledDatasetResult(null)
      setInspectedDatasetId(null)
    }
  }}
  ```
- In `TabularProfilerModal`, fix precedence:
  ```ts
  const effectiveResult = isDismissed
    ? internalResult
    : (internalResult ?? result)
  ```
  Fresh profiling actions run within the modal take immediate precedence over the initial `result` prop.

## Verification & Testing

1. Unit & DOM Tests:
   - Test composite key re-sync in `dataset-mapping-wizard-dom.test.ts`: test that consecutive datasets with empty IDs (`id: ""`) but different source names re-initialize state and reset step.
   - Test that `initializeWizardState` returns distinct column mappings and target class names for two different datasets.
   - Test `effectiveResult` resolution in `tabular-profiler-modal-dom.test.ts`.
2. Full Integration / TypeScript Check:
   - Run `npm exec pnpm -- check`.
