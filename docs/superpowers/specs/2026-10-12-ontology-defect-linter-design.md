# Ontology Defect Linter & Structural Verification Design Spec

**Date:** 2026-10-12  
**Status:** In Review  
**Topic:** Pre-flight static analysis, defect detection, and quality linting for ontologies in KG Workbench, adopted from `open-ontologies`.

---

## 1. Problem Statement & Motivation

In knowledge graph and ontology modeling, subtle structural errors are frequently introduced during manual editing, JSON/OWL import, or AI draft generation:
- **Circular subclass hierarchies** ($A \sqsubseteq B \sqsubseteq A$) make all participating classes logically equivalent, destroying the taxonomic hierarchy.
- **Dangling relations** point to class IDs that were deleted or never declared, resulting in broken graph edges and corrupted exports.
- **Orphan classes** sit disconnected from the hierarchy and relation graph with zero semantic connectivity.
- **Near-duplicate terms and naming anomalies** (e.g. `PatientRecord` vs `patient_record` vs `PatientRecord_`) create duplicate, competing concepts that degrade downstream reasoning and entity extraction.
- **Competing modeling patterns** (e.g. an attribute class `DeviceType` co-existing alongside a subclass partition of `Device`) silently disable contradiction detection in downstream extractors.
- **Inverse relation inconsistencies** declare an inverse name on a relation without a matching reverse relation edge.

In `open-ontologies` (`C:\Users\cedricd\Documents\Github\open-ontologies`), these traps are addressed through dedicated static defect checkers (`src/defects.rs`, `src/enforce.rs`, and `src/feedback.rs`).

This specification defines the adoption of this defect linter into `kg-workbench`, providing:
1. A **pure, zero-dependency TypeScript validation engine** running with 0ms latency in the client and shared with server pipelines.
2. A **compact, real-time status pill** in the workbench header that updates as the user edits.
3. An **interactive slide-over defects panel** with jump-to-entity navigation, one-click quick fixes, and rule suppression.
4. **Contextual indicators** in class/relation detail views and canvas node headers.
5. **Server-side guardrails** to protect AI draft generation (`generate-ontology.ts`) and JSON/OWL imports.

---

## 2. Goals & Non-Goals

### Goals
- **Hybrid Universal Engine:** Pure TypeScript implementation (`src/features/ontology/utils/linter/`) executable on both client (reactive `useMemo`) and server (server actions, import/export).
- **Comprehensive Defect Suite:** Decides errors (cycles, dangling edges), warnings (orphans, near-duplicates, competing patterns, inverse anomalies), and info (missing descriptions, empty classes) from declarations alone without requiring external reasoners or JVMs.
- **Sub-5ms Execution Time:** High performance on ontologies with hundreds of classes and relations using adjacency lists and token indexing.
- **Interactive Workbench UI:**
  - Compact status pill in `OntologyHeader` showing current health state (`Clean`, `Errors`, `Warnings`).
  - Slide-over sheet (`OntologyDefectsSheet`) with severity filters, plain-English explanations, jump-to-entity selection, and quick-fix buttons.
  - Detail panel alert banners in `ClassDetail` and `RelationDetail` for currently selected entities.
  - Subtle visual canvas node indicators on offending nodes.
- **Self-Calibrating Suppression (Feedback Loop):** Allow users to dismiss/ignore specific rules for intentional modeling decisions, persisted per ontology document.
- **AI Generation & Import Guardrails:** Automatically detect and auto-correct or flag defects in AI-generated drafts and imported files before committing to PostgreSQL.

### Non-Goals
- Full Description Logic ($\mathcal{SROIQ}$) tableaux satisfiability reasoning with finite model construction (planned for a future phase).
- Remote network calls or external validator dependencies during linting.

---

## 3. Defect Classification & Severity Matrix

Defects are categorized into three severity levels:

| Severity | Definition | User Impact |
| :--- | :--- | :--- |
| **`error`** | Logical traps or broken references. Must be resolved. | Destroys class hierarchy, breaks exports, or references non-existent entities. |
| **`warning`** | Smells, anomalies, or traps that manufacture issues once data arrives. | Near-duplicates, orphan classes, competing patterns, or asymmetric inverses. |
| **`info`** | Documentation completeness and hygiene. | Empty descriptions or classes without attributes/relations. |

