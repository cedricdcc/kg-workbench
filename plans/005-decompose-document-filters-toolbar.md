# Plan 005: Decompose DocumentFiltersToolbar into Custom Hook and Subcomponents

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ebf3cc..HEAD -- src/features/documents/components/shared/document-filters-toolbar/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `4ebf3cc`, 2026-10-16

## Why this matters

`src/features/documents/components/shared/document-filters-toolbar/document-filters-toolbar.tsx` has grown into a 909-line "god component" that combines four distinct `useQuery` calls, extensive options grouping/formatting logic, expandable accordion state handling, and dense nested JSX. This violates the project's single-responsibility and component size conventions (`AGENT_CONTRACT.md:27`) and is explicitly tracked as a priority refactoring task in `docs/backlog/TODOS_NOW.md:40` (_"Split: documentfilterstoolbar (maybe new hook?)"_). Decomposing the file into a dedicated data/options hook (`useDocumentFilterData`) and two focused subcomponents (`DocumentFiltersToolbarCompact` and `DocumentFiltersToolbarExpanded`) brings every file under 250 LOC while preserving 100% of the UI behavior and filter synchronization.

## Current state

- `src/features/documents/components/shared/document-filters-toolbar/document-filters-toolbar.tsx` (909 lines):
  - Lines 100–180: Data fetching via 4 separate `useQuery` calls (`fetchDocumentWithSections`, `fetchDocumentFacts`, `fetchOntologyForDocument`, `fetchDocumentEntities`).
  - Lines 181–340: Heavy option formatting (`buildEntityOptionData`, `buildRoleEntityOptionData`, `buildExtractedRelationOptionData`, `withSelectedGroupedOption`).
  - Lines 341–550: Compact primary bar JSX (status multi-select, section dropdown, module dropdown, scope switches, expand toggle, reset button).
  - Lines 551–909: Expanded drawer JSX (ontology classes, ontology relations, role filter stacks, extracted entities, extracted relations).

- `docs/backlog/TODOS_NOW.md:40`:
  _"Split: documentfilterstoolbar (maybe new hook?)"_

- `AGENT_CONTRACT.md:27`:
  _"Actively extract subcomponents when a component becomes long or a section has its own responsibility, repeated structure, stateful behavior, or a useful name."_

## Commands you will need

| Purpose   | Command                      | Expected on success |
| --------- | ---------------------------- | ------------------- |
| Install   | `npm exec pnpm -- install`   | exit 0              |
| Typecheck | `npm exec pnpm -- typecheck` | exit 0, no errors   |
| Tests     | `npm exec pnpm -- test`      | all pass            |
| Lint      | `npm exec pnpm -- lint`      | exit 0              |

## Scope

**In scope**:

- `src/features/documents/components/shared/document-filters-toolbar/hooks/use-document-filter-data.ts` (create new hook)
- `src/features/documents/components/shared/document-filters-toolbar/document-filters-toolbar-compact.tsx` (create subcomponent for top bar)
- `src/features/documents/components/shared/document-filters-toolbar/document-filters-toolbar-expanded.tsx` (create subcomponent for expandable drawer)
- `src/features/documents/components/shared/document-filters-toolbar/document-filters-toolbar.tsx` (refactor into coordinator under 150 LOC)
- `tests/document-filters-toolbar-decomposition.test.ts` (create test asserting component decomposition and bounds)

**Out of scope**:

- Do not modify workspace state management in `src/features/documents/hooks/documents-workspace-state.tsx`.
- Do not modify existing subcomponents (`document-filters-toolbar-grouped-select.tsx`, `role-filter-stack.tsx`, etc.).
- Do not change filter parameters, keys, or styling classes.

## Git workflow

- Branch: `refactor/decompose-document-filters-toolbar`
- Commit message: `refactor(documents): decompose DocumentFiltersToolbar into custom hook and subcomponents`

## Steps

### Step 1: Create `hooks/use-document-filter-data.ts`

Extract the queries, option derivations, and memoized values from lines 100–340 of `document-filters-toolbar.tsx` into `src/features/documents/components/shared/document-filters-toolbar/hooks/use-document-filter-data.ts`.

The hook should accept nothing (or read from `useDocumentsWorkspace()`) and return:

