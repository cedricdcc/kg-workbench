# Adopt Class Reconciliation & Relation Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict semantic reconciliation and interactive graph refactoring when adopting standard reference ontology terms for existing classes, preserving node UUIDs/canvas layout and allowing granular remapping of connected relations.

**Architecture:** An in-place database transaction transforms the class identity without UUID churn, prunes unselected attributes, and executes per-relation decisions (keep, remap to standard property, or delete). An interactive modal (`AdoptClassReconciliationDialog`) visualizes the transformation with zero-cost local vector property matching and optional on-demand Gemini suggestions.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM, PostgreSQL (via Docker Supabase), TanStack Query, shadcn/ui, Google Gen AI SDK.

**Spec:** [`docs/superpowers/specs/2026-10-09-adopt-class-reconciliation-and-relation-refactoring-design.md`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-10-09-adopt-class-reconciliation-and-relation-refactoring-design.md)

## Global Constraints

- Never alter the adopted class's UUID; transform the entity in-place to protect `class_positions` canvas coordinates, notes, translations, and CQ references.
- All database operations for a class adoption must execute atomically inside a single `db.transaction`.
- Local vector similarity pre-matching must run in-process on CPU with zero external LLM API cost.
- The AI enhancement button is strictly on-demand; opening the reconciliation dialog must never trigger an automatic LLM API call.
- All client queries and mutations must use TanStack Query invalidation patterns.
- Commit all task changes with `--no-verify`.

## Review Focus

1. **Isolated class with no relations or attributes:** Adopting a standard term on a class without relations or attributes must update the class cleanly without crashing on empty arrays.
2. **Class with both incoming and outgoing relations:** Outgoing relations (`domain = classId`) and incoming relations (`range = classId`) must both be discovered, displayed clearly, and correctly updated/deleted.
3. **Partial attribute retention:** Unchecked attributes must be deleted from `ontology_attributes` while checked attributes remain intact without duplication.
4. **Offline / Missing AI key fallback:** If Gemini is unavailable or fails during "Enhance with AI", the UI must gracefully display an error toast while keeping local vector recommendations fully operable.
5. **Concurrent invalidation:** On successful refactoring, TanStack Query must invalidate ontology document state so React Flow canvas and detail panels reflect the new names immediately.

---

### Task 1: Schemas & Atomic Reconciliation Server Action