### Rule Registry

| Kind | Severity | Description & Rationale | Target Type | Quick Fix Available |
| :--- | :--- | :--- | :--- | :--- |
| `subclass_cycle` | `error` | Subclass chain contains a cycle ($A \sqsubseteq \dots \sqsubseteq A$). Classes on a cycle are all equivalent, which is almost never intentional. | `class` | Clear parent link on the offending class. |
| `dangling_relation_domain` | `error` | Relation specifies a `domain_class_id` that does not exist in the active ontology. | `relation` | Delete relation or re-assign domain. |
| `dangling_relation_range` | `error` | Relation specifies a `range_class_id` that does not exist in the active ontology. | `relation` | Delete relation or re-assign range. |
| `orphan_class` | `warning` | Class has no parent, no subclasses, and no incoming or outgoing relations. Isolated from the graph. | `class` | Delete class or assign a parent/relation. |
| `near_duplicate_class` | `warning` | Two classes have normalized names that match or differ only by case, underscores, or minor symbols (e.g. `Patient_` vs `Patient`). | `class` | Jump to entities to review or merge. |
| `near_duplicate_relation` | `warning` | Two relations have normalized names that match or differ only by case or delimiters (e.g. `hasPart` vs `has_part`). | `relation` | Jump to entities to review. |
| `competing_modelling_pattern` | `warning` | An attribute class (e.g. `XType`, `XCategory`, `XKind`) co-exists alongside a parent `X` that already has two or more subclasses. Disjointness cannot reach the attribute class, silently disabling contradiction detection. | `class` | Review pattern; merge into subclass partition. |
| `inverse_inconsistent` | `warning` | Relation declares `inverse_name`, but either no counterpart relation exists or the counterpart does not point back from range to domain. | `relation` | Generate missing reverse relation. |
| `missing_description` | `info` | Class or relation has an empty description. | `class` / `relation` | Focus description input in detail panel. |
| `class_without_attributes` | `info` | Class has no attributes and no outgoing relations. | `class` | Open add attribute dialog. |

---

## 4. Architecture & Data Structures

```
                 Ontology State (classes, relations, attributes)
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │        runOntologyLinter()           │
                   │   src/features/ontology/utils/       │
                   │             linter/                  │
                   └──────────────────────────────────────┘
                                      │
                 ┌────────────────────┴───────────────────┐
                 ▼                                        ▼
   Client-Side Execution (React)             Server-Side Pipelines (Next.js)
   - OntologyShell (useMemo)                 - generate-ontology.ts (AI guardrail)
   - OntologyHeader (Health Pill)            - importOntologyFromJson (Pre-flight check)
   - OntologyDefectsSheet (Drawer)           - buildOwlOntologyPayload (Export check)
   - ClassDetail / RelationDetail
   - React Flow Node Badges
```

### TypeScript Data Model (`src/features/ontology/utils/linter/types.ts`)

```typescript
export type OntologyDefectSeverity = "error" | "warning" | "info"

export type OntologyDefectKind =
  | "subclass_cycle"
  | "dangling_relation_domain"
  | "dangling_relation_range"
  | "orphan_class"
  | "near_duplicate_class"
  | "near_duplicate_relation"
  | "competing_modelling_pattern"
  | "inverse_inconsistent"
  | "missing_description"
  | "class_without_attributes"

export interface OntologyDefect {
  id: string
  kind: OntologyDefectKind
  severity: OntologyDefectSeverity
  targetType: "class" | "relation"
  targetId: string
  targetName: string
  title: string
  description: string
  suggestedAction?: string
}

export interface OntologyDefectReport {
  total: number
  counts: {
    error: number
    warning: number
    info: number
  }
  defects: OntologyDefect[]
  defectsByTargetId: Record<string, OntologyDefect[]>
  hasErrors: boolean
  hasWarnings: boolean
}
```

---

## 5. Pure Rule Engine Implementation

The engine operates on in-memory collections of `OntologyClassWithAttributes` and `OntologyRelation`.

