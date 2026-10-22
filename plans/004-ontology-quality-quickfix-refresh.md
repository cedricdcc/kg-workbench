# Plan 004: Ontology Quality Quick Fix Client Revalidation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ebf3cc..HEAD -- src/features/ontology/components/ontology-shell/ontology-shell.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Status**: DONE (Fixed in commit `77b3e3d`)
- **Planned at**: commit `4ebf3cc`, 2026-10-16

## Why this matters

The `OntologyIssuesSheet` provides automated "Quick Fix" buttons to resolve structural defects (e.g. breaking a hierarchy cycle by clearing `parentClassId` or deleting a dangling relation). While the server actions (`updateClass`, `deleteRelation`) execute and commit the fix to the database, `OntologyShell` currently does not invoke `router.refresh()` or state synchronization. Because `classes` and `relations` are server-rendered props loaded in `src/app/(app)/ontology/page.tsx`, the client remains stale after the quick fix finishes, leaving the defect visible in the issues drawer and canvas until the user manually reloads the browser.

## Current state

- `src/features/ontology/components/ontology-shell/ontology-shell.tsx:190-205`:

  ```typescript
  async function handleQuickFix(defect: OntologyDefect) {
    try {
      if (defect.quickFixType === "clear_parent") {
        await updateClass(defect.targetId, { parentClassId: null })
        toast.success(`Cleared parent link on "${defect.targetName}"`)
      } else if (defect.quickFixType === "delete_relation") {
        await deleteRelation(defect.targetId)
        toast.success(`Deleted dangling relation "${defect.targetName}"`)
      }
    } catch {
      toast.error("Failed to apply quick fix")
    }
  }
  ```

  Note `router.refresh()` is never called, and `useRouter` is not imported.

- `src/features/ontology/components/ontology-shell/ontology-shell.tsx:146-152`:
  ```typescript
  const defectsReport = useMemo(() => {
    return runOntologyLinter({
      classes,
      relations,
      suppressedIds: suppressedSet,
    })
  }, [classes, relations, suppressedSet])
  ```
  The linter runs on the `classes` and `relations` props. Without `router.refresh()`, Next.js Server Components do not re-render and re-pass fresh props to `OntologyShell`.

## Commands you will need

| Purpose   | Command                      | Expected on success |
| --------- | ---------------------------- | ------------------- |
| Install   | `npm exec pnpm -- install`   | exit 0              |
| Typecheck | `npm exec pnpm -- typecheck` | exit 0, no errors   |
| Tests     | `npm exec pnpm -- test`      | all pass            |
| Lint      | `npm exec pnpm -- lint`      | exit 0              |

## Scope

**In scope**:

- `src/features/ontology/components/ontology-shell/ontology-shell.tsx` (import `useRouter` and call `router.refresh()` on quick-fix mutations)
- `tests/ontology-quick-fix-revalidation.test.ts` (create test ensuring `useRouter` and `router.refresh()` are wired)

**Out of scope**:

- Do not modify defect detection rules in `src/features/ontology/utils/linter/`.
- Do not alter `OntologyIssuesSheet` presentation components.

## Git workflow

- Branch: `fix/ontology-quality-quickfix-refresh`
- Commit message: `fix(ontology): trigger router.refresh() on quick-fix execution in OntologyShell`

## Steps

### Step 1: Wire `useRouter` and trigger `router.refresh()` in `OntologyShell`

In `src/features/ontology/components/ontology-shell/ontology-shell.tsx`:

1. Import `useRouter` from `next/navigation`:

   ```typescript
   import { useRouter } from "next/navigation"
   ```

2. Inside `OntologyShell`, instantiate the router:

   ```typescript
   export function OntologyShell({ ... }: OntologyShellProps) {
     const router = useRouter()
   ```

3. In `handleQuickFix`, call `router.refresh()` and invalidate analysis queries upon success:
   ```typescript
   async function handleQuickFix(defect: OntologyDefect) {
     try {
       if (defect.quickFixType === "clear_parent") {
         await updateClass(defect.targetId, { parentClassId: null })
         toast.success(`Cleared parent link on "${defect.targetName}"`)
         router.refresh()
         queryClient.invalidateQueries({
           queryKey: ["ontology-analysis", currentDocument.id],
         })
       } else if (defect.quickFixType === "delete_relation") {
         await deleteRelation(defect.targetId)
         toast.success(`Deleted dangling relation "${defect.targetName}"`)
         router.refresh()
         queryClient.invalidateQueries({
           queryKey: ["ontology-analysis", currentDocument.id],
         })
       }
     } catch {
       toast.error("Failed to apply quick fix")
     }
   }
   ```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 2: Add contract verification test

Create `tests/ontology-quick-fix-revalidation.test.ts`:

```typescript
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("OntologyShell wires useRouter and invokes router.refresh in handleQuickFix", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-shell/ontology-shell.tsx"
  )
  const content = fs.readFileSync(filePath, "utf-8")

  assert.ok(
    content.includes('import { useRouter } from "next/navigation"'),
    "OntologyShell must import useRouter from next/navigation"
  )
  assert.ok(
    content.includes("const router = useRouter()"),
    "OntologyShell must instantiate useRouter"
  )
  assert.ok(
    content.includes("router.refresh()"),
    "OntologyShell must invoke router.refresh() when executing quick fixes"
  )
})
```

**Verify**:
`npm exec pnpm -- test` → all tests pass.

## Done criteria

- [x] `npm exec pnpm -- typecheck` exits 0 with zero errors
- [x] `npm exec pnpm -- lint` exits 0 with zero errors
- [x] `npm exec pnpm -- test` exits 0 with contract test passing
- [x] `plans/README.md` status row updated to DONE (commit `77b3e3d`)

## STOP conditions

- If `router.refresh()` throws a client exception during unit tests, ensure tests mock or isolate Next.js navigation appropriately.
