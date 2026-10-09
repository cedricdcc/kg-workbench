# Adopt Class Reconciliation & Relation Refactoring Design Spec

**Date:** 2026-10-09  
**Status:** Approved  
**Topic:** Interactive graph impact analysis and strict semantic reconciliation when adopting standard reference ontology terms for existing classes.

---

## 1. Problem Statement & Motivation

In KG Workbench, the Semantic Alignments card suggests standard ontology terms (e.g. from SOSA, ENVO, Schema.org) discovered via zero-cost local vector similarity. Previously, clicking **"Adopt Standard Term"** executed a shallow in-place update of the class's name and description.

In knowledge graphs, a class does not exist in isolation. It is connected to the graph through:
- **Incoming relations** (where `range_class_id` is this class)
- **Outgoing relations** (where `domain_class_id` is this class)
- **Attributes** (attached datatype properties)
- **Competency Questions** (linked as subject or object class)
- **Visual coordinates** (`class_positions` on the React Flow canvas)

Replacing a class requires "looking ahead" into the surrounding graph to:
1. Determine how existing relations behave when their domain or range is transformed into the standard concept.
2. Provide strict semantic control over which relations to keep, which to remap to canonical vocabulary properties (e.g. `observes` ➔ `sosa:observedProperty`), and which to prune.
3. Allow granular review of attached datatype attributes.
4. Perform this refactoring through a human-friendly diff and review modal, powered by zero-cost local vector pre-matching and an optional on-demand AI assistant.

---

## 2. Goals & Non-Goals

### Goals
- **In-Place Entity Transformation:** Update the class in-place to preserve its UUID, React Flow canvas coordinates, notes, localized text translations, and CQ references.
- **Strict Semantic Mapping:** Explicitly present every connected incoming and outgoing relation in a matrix where the user decides: Keep, Remap to standard property, or Delete.
- **Zero-Cost Vector Pre-Matching:** Pre-calculate top candidate property mappings for every relation using the local 384-d embedding similarity engine (100% offline, zero LLM credits).
- **Optional AI Suggestion Engine:** Provide an on-demand *"Enhance with AI"* button to query Gemini with the graph context and recommend relation mappings with explanations.
- **Attribute Carryover with Opt-Out:** Carry over all custom datatype attributes by default with individual checkboxes to prune obsolete ones.
- **Atomic Database Execution:** Execute the rename, attribute deletions, and relation updates/deletions in a single PostgreSQL transaction.

### Non-Goals
- Changing relation targets other than the re-anchored class in this step (cascading changes to third-party neighboring nodes).
- Automated silent refactoring without user review.

---

## 3. Architecture & Data Flow

```
User clicks "Adopt Standard Term" (SemanticAlignmentsCard)
               │
               ▼
┌────────────────────────────────────────────────────────┐
│        AdoptClassReconciliationDialog (Modal)         │
│                                                        │
│ 1. Concept Transformation Diff (Old ➔ Standard Term)   │
│ 2. Attributes Checklist (All checked, opt-out toggles) │
│ 3. Relations Matrix:                                   │
│    - Outgoing: (New) --[predicate]--> (Target)         │
│    - Incoming: (Source) --[predicate]--> (New)         │
│    - Choices: Keep | Remap | Delete                    │
│    - Pre-filled via Local Vector Matching              │
│    - Optional [Enhance with AI] Button                 │
└────────────────────────────────────────────────────────┘
               │
               ▼ User clicks "Confirm & Apply Refactoring"
┌────────────────────────────────────────────────────────┐
│         reconcileAndAdoptClass Server Action           │
│                                                        │
│  BEGIN TRANSACTION                                     │
│  1. Update ontologyClasses (name, description)         │
│  2. Delete unselected attributes                       │
│  3. Update remapped relations (name, description)      │
│  4. Delete pruned relations                            │
│  COMMIT TRANSACTION                                    │
│  Revalidate cache paths                                │
└────────────────────────────────────────────────────────┘
```

---

## 4. Backend Server Actions & Schemas

### 4.1 Schema Definitions (`src/features/ontology/schemas/reconciliation.ts`)

```typescript
import { z } from "zod"

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

export type RelationReconciliationDecision = z.infer<
  typeof RelationReconciliationDecisionSchema
>
export type ReconcileAndAdoptClassInput = z.infer<
  typeof ReconcileAndAdoptClassInputSchema
>
```

### 4.2 Atomic Execution (`src/features/ontology/server/actions/classes.ts`)