### 5.1 Subclass Cycle Detection
- Construct an adjacency map `parentMap: Map<string, string>` from `class.id` $\rightarrow$ `class.parent_class_id`.
- For each class, traverse ancestor chains with a visited set and a current path stack.
- If an ancestor matches a node currently on the stack, flag a `subclass_cycle` defect on all nodes in the cycle.
- Handles both self-loops ($A \rightarrow A$) and complex cycles ($A \rightarrow B \rightarrow C \rightarrow A$).

### 5.2 Dangling Relation Detection
- Build a `classIdSet = new Set(classes.map(c => c.id))`.
- For every relation:
  - If `!classIdSet.has(relation.domain_class_id)`, emit `dangling_relation_domain`.
  - If `!classIdSet.has(relation.range_class_id)`, emit `dangling_relation_range`.

### 5.3 Orphan Class Detection
- Track classes that:
  - Have `parent_class_id == null`.
  - Have no other class in `classes` with `parent_class_id === class.id`.
  - Are never referenced as `domain_class_id` or `range_class_id` in `relations`.
- Emit `orphan_class`.

### 5.4 Near-Duplicate Detection
- Normalize entity names:
  ```typescript
  function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "")
  }
  ```
- Group classes and relations by normalized name.
- If multiple entities map to the same normalized key with distinct IDs, emit `near_duplicate_class` or `near_duplicate_relation`.

### 5.5 Competing Modelling Patterns
- Identify classes with 2+ subclasses.
- Check if any class in the ontology has a name matching `${parent.name}Type`, `${parent.name}Kind`, `${parent.name}Category`, `${parent.name}Mode`, or `${parent.name}Variant`.
- If found, emit `competing_modelling_pattern`.

### 5.6 Inverse Relation Checks
- If a relation has `inverse_name`, check if there exists another relation with `name === relation.inverse_name` where `domain_class_id === relation.range_class_id` and `range_class_id === relation.domain_class_id`.
- If missing, emit `inverse_inconsistent`.

---

## 6. UI Components & Shell Integration

### 6.1 Status Pill in `OntologyHeader` (`ontology-defects-pill.tsx`)
Located in the header toolbar beside the Visual Toggle and Settings button:
- **Clean State:** `<Button variant="ghost" size="sm" className="text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20"><CheckCircle2 className="size-3.5 mr-1" /> Clean</Button>`
- **Errors State:** `<Button variant="ghost" size="sm" className="text-destructive bg-destructive/10 hover:bg-destructive/20"><AlertCircle className="size-3.5 mr-1" /> {errors} Errors · {warnings} Warnings</Button>`
- **Warnings State:** `<Button variant="ghost" size="sm" className="text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"><AlertTriangle className="size-3.5 mr-1" /> {warnings} Warnings</Button>`
- Clicking toggles the `OntologyDefectsSheet`.

### 6.2 Interactive Defects Drawer (`ontology-defects-sheet.tsx`)
A slide-over sheet (using shadcn `Sheet` / `SheetContent`):
- **Header:** Title, total count badge, and a filter row (`All (${total})`, `Errors (${errors})`, `Warnings (${warnings})`, `Info (${info})`, `Suppressed (${suppressed})`).
- **Defect Card:**
  - Icon and severity badge (`Error` in red, `Warning` in amber, `Info` in blue).
  - Target badge: `Class: <name>` or `Relation: <name>`.
  - Explanation card with problem statement and suggested action.
  - Action buttons:
    - **"View Entity":** Calls `onSelectEntity(targetId, targetType)` to focus the entity in the browser, center it on the canvas, and open its detail panel.
    - **"Quick Fix" (when applicable):** e.g. "Clear Parent" or "Delete Dangling Relation".
    - **"Suppress":** Adds defect ID to suppression list.

### 6.3 In-Editor Callouts
- **`ClassDetail` & `RelationDetail`:**
  - Query `defectsByTargetId[entityId]`.
  - If defects exist, render an alert banner at the top of the detail panel with the severity, title, and quick-fix button.
- **Canvas Nodes (`OntologyNode`):**
  - If a node's ID exists in `defectsByTargetId` with an error, display an error badge in the node header.

