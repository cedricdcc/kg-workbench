# Tabular Entity-Relation Mapping Wizard, Persistent Archive & Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interactive Dataset Mapping Wizard with Gemini-powered schema synthesis, persistent PostgreSQL dataset archive catalog, and expand the left-hand workbench sidebar with dedicated Reasoner and Dataset Archive tabs.

**Architecture:** Extend Drizzle PostgreSQL schema with `dataset_sources` storing lightweight analytical profiles and top-20 sample rows. Implement server actions for archive management and Gemini-driven schema synthesis. Expand `EntityTypeTabs` in `LeftBrowserPanel` to 5 views (`Classes`, `Relations`, `Standards`, `Reasoner`, `Datasets`), querying the latest Reasoner status from `job_queue` on load. Build a 3-step `DatasetMappingModal` allowing users to map columns to ontology classes and review AI-synthesized candidate concepts before transactionally committing them to the ontology.

**Tech Stack:** Next.js 16 (App Router, Turbopack, Server Actions), TypeScript, Drizzle ORM (PostgreSQL), Gemini 2.5 Flash (`@google/genai` / REST API via existing provider), TanStack Query, shadcn/ui, Radix UI, Lucide icons.

**Spec:** [`docs/superpowers/specs/2026-11-05-tabular-mapping-archive-design.md`](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-11-05-tabular-mapping-archive-design.md)

## Global Constraints

- Retain App Router patterns and prefer Server Components by default; client components use TanStack Query.
- All colors and styling strictly use `src/app/globals.css` and `src/lib/colors.ts`.
- Strongly typed TypeScript throughout; zero `any` without explicit justification.
- Maintain a short `README.md` in `src/features/tabular/README.md`.
- Group isolation: All queries and mutations verify `getCurrentGroupKeyOrThrow()`.
- Windows environment: command execution via `cmd.exe /c "pnpm <cmd>"` and test runner with `--conditions=react-server`.

## Review Focus

1. **Unconfigured Gemini API Key**: `synthesizeOntologyMappingsAction` must return a clear user-facing error message prompting the user to configure their key in `/settings` when `getEffectiveApiKey("gemini")` returns null.
2. **Missing Primary Key Guard**: `DatasetMappingModal` must prevent committing if no unique/identifier column is selected for IRI generation.
3. **Duplicate Concept Collision**: When Gemini proposes new classes or attributes, synthesis must deduplicate names against existing ontology elements to prevent Drizzle uniqueness constraint violations.
4. **Cascading Deletion**: Deleting an ontology document must cleanly remove linked `dataset_sources` records via foreign key cascade.
5. **Wide Table Layout (>50 columns)**: Mapping table must provide horizontal and vertical virtualization/scroll boundaries without breaking the modal layout.

---

### Task 1: Database Schema & Dataset Sources Storage

**Files:**

- Modify: `src/server/db/schema.ts:320-360`
- Modify: `src/features/tabular/types.ts:1-50`
- Create: `src/features/tabular/server/actions/archive-dataset-source.ts`
- Create: `src/features/tabular/server/actions/delete-dataset-source.ts`
- Create: `src/features/tabular/server/queries/get-dataset-sources.ts`
- Test: `tests/dataset-sources-schema.test.ts`

**Interfaces:**

- Consumes: `ontologyDocuments` from `src/server/db/schema.ts`, `getCurrentGroupKeyOrThrow` from `src/server/group-access.ts`, `getDb` from `src/server/database.ts`.
- Produces: `datasetSources` table, `ArchivedDatasetSource`, `DatasetMappingSpec`, `archiveDatasetSourceAction`, `deleteDatasetSourceAction`, `getDatasetSourcesQuery`.

- [ ] **Step 1: Write the failing schema and storage test**