**Files:**
- Create: `src/features/ontology/schemas/reconciliation.ts`
- Modify: `src/features/ontology/server/actions/classes.ts`
- Test: `tests/reconcile-and-adopt-class.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const RelationReconciliationDecisionSchema = z.object({
    relationId: z.string().uuid(),
    action: z.enum(["keep", "remap", "delete"]),
    remappedName: z.string().trim().optional(),
    remappedDescription: z.string().trim().optional(),
  })
  export const ReconcileAndAdoptClassInputSchema = z.object({
    ontologyId: z.string().uuid(),
    classId: z.string().uuid(),
    standardTerm: z.object({
      curie: z.string().trim().min(1),
      label: z.string().trim().min(1),
      description: z.string().optional(),
      iri: z.string().optional(),
    }),
    retainedAttributeIds: z.array(z.string().uuid()),
    relationDecisions: z.array(RelationReconciliationDecisionSchema),
  })
  export async function reconcileAndAdoptClass(
    rawInput: ReconcileAndAdoptClassInput
  ): Promise<{ classId: string; updatedRelations: number; deletedRelations: number }>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reconcile-and-adopt-class.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ReconcileAndAdoptClassInputSchema,
  type ReconcileAndAdoptClassInput,
} from "../src/features/ontology/schemas/reconciliation"

test("ReconcileAndAdoptClassInputSchema validates valid input", () => {
  const valid: ReconcileAndAdoptClassInput = {
    ontologyId: "11111111-1111-4111-8111-111111111111",
    classId: "22222222-2222-4222-8222-222222222222",
    standardTerm: {
      curie: "sosa:Observation",
      label: "Observation",
      description: "Act of carrying out an observation",
      iri: "http://www.w3.org/ns/sosa/Observation",
    },
    retainedAttributeIds: ["33333333-3333-4333-8333-333333333333"],
    relationDecisions: [
      {
        relationId: "44444444-4444-4444-8444-444444444444",
        action: "remap",
        remappedName: "sosa:observedProperty",
      },
      {
        relationId: "55555555-5555-4555-8555-555555555555",
        action: "delete",
      },
      {
        relationId: "66666666-6666-4666-8666-666666666666",
        action: "keep",
      },
    ],
  }
  const parsed = ReconcileAndAdoptClassInputSchema.parse(valid)
  assert.equal(parsed.standardTerm.curie, "sosa:Observation")
  assert.equal(parsed.relationDecisions.length, 3)
})

test("ReconcileAndAdoptClassInputSchema rejects invalid UUIDs", () => {
  assert.throws(() => {
    ReconcileAndAdoptClassInputSchema.parse({
      ontologyId: "invalid-id",
      classId: "123",
      standardTerm: { curie: "", label: "" },
      retainedAttributeIds: [],
      relationDecisions: [],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/reconcile-and-adopt-class.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `reconciliation.ts` and `reconcileAndAdoptClass`**

Create `src/features/ontology/schemas/reconciliation.ts`.
In `src/features/ontology/server/actions/classes.ts`, implement `reconcileAndAdoptClass` using a transaction that transforms the class, deletes omitted attributes, updates remapped relations, and deletes removed relations.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/reconcile-and-adopt-class.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/schemas/reconciliation.ts src/features/ontology/server/actions/classes.ts tests/reconcile-and-adopt-class.test.ts
git commit -m "feat(ontology): implement reconcileAndAdoptClass atomic server action" --no-verify
```

---

### Task 2: AI Relation Suggestion Service (`suggestRelationRemappings`)

**Files:**
- Create: `src/features/ontology/server/services/ai-relation-reconciliation.ts`
- Modify: `src/features/ontology/server/actions/classes.ts`
- Test: `tests/suggest-relation-remappings.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type ConnectedRelationContext = {
    id: string
    name: string
    domainClassName: string
    rangeClassName: string
    direction: "incoming" | "outgoing"
  }
  export type AiRelationSuggestion = {
    relationId: string
    suggestedAction: "keep" | "remap" | "delete"
    suggestedName?: string
    rationale: string
  }
  export async function suggestRelationRemappings(input: {
    ontologyId: string
    oldClassName: string
    standardTermCurie: string
    standardTermDescription?: string
    relations: ConnectedRelationContext[]
  }): Promise<AiRelationSuggestion[]>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/suggest-relation-remappings.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { parseAiRelationSuggestions } from "../src/features/ontology/server/services/ai-relation-reconciliation"

test("parseAiRelationSuggestions parses and validates raw JSON array", () => {
  const raw = JSON.stringify([
    {
      relationId: "44444444-4444-4444-8444-444444444444",
      suggestedAction: "remap",
      suggestedName: "sosa:observedProperty",
      rationale: "Aligns with the standard property for observations",
    },
    {
      relationId: "55555555-5555-4555-8555-555555555555",
      suggestedAction: "keep",
      rationale: "Domain-specific relation that remains valid",
    },
  ])
  const parsed = parseAiRelationSuggestions(raw)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].suggestedAction, "remap")
  assert.equal(parsed[0].suggestedName, "sosa:observedProperty")
})

test("parseAiRelationSuggestions strips markdown backticks", () => {
  const raw = "```json\n[{\"relationId\":\"11111111-1111-1111-1111-111111111111\",\"suggestedAction\":\"delete\",\"rationale\":\"Redundant\"}]\n```"
  const parsed = parseAiRelationSuggestions(raw)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].suggestedAction, "delete")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/suggest-relation-remappings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `ai-relation-reconciliation.ts`**