---

## 7. Suppression Persistence & Feedback Loop

To support deliberate domain modeling choices without alert fatigue:
- Store suppressed defect IDs in a new PostgreSQL table or json column:
  ```typescript
  export const ontologyDefectSuppressions = pgTable("ontology_defect_suppressions", {
    id: generatedId(),
    ontology_id: uuid("ontology_id").notNull(),
    defect_id: text("defect_id").notNull(),
    created_at: created_at().notNull(),
  })
  ```
- In `OntologyShell`, keep `suppressedDefectIds: Set<string>`.
- The linter filters out suppressed defects from the primary count while retaining them in the "Suppressed" tab of the sheet.
- A "Restore" button allows un-suppressing any rule at any time.

---

## 8. Server Actions & Pipeline Integration

### 8.1 AI Draft Generation Guardrail (`generate-ontology.ts`)
- In `generateOntologyDraft`, after the LLM produces candidate classes and relations:
  1. Construct an in-memory draft set.
  2. Run `runOntologyLinter(draft)`.
  3. If cycles are found, automatically clear the cyclic `parent_class_id`.
  4. If dangling relation references are found, filter them out before saving.
  5. Log auto-corrections so the user is informed of adjustments.

### 8.2 JSON / OWL Import Validation
- In `importOntologyFromJson` and OWL import actions:
  - Run `runOntologyLinter` on the parsed document.
  - If fatal errors exist, include a diagnostic summary in the import result toast.

### 8.3 OWL Export Guard
- In `buildOwlOntologyPayload`:
  - Run `runOntologyLinter`.
  - If fatal subclass cycles or dangling relations are present, warn the user in the Export dialog before generating invalid OWL.

---

## 9. Testing & Verification Plan

1. **Unit Tests (`tests/ontology-linter.test.ts`):**
   - Test `checkSubclassCycles` with self-loops ($A \rightarrow A$), 2-step cycles ($A \rightarrow B \rightarrow A$), and multi-step cycles ($A \rightarrow B \rightarrow C \rightarrow A$).
   - Test `checkDanglingRelations` with valid and non-existent domain/range IDs.
   - Test `checkOrphanClasses` with connected vs disconnected nodes.
   - Test `checkNearDuplicates` with casing and punctuation variations (`Patient_Record`, `patient_record`).
   - Test `checkCompetingModellingPatterns` with suffix variants (`VehicleType`).
   - Test `checkInverseRelations` with valid, missing, and misaligned inverses.
2. **Integration Tests (`tests/linter-ui-integration.test.ts`):**
   - Verify `OntologyShell` computes `defectReport` correctly.
   - Verify clicking "View Entity" triggers entity selection and navigation.
   - Verify suppressing and restoring defects updates the counts reactively.
3. **AI Generation Guardrail Tests (`tests/ai-linter-guardrail.test.ts`):**
   - Simulate an LLM payload with a circular hierarchy and verify that `generate-ontology.ts` auto-heals the cycle before persistence.

---

## 10. Implementation Decomposition & Step List

- **Step 1: Core Engine (`src/features/ontology/utils/linter/`)**
  - Implement `types.ts`, `rules.ts`, and `index.ts`.
  - Comprehensive unit test suite in `tests/ontology-linter.test.ts`.
- **Step 2: Database Schema & Server Action for Suppressions**
  - Add `ontologyDefectSuppressions` table in `src/server/db/schema.ts` and migrations.
  - Add query `getDefectSuppressions` and action `toggleDefectSuppression`.
- **Step 3: UI Components**
  - Build `OntologyDefectsPill` in `src/features/ontology/components/ontology-header/`.
  - Build `OntologyDefectsSheet` in `src/features/ontology/components/ontology-defects/`.
  - Integrate banner in `ClassDetail` and `RelationDetail`.
- **Step 4: Shell Integration**
  - Connect reactive linter in `OntologyShell`.
  - Wire up navigation and selection.
- **Step 5: Pipeline Guardrails**
  - Add validation and auto-healing in `generate-ontology.ts` and import/export actions.
- **Step 6: End-to-end verification and lint.**