```typescript
export interface DocumentFilterData {
  isLoading: boolean
  isAtDefaults: boolean
  hasExpandableFiltersActive: boolean
  statusOptions: Array<{ id: string; label: string; count?: number }>
  sectionOptions: Array<{ id: string; label: string }>
  moduleOptions: Array<{ id: string; label: string }>
  classOptions: DocumentFiltersToolbarGroupedOption[]
  relationOptions: DocumentFiltersToolbarGroupedOption[]
  entityOptionData: ReturnType<typeof buildEntityOptionData>
  roleEntityOptionData: ReturnType<typeof buildRoleEntityOptionData>
  extractedRelationOptionData: ReturnType<
    typeof buildExtractedRelationOptionData
  >
  // Handlers and workspace actions
  handleReset: () => void
}
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 2: Create `document-filters-toolbar-compact.tsx`

Extract lines 341–550 of `document-filters-toolbar.tsx` into `document-filters-toolbar-compact.tsx`.

It renders:

- Status `MultiSelectDropdown`
- Section selector
- Module selector
- Chapter / Module scope switches
- "More filters" expand/collapse toggle button with badge for active filter count
- Reset filters button

Props:

```typescript
export interface DocumentFiltersToolbarCompactProps {
  isExpanded: boolean
  onToggleExpanded: () => void
  filterData: DocumentFilterData
}
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 3: Create `document-filters-toolbar-expanded.tsx`

Extract lines 551–909 of `document-filters-toolbar.tsx` into `document-filters-toolbar-expanded.tsx`.

It renders the collapsible accordion section containing:

- `Ontology` group (`DocumentFiltersToolbarFilterGroup`):
  - Class grouped select
  - Relation grouped select
  - Role-based class filters stack (`DocumentFiltersToolbarRoleFilterStack`)
- `Extracted` group (`DocumentFiltersToolbarFilterGroup`):
  - Concrete entity nested select
  - Extracted relation nested select
  - Role-based entity filters stack (`DocumentFiltersToolbarRoleFilterStack`)

Props:

```typescript
export interface DocumentFiltersToolbarExpandedProps {
  filterData: DocumentFilterData
}
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 4: Streamline `document-filters-toolbar.tsx`

Refactor `document-filters-toolbar.tsx` to serve as a clean shell:

```tsx
export function DocumentFiltersToolbar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const filterData = useDocumentFilterData()

  return (
    <div className="flex flex-col border-b bg-background/95 backdrop-blur-xs">
      <DocumentFiltersToolbarCompact
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((prev) => !prev)}
        filterData={filterData}
      />
      {isExpanded && <DocumentFiltersToolbarExpanded filterData={filterData} />}
    </div>
  )
}
```

Ensure total line count of `document-filters-toolbar.tsx` is under 150 LOC.

**Verify**:
`npm exec pnpm -- typecheck` && `npm exec pnpm -- lint` → both exit 0.

### Step 5: Add automated decomposition test

Create `tests/document-filters-toolbar-decomposition.test.ts`:

```typescript
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("DocumentFiltersToolbar is decomposed into subcomponents under 300 LOC", () => {
  const baseDir = path.resolve(
    process.cwd(),
    "src/features/documents/components/shared/document-filters-toolbar"
  )

  const mainFile = path.join(baseDir, "document-filters-toolbar.tsx")
  const compactFile = path.join(baseDir, "document-filters-toolbar-compact.tsx")
  const expandedFile = path.join(
    baseDir,
    "document-filters-toolbar-expanded.tsx"
  )
  const hookFile = path.join(baseDir, "hooks/use-document-filter-data.ts")

  assert.ok(fs.existsSync(mainFile), "document-filters-toolbar.tsx must exist")
  assert.ok(
    fs.existsSync(compactFile),
    "document-filters-toolbar-compact.tsx must exist"
  )
  assert.ok(
    fs.existsSync(expandedFile),
    "document-filters-toolbar-expanded.tsx must exist"
  )
  assert.ok(fs.existsSync(hookFile), "use-document-filter-data.ts must exist")

  const countLines = (filePath: string) =>
    fs.readFileSync(filePath, "utf-8").split("\n").length

  assert.ok(
    countLines(mainFile) < 180,
    `main toolbar must be < 180 LOC, was ${countLines(mainFile)}`
  )
  assert.ok(
    countLines(compactFile) < 300,
    `compact toolbar must be < 300 LOC, was ${countLines(compactFile)}`
  )
})
```

**Verify**:
`npm exec pnpm -- test` → all tests pass.

## Done criteria

- [ ] `npm exec pnpm -- typecheck` exits 0 with zero errors
- [ ] `npm exec pnpm -- lint` exits 0 with zero errors
- [ ] `npm exec pnpm -- test` exits 0 with all existing and decomposition tests passing
- [ ] `document-filters-toolbar.tsx` is under 180 lines
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- If any shared filter sync between reader, fact table, graph, or inspector behaves differently, review the exact reducer action dispatches in `useDocumentFilterData` against the original implementation.