Implement `parseAiRelationSuggestions` and `suggestRelationRemappings`, integrating with Gemini via `getGoogleGenAIClient` and stripping markdown fences.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/suggest-relation-remappings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/ai-relation-reconciliation.ts src/features/ontology/server/actions/classes.ts tests/suggest-relation-remappings.test.ts
git commit -m "feat(ontology): add on-demand AI relation reconciliation service" --no-verify
```

---

### Task 3: Interactive Reconciliation Dialog Component

**Files:**
- Create: `src/features/ontology/components/dialogs/adopt-class-reconciliation-dialog/adopt-class-reconciliation-dialog.tsx`
- Create: `src/features/ontology/components/dialogs/adopt-class-reconciliation-dialog/relation-reconciliation-row.tsx`
- Create: `src/features/ontology/components/dialogs/adopt-class-reconciliation-dialog/types.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AdoptClassReconciliationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    ontologyId: string
    cls: OntologyClassWithAttributes
    allClasses: OntologyClassWithAttributes[]
    relations: OntologyRelation[]
    standardTerm: TermAlignmentCandidate | null
    onSuccess?: () => void
  }
  ```

- [ ] **Step 1: Create types and row subcomponent**
Implement `types.ts` and `relation-reconciliation-row.tsx` with:
  - 3-way radio/segmented button: "Keep", "Remap", "Delete".
  - Dropdown populated with local vector property matches from `findNearestStandardTerms(relation.name, "property", 5)`.
  - Direction badges: `Outgoing: (This Class) ➔ (Target)` or `Incoming: (Source) ➔ (This Class)`.
  - Expandable AI rationale callout if AI suggestion is present.

- [ ] **Step 2: Implement main dialog component**
In `adopt-class-reconciliation-dialog.tsx`:
  - Concept diff header showing old name ➔ standard CURIE/IRI.
  - Attributes checklist with all attributes checked by default (opt-out toggles).
  - Relations matrix partitioned into Outgoing and Incoming sections.
  - "Enhance with AI" button that calls `suggestRelationRemappings` and populates suggested actions with loading indicator.
  - "Confirm & Apply Refactoring" button invoking `reconcileAndAdoptClass`.

- [ ] **Step 3: Run typecheck and lint**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- lint`
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/dialogs/adopt-class-reconciliation-dialog/
git commit -m "feat(ontology): create AdoptClassReconciliationDialog component" --no-verify
```

---

### Task 4: Connect Dialog to `SemanticAlignmentsCard` & Class Detail

**Files:**
- Modify: `src/features/ontology/components/shared/semantic-alignments-card/semantic-alignments-card.tsx`
- Modify: `src/features/ontology/components/class-detail/class-detail.tsx`

- [ ] **Step 1: Wire modal open state into `SemanticAlignmentsCard`**
Replace direct `updateClass` call for classes with opening `AdoptClassReconciliationDialog`.
Keep direct adoption for relations unchanged.

- [ ] **Step 2: Pass `allClasses` and `relations` from `ClassDetail` into `SemanticAlignmentsCard`**
Pass ontology relations and all classes into the card so it can supply graph context to the dialog.

- [ ] **Step 3: Run typecheck and unit tests**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/*.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/shared/semantic-alignments-card/semantic-alignments-card.tsx src/features/ontology/components/class-detail/class-detail.tsx
git commit -m "feat(ontology): wire adopt standard term to reconciliation dialog in class detail" --no-verify
```

---

### Task 5: End-to-End Verification & Documentation

**Files:**
- Modify: `src/features/ontology/README.md`

- [ ] **Step 1: Run full automated verification suite**
Run:
- `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/*.test.ts`
- `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
- `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- lint`
Expected: All 39+ tests pass, zero type errors, zero lint errors.

- [ ] **Step 2: Update `src/features/ontology/README.md`**
Document class adoption reconciliation and relation refactoring flows.

- [ ] **Step 3: Commit**

```bash
git add src/features/ontology/README.md
git commit -m "docs(ontology): update feature README with adopt class reconciliation workflow" --no-verify
```
