# Plan 003: Fix Fact Table HTML DOM Structure & Scroll Blowout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ebf3cc..HEAD -- src/features/documents/components/fact-table/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Status**: DONE (Fixed in commit `2f1eae4`)
- **Planned at**: commit `4ebf3cc`, 2026-10-16

## Why this matters

In `FactTable`, when a user unchecks "Group by section", the entire browser viewport window becomes scrollable instead of confining scroll behavior to the table body container (`docs/backlog/TODOS_NOW.md:38`). The root cause is an HTML table specification violation in `FactTableRow`: it renders `<PendingEntityClassDialog>` and `<TooltipProvider>` as direct children of `<tbody>` surrounding `<tr>`. Browsers invoke "foster parenting" to eject invalid non-`<tr>` elements outside the `<table>`, corrupting flexbox height calculations and blowing out the `overflow-auto` boundaries. Cleaning the table DOM structure fixes scroll containment in both flat and grouped modes.

## Current state

- `src/features/documents/components/fact-table/fact-table-row.tsx:139-152`:

  ```tsx
  return (
    <>
      <PendingEntityClassDialog
        dialogType={mutations.dialogType}
        affectedFacts={mutations.affectedFacts}
        currentClassName={currentClassName}
        pendingClassName={pendingClassName}
        onConfirm={mutations.handleConfirmEntityClass}
        onCancel={mutations.handleCancelEntityClass}
      />

      <TooltipProvider>
        <tr className={cn("border-b transition-colors", rowClassName)}>
  ```

  And lines 392–401:

  ```tsx
        </tr>
        {primaryAnchor ? (
          <FactTableAnchorRow
            quoteText={primaryAnchor.quote_text}
            rowClassName={rowClassName}
          />
        ) : null}
      </TooltipProvider>
    </>
  )
  ```

  Notice `<PendingEntityClassDialog>` and `<TooltipProvider>` sit directly inside `<tbody>` alongside `<tr>`.

- `src/features/documents/components/fact-table/fact-table.tsx:245-258`:

  ```tsx
  <div className="min-h-0 flex-1 overflow-auto">
    {isEmpty ? (
      <p ...>No facts match the current filter.</p>
    ) : (
      <table className="w-full table-fixed text-xs">
        <FactTableHeader ... />
        <tbody>
          {groupBySection
            ? sectionGroups.map(...)
            : sortedFacts.map((fact) => (
                <FactTableRow ... />
              ))}
        </tbody>
      </table>
    )}
  </div>
  ```

- `docs/backlog/TODOS_NOW.md:38`:
  _"Facttable bug: dont 'group by section' makes whole page scrollable"_

## Commands you will need

| Purpose   | Command                      | Expected on success |
| --------- | ---------------------------- | ------------------- |
| Install   | `npm exec pnpm -- install`   | exit 0              |
| Typecheck | `npm exec pnpm -- typecheck` | exit 0, no errors   |
| Tests     | `npm exec pnpm -- test`      | all pass            |
| Lint      | `npm exec pnpm -- lint`      | exit 0              |

## Scope

**In scope**:

- `src/features/documents/components/fact-table/fact-table.tsx` (wrap container in `TooltipProvider`)
- `src/features/documents/components/fact-table/fact-table-row.tsx` (remove `TooltipProvider` from row and place `PendingEntityClassDialog` inside `<td>` cell)
- `tests/fact-table-dom-contract.test.ts` (create test ensuring row returns only `<tr>` elements)

**Out of scope**:

- Do not modify bulk review logic or review mutation hooks in `use-fact-mutations.ts`.
- Do not change styling or column definitions of `FactTableHeader`.

## Git workflow

- Branch: `fix/fact-table-dom-scroll-structure`
- Commit message: `fix(documents): lift TooltipProvider and place dialogs in table cells to eliminate scroll blowout`

## Steps