Create `tests/dataset-sources-schema.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("datasetSources table schema exposes expected columns and indexes", async () => {
  const { datasetSources } = await import("../src/server/db/schema")
  assert.ok(datasetSources.id)
  assert.ok(datasetSources.ontology_id)
  assert.ok(datasetSources.group_key)
  assert.ok(datasetSources.source_name)
  assert.ok(datasetSources.file_format)
  assert.ok(datasetSources.row_count)
  assert.ok(datasetSources.column_count)
  assert.ok(datasetSources.profile_summary)
  assert.ok(datasetSources.sample_rows)
  assert.ok(datasetSources.mapping_spec)
  assert.ok(datasetSources.created_at)
  assert.ok(datasetSources.updated_at)
})

test("archiveDatasetSourceAction rejects missing source name or ontology id", async () => {
  const { archiveDatasetSourceAction } =
    await import("../src/features/tabular/server/actions/archive-dataset-source")
  await assert.rejects(
    () =>
      archiveDatasetSourceAction({
        ontologyId: "",
        sourceName: "test.csv",
        fileFormat: "csv",
        rowCount: 10,
        columnCount: 2,
        profileSummary: {
          rowCount: 10,
          columnCount: 2,
          candidateKeys: [],
          columns: [],
        },
        sampleRows: [],
      }),
    /ontologyId is required/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/dataset-sources-schema.test.ts"`  
Expected: FAIL with missing exports or schema properties.

- [ ] **Step 3: Implement `datasetSources` schema, domain types, actions, and queries**

1. In `src/server/db/schema.ts`, define `datasetSources` with indexes on `ontology_id` and `group_key` with cascade on delete.
2. In `src/features/tabular/types.ts`, define `DatasetColumnMapping`, `DatasetMappingSpec`, and `ArchivedDatasetSource`.
3. In `src/features/tabular/server/actions/archive-dataset-source.ts`, implement `archiveDatasetSourceAction`.
4. In `src/features/tabular/server/actions/delete-dataset-source.ts`, implement `deleteDatasetSourceAction`.
5. In `src/features/tabular/server/queries/get-dataset-sources.ts`, implement `getDatasetSourcesQuery`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/dataset-sources-schema.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/features/tabular/types.ts src/features/tabular/server/ tests/dataset-sources-schema.test.ts
git commit -m "feat(tabular): add datasetSources table and archive storage actions"
```

---

### Task 2: AI Schema Synthesis & Mapping Service

**Files:**

- Create: `src/features/tabular/server/services/ai-mapping-prompt.ts`
- Create: `src/features/tabular/server/actions/synthesize-mappings.ts`
- Create: `src/features/tabular/server/actions/commit-dataset-mapping.ts`
- Test: `tests/ai-mapping-prompt.test.ts`
- Test: `tests/commit-dataset-mapping.test.ts`

**Interfaces:**

- Consumes: `getEffectiveApiKey` from `src/server/api-keys.ts`, `datasetSources` from `src/server/db/schema.ts`, `ontologyClasses`, `ontologyRelations`, `ontologyClassAttributes`.
- Produces: `synthesizeOntologyMappingsAction(input: SynthesizeMappingsInput): Promise<SynthesizeMappingsResult>`, `commitDatasetMappingAction(input: CommitDatasetMappingInput): Promise<{ ok: boolean }>`.

- [ ] **Step 1: Write the failing tests for AI mapping prompt and commit action**

Create `tests/ai-mapping-prompt.test.ts`:

````typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildAiMappingPrompt,
  parseAiMappingResponse,
} from "../src/features/tabular/server/services/ai-mapping-prompt"

test("buildAiMappingPrompt constructs structured prompt with profile, ontology, and archive context", () => {
  const prompt = buildAiMappingPrompt({
    sourceName: "customers.csv",
    profile: {
      rowCount: 100,
      columnCount: 3,
      candidateKeys: [["customer_id"]],
      columns: [
        {
          name: "customer_id",
          inferredType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 100,
          isCandidateKey: true,
          sampleValues: ["C01"],
        },
        {
          name: "email",
          inferredType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 100,
          isCandidateKey: true,
          sampleValues: ["a@b.com"],
        },
        {
          name: "spend",
          inferredType: "number",
          nullCount: 5,
          nullPercentage: 5,
          distinctCount: 40,
          isCandidateKey: false,
          sampleValues: [120.5],
        },
      ],
    },
    sampleRows: [{ customer_id: "C01", email: "a@b.com", spend: 120.5 }],
    existingClasses: [
      {
        id: "c1",
        name: "User",
        attributes: [{ name: "emailAddress", dataType: "xsd:string" }],
      },
    ],
    existingRelations: [],
    historicalArchiveSummary: [
      { sourceName: "orders.csv", mappedClassName: "Order" },
    ],
  })

  assert.ok(prompt.systemPrompt.includes("Knowledge Graph"))
  assert.ok(prompt.userPrompt.includes("customers.csv"))
  assert.ok(prompt.userPrompt.includes("customer_id"))
})

test("parseAiMappingResponse extracts valid mapping spec and handles fences", () => {
  const raw =
    '```json\n{"targetClassName":"Customer","primaryKeyColumn":"customer_id","columnMappings":[{"columnName":"customer_id","inferredType":"string","targetKind":"attribute","targetAttributeName":"customerId","targetDataType":"xsd:string","isPrimaryKey":true}],"synthesizedElements":{"classes":[{"name":"Customer"}],"attributes":[],"relations":[]}}\n```'
  const parsed = parseAiMappingResponse(raw)
  assert.equal(parsed.targetClassName, "Customer")
  assert.equal(parsed.primaryKeyColumn, "customer_id")
  assert.equal(parsed.columnMappings.length, 1)
})
````

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/ai-mapping-prompt.test.ts"`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement prompt generator, Gemini dispatcher, and transactional commit action**