```typescript
export async function reconcileAndAdoptClass(
  rawInput: ReconcileAndAdoptClassInput
): Promise<{ classId: string; updatedRelations: number; deletedRelations: number }> {
  const input = ReconcileAndAdoptClassInputSchema.parse(rawInput)
  const db = getDb()
  await assertOntologyDocumentAccess(input.ontologyId, db)
  await assertOntologyRecordAccess("ontology_classes", input.classId, db)

  let updatedRelations = 0
  let deletedRelations = 0

  await db.transaction(async (tx) => {
    // 1. Transform class entity in-place
    const targetName = input.standardTerm.label || input.standardTerm.curie
    await tx
      .update(ontologyClasses)
      .set({
        name: targetName,
        ...(input.standardTerm.description ? { description: input.standardTerm.description } : {}),
      })
      .where(eq(ontologyClasses.id, input.classId))

    // 2. Prune unselected attributes
    const existingAttributes = await tx
      .select({ id: ontologyAttributes.id })
      .from(ontologyAttributes)
      .where(eq(ontologyAttributes.class_id, input.classId))

    const retainedSet = new Set(input.retainedAttributeIds)
    const attributesToDelete = existingAttributes
      .map((a) => a.id)
      .filter((id) => !retainedSet.has(id))

    if (attributesToDelete.length > 0) {
      await tx
        .delete(ontologyAttributes)
        .where(inArray(ontologyAttributes.id, attributesToDelete))
    }

    // 3. Process relation decisions
    for (const decision of input.relationDecisions) {
      if (decision.action === "delete") {
        await tx
          .delete(ontologyRelations)
          .where(eq(ontologyRelations.id, decision.relationId))
        deletedRelations++
      } else if (decision.action === "remap" && decision.remappedName) {
        await tx
          .update(ontologyRelations)
          .set({
            name: decision.remappedName,
            ...(decision.remappedDescription ? { description: decision.remappedDescription } : {}),
          })
          .where(eq(ontologyRelations.id, decision.relationId))
        updatedRelations++
      }
    }
  })

  revalidatePath(routes.ontology.document(input.ontologyId))
  revalidatePath(routes.ontology.root)

  return { classId: input.classId, updatedRelations, deletedRelations }
}
```

---

## 5. Relation Matching & AI Assistance Engine

### 5.1 Local Vector Pre-matching
The dialog runs `findNearestStandardTerms(relation.name, "property", 5)` using our normalized 384-d in-memory embedder for each connected relation.
- For each relation, candidate matches are loaded into the remapping selector.
- If a candidate has similarity $\ge 0.80$, it is surfaced as the recommended default for remapping.

### 5.2 On-Demand AI Suggestions (`suggestRelationRemappings`)
When the user clicks **"Enhance with AI"**:
- Invokes `suggestRelationRemappings`:
  ```typescript
  export type AiRelationSuggestion = {
    relationId: string
    suggestedAction: "keep" | "remap" | "delete"
    suggestedName?: string
    rationale: string
  }
  ```
- Constructs a prompt with:
  - Old class name and newly adopted standard term definition.
  - List of connected relations with domain, range, and direction.
  - Active reference vocabulary prefixes.
- Requests structured JSON suggestions with semantic rationales.
- Fills the modal controls and displays expandable "AI Rationale" badges.

---

## 6. UI Components & Interaction

### 6.1 `AdoptClassReconciliationDialog`
Location: `src/features/ontology/components/dialogs/adopt-class-reconciliation-dialog/adopt-class-reconciliation-dialog.tsx`

Sections:
1. **Header & Concept Diff:**
   - Pill: `[OldClass]` ➔ `[standardPrefix:Term]` with external IRI link.
   - Standard term description.
2. **Connected Relations Matrix:**
   - Table or structured list partitioned into:
     - **Outgoing Relations** (`[NewClass] --[pred]--> [Range]`)
     - **Incoming Relations** (`[Domain] --[pred]--> [NewClass]`)
   - Per row:
     - 3-state radio or select (`Keep`, `Remap to Standard`, `Delete`).
     - When `Remap` is selected: Combobox showing top 5 local vector matches + custom text input.
     - Optional AI rationale callout if AI suggestions were generated.
3. **Attributes Card:**
   - List of all class attributes with checkboxes (checked by default).
4. **Footer:**
   - Summary badge (e.g. `2 Kept, 1 Remapped, 1 Deleted`).
   - "Cancel" and "Confirm & Apply Refactoring" buttons.

### 6.2 `SemanticAlignmentsCard` Integration
In `src/features/ontology/components/shared/semantic-alignments-card/semantic-alignments-card.tsx`:
- Clicking **"Adopt Standard Term"** opens `AdoptClassReconciliationDialog` with the chosen candidate.
- Direct rename is removed in favor of the reconciliation flow.

---

## 7. Testing & Verification

1. **Schema Validation Tests:**
   - `ReconcileAndAdoptClassInputSchema` validates valid inputs and rejects invalid UUIDs/empty names.
2. **Action Tests:**
   - In-place renaming preserves `class.id`.
   - Unchecked attributes are pruned; checked attributes remain.
   - Remapped relations update `name`; kept relations remain unchanged; deleted relations are removed.
   - Empty connected relations (isolated class) refactors cleanly without error.
3. **UI & End-to-End Tests:**
   - TypeScript strict typecheck (`tsc --noEmit`).
   - ESLint zero warnings/errors.