### Step 1: Lift `TooltipProvider` to wrap `FactTable` in `fact-table.tsx`

In `src/features/documents/components/fact-table/fact-table.tsx`:

1. Import `TooltipProvider` from `@/components/ui/tooltip`:

   ```typescript
   import { TooltipProvider } from "@/components/ui/tooltip"
   ```

2. Wrap the table container (or the root return) in `<TooltipProvider delayDuration={200}>`:
   ```tsx
   return (
     <TooltipProvider delayDuration={200}>
       <div className="flex h-full flex-col">
         <FactTableToolbar ... />
         <div className="min-h-0 flex-1 overflow-auto">
           ...
         </div>
       </div>
     </TooltipProvider>
   )
   ```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 2: Clean `FactTableRow` JSX to output valid `<tr>` elements only

In `src/features/documents/components/fact-table/fact-table-row.tsx`:

1. Remove `<TooltipProvider>` and `</TooltipProvider>` wrapping the rows.
2. Move `<PendingEntityClassDialog>` into the actions `<td>` cell (or inside the last `<td>` near the action buttons). In HTML, `<td>` elements are valid parent containers for dialogs and modals:
   ```tsx
   <td className="w-16 px-2 py-2 text-right align-top">
     <PendingEntityClassDialog
       dialogType={mutations.dialogType}
       affectedFacts={mutations.affectedFacts}
       currentClassName={currentClassName}
       pendingClassName={pendingClassName}
       onConfirm={mutations.handleConfirmEntityClass}
       onCancel={mutations.handleCancelEntityClass}
     />
     <div className="flex items-center justify-end gap-1">...</div>
   </td>
   ```
3. Ensure the return of `FactTableRow` is strictly:
   ```tsx
   return (
     <>
       <tr className={cn("border-b transition-colors", rowClassName)}>
         {/* td cells */}
       </tr>
       {primaryAnchor ? (
         <FactTableAnchorRow
           quoteText={primaryAnchor.quote_text}
           rowClassName={rowClassName}
         />
       ) : null}
     </>
   )
   ```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 3: Add automated contract test for FactTableRow DOM compliance

Create `tests/fact-table-dom-contract.test.ts`:

```typescript
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("FactTable wraps with TooltipProvider at table level", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/features/documents/components/fact-table/fact-table.tsx"
  )
  const content = fs.readFileSync(filePath, "utf-8")
  assert.ok(
    content.includes("<TooltipProvider"),
    "FactTable must wrap with TooltipProvider"
  )
})

test("FactTableRow does not wrap tr in TooltipProvider or render dialog as direct tbody child", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/features/documents/components/fact-table/fact-table-row.tsx"
  )
  const content = fs.readFileSync(filePath, "utf-8")
  assert.ok(
    !content.includes("<TooltipProvider>"),
    "FactTableRow must not wrap tr in TooltipProvider"
  )
  // Ensure return statement does not have PendingEntityClassDialog directly before tr
  const returnMatch =
    /return\s*\(\s*<>[\s\S]*?<PendingEntityClassDialog[\s\S]*?<tr/.test(content)
  assert.equal(
    returnMatch,
    false,
    "PendingEntityClassDialog must not be placed directly between tbody and tr"
  )
})
```

**Verify**:
`npm exec pnpm -- test` → all tests pass.

## Done criteria

- [x] `npm exec pnpm -- typecheck` exits 0 with zero errors
- [x] `npm exec pnpm -- lint` exits 0 with zero errors
- [x] `npm exec pnpm -- test` exits 0 with new contract tests passing
- [x] `FactTableRow` contains zero non-`<tr>` top-level children
- [x] `plans/README.md` status row updated to DONE (commit `2f1eae4`)

## STOP conditions

- If moving `PendingEntityClassDialog` inside `<td>` affects dialog z-index or rendering, check that Radix `DialogContent` utilizes `DialogPortal` (standard in shadcn) which attaches to `document.body`.