1. In `src/features/tabular/server/services/ai-mapping-prompt.ts`:
   - Construct Gemini system instructions requiring strict JSON output conforming to `DatasetMappingSpec`.
   - Implement `parseAiMappingResponse` using `sanitizeAiJsonResponse`.
2. In `src/features/tabular/server/actions/synthesize-mappings.ts`:
   - Query `getEffectiveApiKey("gemini")`. Throw descriptive error if absent.
   - Fetch active ontology classes/relations and the last 5 mapped dataset sources.
   - Dispatch to Gemini `models/gemini-2.5-flash:generateContent`.
3. In `src/features/tabular/server/actions/commit-dataset-mapping.ts`:
   - Start transaction via `db.transaction()`.
   - If `synthesizedElements.classes` present, insert missing classes (deduplicating against existing names).
   - If `synthesizedElements.attributes` present, insert class attributes.
   - If `synthesizedElements.relations` present, insert relations.
   - Update `mapping_spec` on `dataset_sources`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/ai-mapping-prompt.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/server/ tests/ai-mapping-prompt.test.ts
git commit -m "feat(tabular): add AI schema synthesis prompt service and commit action"
```

---

### Task 3: Reasoner Browser Left Sidebar Panel

**Files:**

- Create: `src/features/tabular/server/queries/get-latest-reasoner-run.ts`
- Create: `src/features/ontology/components/reasoner-browser/reasoner-browser.tsx`
- Create: `src/features/ontology/components/reasoner-browser/reasoner-violation-item.tsx`
- Create: `src/features/ontology/components/reasoner-browser/types.ts`
- Test: `tests/reasoner-browser.test.ts`

**Interfaces:**

- Consumes: `jobQueue` from `src/server/db/schema.ts`, `useReasonerJob` from `src/features/ontology/hooks/use-reasoner-job.ts`.
- Produces: `getLatestReasonerRunQuery(ontologyId: string)`, `ReasonerBrowser` component.

- [ ] **Step 1: Write the failing test for latest reasoner run query and component structure**

Create `tests/reasoner-browser.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("getLatestReasonerRunQuery returns null or valid reasoner job payload", async () => {
  const { getLatestReasonerRunQuery } =
    await import("../src/features/tabular/server/queries/get-latest-reasoner-run")
  const result = await getLatestReasonerRunQuery(
    "00000000-0000-0000-0000-000000000000"
  )
  assert.equal(result, null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/reasoner-browser.test.ts"`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `getLatestReasonerRunQuery` and `ReasonerBrowser`**

1. In `src/features/tabular/server/queries/get-latest-reasoner-run.ts`, query `jobQueue` where `worker_type = 'reasoner'`, `target_id = ontologyId`, and `status = 'completed'`, ordered by `created_at desc` limit 1. Parse `result_payload`.
2. In `src/features/ontology/components/reasoner-browser/`:
   - Implement `ReasonerBrowser`:
     - Consistency status banner (Green "Ontology Consistent", Amber "Violations Detected (N)", or Gray "Not Validated").
     - "Run Reasoner" action button using `useReasonerJob` (with active spinner when running).
     - Violations list using `reasoner-violation-item.tsx`, calling `onSelectClass` when clicked.
     - Collapsible Inferred Triples (entailments) accordion showing inferred `SubClassOf` or `type` triples.
     - "View Full Report" button invoking `onOpenFullReport`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/reasoner-browser.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/server/queries/get-latest-reasoner-run.ts src/features/ontology/components/reasoner-browser/ tests/reasoner-browser.test.ts
git commit -m "feat(ontology): add ReasonerBrowser sidebar panel and query"
```

---

### Task 4: Dataset Archive Browser Left Sidebar Panel

**Files:**

- Create: `src/features/tabular/components/dataset-archive-browser/dataset-archive-browser.tsx`
- Create: `src/features/tabular/components/dataset-archive-browser/dataset-archive-card.tsx`
- Create: `src/features/tabular/components/dataset-archive-browser/types.ts`
- Test: `tests/dataset-archive-browser.test.ts`

**Interfaces:**

- Consumes: `ArchivedDatasetSource` from `src/features/tabular/types.ts`, `getDatasetSourcesQuery`.
- Produces: `DatasetArchiveBrowser` component.

- [ ] **Step 1: Write the failing test for DatasetArchiveBrowser component rendering**

Create `tests/dataset-archive-browser.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { formatDatasetFormatBadge } from "../src/features/tabular/components/dataset-archive-browser/types"

test("formatDatasetFormatBadge maps file formats to label and color classes", () => {
  const csv = formatDatasetFormatBadge("csv")
  assert.equal(csv.label, "CSV")
  const parquet = formatDatasetFormatBadge("parquet")
  assert.equal(parquet.label, "PARQUET")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/dataset-archive-browser.test.ts"`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `DatasetArchiveBrowser` and `DatasetArchiveCard`**

1. In `src/features/tabular/components/dataset-archive-browser/types.ts`: Define badge formatters and filter helpers.
2. In `dataset-archive-card.tsx`:
   - Render file format pill (`CSV`, `PARQUET`, `EXCEL`), row/column badges, creation date.
   - Render status pill: Green "Mapped" or Slate "Unmapped".
   - Actions: "Inspect Profile", "Map to KG", "Delete".
3. In `dataset-archive-browser.tsx`:
   - Search bar filtering dataset sources by name.
   - Primary "Archive New Dataset" button triggering file input.
   - Card list rendering mapped/unmapped dataset sources.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/dataset-archive-browser.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/components/dataset-archive-browser/ tests/dataset-archive-browser.test.ts
git commit -m "feat(tabular): add DatasetArchiveBrowser sidebar panel"
```

---

### Task 5: Left Sidebar 5-Tab Navigation Integration

**Files:**

- Modify: `src/features/ontology/components/entity-type-tabs.tsx:1-71`
- Modify: `src/features/ontology/components/ontology-shell/left-browser-panel.tsx:1-50`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx:550-680`
- Modify: `src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx:1-190`
- Test: `tests/entity-type-tabs.test.ts`

**Interfaces:**

- Consumes: `ReasonerBrowser`, `DatasetArchiveBrowser`, `archiveDatasetSourceAction`.
- Produces: 5-tab responsive switcher in `LeftBrowserPanel`.

- [ ] **Step 1: Write the failing test for 5-tab EntityTypeTabs**

Create `tests/entity-type-tabs.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import type { EntityType } from "../src/features/ontology/components/entity-type-tabs"

test("EntityType union includes reasoner and datasets", () => {
  const validTypes: EntityType[] = [
    "classes",
    "relations",
    "standards",
    "reasoner",
    "datasets",
  ]
  assert.equal(validTypes.length, 5)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/entity-type-tabs.test.ts"`  
Expected: FAIL (TypeScript type error: Type '"reasoner"' is not assignable to type 'EntityType').

- [ ] **Step 3: Update `EntityTypeTabs`, `LeftBrowserPanel`, and `OntologyShell`**

1. In `entity-type-tabs.tsx`:
   - Expand `export type EntityType = "classes" | "relations" | "standards" | "reasoner" | "datasets"`
   - Update `TabsList` to a 5-column responsive grid with text and icons:
     `Classes (N)`, `Relations (N)`, `Standards (N)`, `Reasoner`, `Datasets (N)`.
   - Add `TabsContent` for `reasoner` and `datasets`.
2. In `left-browser-panel.tsx`:
   - Accept `reasonerBrowser?: ReactNode` and `datasetBrowser?: ReactNode` and forward to `EntityTypeTabs`.
3. In `ontology-shell.tsx`:
   - Wire initial reasoner run status and `archivedDatasets` state.
   - Render `ReasonerBrowser` and `DatasetArchiveBrowser` into `LeftBrowserPanel`.
4. In `tabular-profiler-modal.tsx`:
   - Add "Save to Archive" button that calls `archiveDatasetSourceAction` and displays a toast on success.
   - Add "Map to KG" button that triggers `onOpenMappingWizard(profile)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/entity-type-tabs.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/components/entity-type-tabs.tsx src/features/ontology/components/ontology-shell/ src/features/tabular/components/tabular-profiler-modal/ tests/entity-type-tabs.test.ts
git commit -m "feat(ontology): integrate 5-tab sidebar with Reasoner and Dataset Archive"
```

---

### Task 6: Interactive Dataset Mapping Wizard

**Files:**

- Create: `src/features/tabular/components/dataset-mapping-wizard/types.ts`
- Create: `src/features/tabular/components/dataset-mapping-wizard/step-entity-selection.tsx`
- Create: `src/features/tabular/components/dataset-mapping-wizard/step-attribute-mapping.tsx`
- Create: `src/features/tabular/components/dataset-mapping-wizard/step-ai-synthesis-review.tsx`
- Create: `src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx`
- Test: `tests/dataset-mapping-wizard-dom.test.ts`

**Interfaces:**

- Consumes: `synthesizeOntologyMappingsAction`, `commitDatasetMappingAction`, `TabularProfileSummary`.
- Produces: `DatasetMappingModal` component.

- [ ] **Step 1: Write the failing DOM test for DatasetMappingModal structure**

Create `tests/dataset-mapping-wizard-dom.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { validateMappingSpecBeforeCommit } from "../src/features/tabular/components/dataset-mapping-wizard/types"

test("validateMappingSpecBeforeCommit rejects missing primary key column", () => {
  const result = validateMappingSpecBeforeCommit({
    targetClassName: "Customer",
    primaryKeyColumn: "",
    columnMappings: [],
  })
  assert.equal(result.isValid, false)
  assert.ok(result.error?.includes("Primary key"))
})

test("validateMappingSpecBeforeCommit accepts valid mapping spec", () => {
  const result = validateMappingSpecBeforeCommit({
    targetClassName: "Customer",
    primaryKeyColumn: "customer_id",
    columnMappings: [
      {
        columnName: "customer_id",
        inferredType: "string",
        targetKind: "attribute",
        isPrimaryKey: true,
      },
    ],
  })
  assert.equal(result.isValid, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/dataset-mapping-wizard-dom.test.ts"`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `DatasetMappingModal` and multi-step wizard**

1. In `types.ts`: Define wizard state, step enums, and validation helper `validateMappingSpecBeforeCommit`.
2. In `step-entity-selection.tsx`:
   - Target class selector: select an existing ontology class or enter a new class name.
   - Primary key selector: dropdown populated with DuckDB candidate keys (with green **Unique** badge).
3. In `step-attribute-mapping.tsx`:
   - Column grid with inferred type icon, target kind (`attribute`, `relation`, `ignore`), target property name, and target data type dropdown (`xsd:string`, `xsd:integer`, `xsd:decimal`, `xsd:boolean`, `xsd:date`).
   - "Auto-Suggest with AI" button that calls `synthesizeOntologyMappingsAction` with live loading spinner.
4. In `step-ai-synthesis-review.tsx`:
   - Review card showing newly proposed classes, attributes, and relations with diff tags.
5. In `dataset-mapping-modal.tsx`:
   - Radix `Dialog` wrapper with 3-step breadcrumb progress header (`1. Entity & ID`, `2. Columns & Relations`, `3. Review & Apply`).
   - "Commit & Apply" button invoking `commitDatasetMappingAction`.
   - On success: toast notification, close modal, and refresh ontology canvas.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/dataset-mapping-wizard-dom.test.ts"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/components/dataset-mapping-wizard/ tests/dataset-mapping-wizard-dom.test.ts
git commit -m "feat(tabular): add interactive DatasetMappingModal with AI synthesis review"
```

---

### Task 7: End-to-End Smoke Verification & Documentation

**Files:**

- Create: `tests/tabular-mapping-e2e-smoke.test.ts`
- Modify: `src/features/tabular/README.md`

**Interfaces:**

- Consumes: Running PostgreSQL database and all Task 1-6 exports.
- Produces: Verified end-to-end flow and updated architecture docs.

- [ ] **Step 1: Write the live e2e smoke test**

Create `tests/tabular-mapping-e2e-smoke.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("e2e tabular archive, AI mapping synthesis, and commit lifecycle", async () => {
  const { archiveDatasetSourceAction } =
    await import("../src/features/tabular/server/actions/archive-dataset-source")
  const { getDatasetSourcesQuery } =
    await import("../src/features/tabular/server/queries/get-dataset-sources")
  const { deleteDatasetSourceAction } =
    await import("../src/features/tabular/server/actions/delete-dataset-source")
  const { getDb } = await import("../src/server/database")
  const { ontologyDocuments } = await import("../src/server/db/schema")

  const db = getDb()
  const [doc] = await db
    .insert(ontologyDocuments)
    .values({ name: "E2E Tabular Mapping Test", group_key: "shared" })
    .returning()

  assert.ok(doc)

  try {
    const archived = await archiveDatasetSourceAction({
      ontologyId: doc.id,
      sourceName: "test-customers.csv",
      fileFormat: "csv",
      rowCount: 50,
      columnCount: 3,
      profileSummary: {
        rowCount: 50,
        columnCount: 3,
        candidateKeys: [["customer_id"]],
        columns: [
          {
            name: "customer_id",
            inferredType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 50,
            isCandidateKey: true,
            sampleValues: ["C1"],
          },
          {
            name: "name",
            inferredType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 45,
            isCandidateKey: false,
            sampleValues: ["Alice"],
          },
          {
            name: "active",
            inferredType: "boolean",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 2,
            isCandidateKey: false,
            sampleValues: [true],
          },
        ],
      },
      sampleRows: [{ customer_id: "C1", name: "Alice", active: true }],
    })

    assert.ok(archived.id)

    const sources = await getDatasetSourcesQuery(doc.id)
    assert.equal(sources.length, 1)
    assert.equal(sources[0].sourceName, "test-customers.csv")

    await deleteDatasetSourceAction(archived.id)
    const afterDelete = await getDatasetSourcesQuery(doc.id)
    assert.equal(afterDelete.length, 0)
  } finally {
    const { eq } = await import("drizzle-orm")
    await db.delete(ontologyDocuments).where(eq(ontologyDocuments.id, doc.id))
  }
})
```

- [ ] **Step 2: Run the e2e smoke test**

Run: `cmd.exe /c "pnpm exec tsx --conditions=react-server --test tests/tabular-mapping-e2e-smoke.test.ts"`  
Expected: PASS

- [ ] **Step 3: Update `src/features/tabular/README.md` and run project check suite**

1. Update `src/features/tabular/README.md` documenting `DatasetMappingModal`, `DatasetArchiveBrowser`, and `dataset_sources` table.
2. Run full lint, typecheck, and test suite:
   `cmd.exe /c "pnpm lint && pnpm typecheck && pnpm test"`

- [ ] **Step 4: Commit**

```bash
git add tests/tabular-mapping-e2e-smoke.test.ts src/features/tabular/README.md
git commit -m "docs(tabular): update architecture readme and add e2e mapping smoke test"
```
