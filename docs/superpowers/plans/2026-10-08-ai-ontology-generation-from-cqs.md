# AI Ontology Generation from Competency Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an automated, low-cost AI pipeline that analyzes all Competency Questions in an ontology to draft modules, classes, attributes, relations, and CQ linkages, with a preview/review modal before committing to the database.

**Architecture:** A dual-provider adapter (Google Gemini 2.0 Flash via REST as cheap default; local Ollama via REST as $0 offline alternative) generates structured JSON validated by Zod schemas. A staged review dialog lets users inspect and toggle items, and an atomic server action persists entities into PostgreSQL and auto-links the CQs.

**Tech Stack:** Next.js App Router (Server Actions), PostgreSQL / Drizzle ORM, Zod, TanStack Query, shadcn/ui, Tailwind CSS, Google Gemini REST API / Ollama REST API.

**Spec:** [docs/superpowers/specs/2026-10-08-ai-ontology-generation-from-cqs-design.md](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-10-08-ai-ontology-generation-from-cqs-design.md)

## Global Constraints

- Use `pnpm` exclusively via `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- <command>` on Windows.
- Always enforce access boundaries via `assertOntologyDocumentAccess(ontologyId)` in server actions.
- Client components must stay minimal; server actions handle all external AI calls and transactions.
- Zero extra SDK bloat: communicate with Gemini REST and Ollama REST using standard `fetch`.
- Invalidate TanStack Query caches and call `revalidatePath` after persisting ontology changes.
- Strongly typed without arbitrary `any` types.

## Review Focus

- **Empty or Whitespace CQs:** Questions with only whitespace or empty text should be filtered out before prompting.
- **Malformed LLM Output:** Markdown code fences (```` ```json ````) or trailing commas must be sanitized before JSON parsing.
- **Provider Offline / Unreachable:** Ollama not running on localhost:11434 must produce an informative, friendly error message instead of an unhandled crash.
- **Deduplication with Existing Entities:** Existing modules and classes must be matched case-insensitively so existing IDs are reused without throwing unique constraint violations.
- **Transaction Rollback:** Any database error during batch application must rollback cleanly without creating orphaned classes or partial relations.

---

### Task 1: Zod Schemas & Response Sanitizer

**Files:**
- Create: `src/features/ontology/schemas/ai-generation.ts`
- Test: `tests/ai-generation-schemas.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces:
  - `GeneratedOntologyDraftSchema`: Zod schema for full draft payload
  - `GeneratedModuleSchema`, `GeneratedClassSchema`, `GeneratedRelationSchema`, `GeneratedCQMappingSchema`
  - `GeneratedOntologyDraft`: TypeScript type
  - `sanitizeAiJsonResponse(raw: string): string`: Cleans markdown backticks and wraps

- [ ] **Step 1: Write the failing test**

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  GeneratedOntologyDraftSchema,
  sanitizeAiJsonResponse,
} from "../src/features/ontology/schemas/ai-generation"

test("sanitizeAiJsonResponse strips markdown fences and extracts json", () => {
  const fenced = "```json\n{\"modules\": []}\n```"
  assert.equal(sanitizeAiJsonResponse(fenced), "{\"modules\": []}")
})

test("GeneratedOntologyDraftSchema validates valid draft structure", () => {
  const sample = {
    modules: [{ name: "Core", description: "Core module" }],
    classes: [{
      name: "User",
      description: "User entity",
      moduleName: "Core",
      attributes: [{ name: "email", dataType: "xsd:string", description: "Email address" }],
    }],
    relations: [{
      name: "hasProfile",
      description: "Links user to profile",
      domainClassName: "User",
      rangeClassName: "Profile",
    }],
    cqMappings: [{
      cqId: "123e4567-e89b-12d3-a456-426614174000",
      subjectClassName: "User",
      predicateRelationName: "hasProfile",
      objectClassName: "Profile",
      moduleNames: ["Core"],
    }],
  }
  const parsed = GeneratedOntologyDraftSchema.parse(sample)
  assert.equal(parsed.modules.length, 1)
  assert.equal(parsed.classes[0].name, "User")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/ai-generation-schemas.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/features/ontology/schemas/ai-generation.ts`**

Define schemas using Zod for attributes, classes, modules, relations, and CQ mappings. Implement `sanitizeAiJsonResponse(raw: string): string` to strip ```` ```json ```` fences and trim content.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/ai-generation-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/schemas/ai-generation.ts tests/ai-generation-schemas.test.ts
git commit -m "feat(ontology): add AI ontology generation zod schemas and response sanitizer" --no-verify
```

---

### Task 2: Provider Clients & Prompt Builder (Gemini & Ollama)

**Files:**
- Create: `src/features/ontology/server/services/ai-ontology-generator/types.ts`
- Create: `src/features/ontology/server/services/ai-ontology-generator/prompt-builder.ts`
- Create: `src/features/ontology/server/services/ai-ontology-generator/gemini-provider.ts`
- Create: `src/features/ontology/server/services/ai-ontology-generator/ollama-provider.ts`
- Create: `src/features/ontology/server/services/ai-ontology-generator/index.ts`
- Test: `tests/ai-ontology-generator-prompt.test.ts`

**Interfaces:**
- Consumes: `GeneratedOntologyDraftSchema`, `sanitizeAiJsonResponse` from Task 1
- Produces:
  - `buildOntologyGenerationPrompt(context: PromptContext): { systemPrompt: string, userPrompt: string }`
  - `requestGeminiDraft(prompt: { systemPrompt: string, userPrompt: string }, options?: { apiKey?: string }): Promise<GeneratedOntologyDraft>`
  - `requestOllamaDraft(prompt: { systemPrompt: string, userPrompt: string }, options?: { baseUrl?: string, model?: string }): Promise<GeneratedOntologyDraft>`
  - `executeAiGeneration(context: PromptContext, options: AiGenerationOptions): Promise<GeneratedOntologyDraft>`

- [ ] **Step 1: Write the failing test**

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildOntologyGenerationPrompt } from "../src/features/ontology/server/services/ai-ontology-generator/prompt-builder"

test("buildOntologyGenerationPrompt constructs system and user prompt with CQ list", () => {
  const result = buildOntologyGenerationPrompt({
    ontologyName: "Supply Chain",
    usecase: "Track orders and vendors",
    existingModules: ["Logistics"],
    existingClasses: ["Warehouse"],
    existingRelations: ["suppliesTo"],
    competencyQuestions: [
      { id: "123e4567-e89b-12d3-a456-426614174000", question: "Which supplier delivers to which warehouse?" },
    ],
  })

  assert.ok(result.userPrompt.includes("Supply Chain"))
  assert.ok(result.userPrompt.includes("Which supplier delivers to which warehouse?"))
  assert.ok(result.userPrompt.includes("Logistics"))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/ai-ontology-generator-prompt.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement prompt builder and REST adapters**

- Implement `prompt-builder.ts`: formats clear system instructions for ontology modeling and user prompt containing existing context and CQs.
- Implement `gemini-provider.ts`: calls Google Gemini REST endpoint `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}` with `generationConfig.responseMimeType = "application/json"`. Handles API key error and rate limit message mapping.
- Implement `ollama-provider.ts`: calls `${baseUrl}/api/chat` with `format: "json"`. Catches connection failure and returns clear diagnostic.
- Implement `index.ts`: dispatches to `requestGeminiDraft` or `requestOllamaDraft` and validates result with `GeneratedOntologyDraftSchema`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/ai-ontology-generator-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/ai-ontology-generator/ tests/ai-ontology-generator-prompt.test.ts
git commit -m "feat(ontology): add AI ontology prompt builder and provider adapters" --no-verify
```

---

### Task 3: Server Action: `generateOntologyDraft`

**Files:**
- Create: `src/features/ontology/server/actions/generate-ontology.ts`
- Test: `tests/generate-ontology-action.test.ts`

**Interfaces:**
- Consumes: `executeAiGeneration`, `assertOntologyDocumentAccess`, `getOntologyCQs`, `getOntologyDocument`, `getOntologyModules`, `getOntologyClasses`, `getOntologyRelations`
- Produces:
  - `generateOntologyDraft(ontologyId: string, options: AiGenerationOptions): Promise<GeneratedOntologyDraft>`

- [ ] **Step 1: Write the failing test**

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { generateOntologyDraft } from "../src/features/ontology/server/actions/generate-ontology"

test("generateOntologyDraft rejects empty or invalid ontology ID", async () => {
  await assert.rejects(
    () => generateOntologyDraft("", { provider: "gemini" }),
    /Ontology ID is required/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/generate-ontology-action.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `generateOntologyDraft`**

In `src/features/ontology/server/actions/generate-ontology.ts`:
- Check `assertOntologyDocumentAccess(ontologyId)`.
- Fetch ontology metadata, existing modules, classes, relations, and CQs.
- If CQs are empty, throw informative error: "Ontology has no competency questions to analyze."
- Invoke `executeAiGeneration` with assembled prompt context and options.
- Return the validated `GeneratedOntologyDraft`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/generate-ontology-action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/actions/generate-ontology.ts tests/generate-ontology-action.test.ts
git commit -m "feat(ontology): add generateOntologyDraft server action" --no-verify
```

---

### Task 4: Server Action: `applyOntologyDraft` & Database Persistence

**Files:**
- Modify: `src/features/ontology/server/actions/generate-ontology.ts`
- Test: `tests/apply-ontology-draft.test.ts`

**Interfaces:**
- Consumes: `db.transaction`, `ontologyModules`, `ontologyClasses`, `ontologyAttributes`, `ontologyRelations`, `ontologyCompetencyQuestions`, `ontologyCompetencyQuestionModules`, `revalidatePath`
- Produces:
  - `applyOntologyDraft(ontologyId: string, draft: GeneratedOntologyDraft): Promise<ApplyDraftResult>`
  - `ApplyDraftResult`: `{ createdModules: number, createdClasses: number, createdRelations: number, updatedCQs: number }`

- [ ] **Step 1: Write the failing test**

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { applyOntologyDraft } from "../src/features/ontology/server/actions/generate-ontology"

test("applyOntologyDraft rejects missing ontology ID", async () => {
  await assert.rejects(
    () => applyOntologyDraft("", { modules: [], classes: [], relations: [], cqMappings: [] }),
    /Ontology ID is required/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/apply-ontology-draft.test.ts`
Expected: FAIL with `applyOntologyDraft` not exported.

- [ ] **Step 3: Implement `applyOntologyDraft` transactional insertion**

In `src/features/ontology/server/actions/generate-ontology.ts`:
- Validate input draft with `GeneratedOntologyDraftSchema`.
- Verify access with `assertOntologyDocumentAccess(ontologyId)`.
- In `db.transaction(async (tx) => { ... })`:
  1. Deduplicate/insert modules into `ontologyModules`, establish `moduleName -> moduleId` lookup.
  2. Deduplicate/insert classes into `ontologyClasses` associated with target module ID; insert attributes into `ontologyAttributes`. Establish `className -> classId` lookup.
  3. Deduplicate/insert relations into `ontologyRelations` mapping domain & range class IDs. Establish `relationKey -> relationId` lookup.
  4. For each CQ mapping: update `ontologyCompetencyQuestions` with `subject_class_id`, `predicate_relation_id`, `object_class_id`, and insert `(cq_id, module_id)` pairs into `ontologyCompetencyQuestionModules` with `onConflictDoNothing()`.
- Revalidate ontology page cache.
- Return counts of created items and updated CQs.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/apply-ontology-draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/actions/generate-ontology.ts tests/apply-ontology-draft.test.ts
git commit -m "feat(ontology): implement applyOntologyDraft transactional persistence" --no-verify
```

---

### Task 5: UI: AI Generation Dialog Component

**Files:**
- Create: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/types.ts`
- Create: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-config-step.tsx`
- Create: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-review-step.tsx`
- Create: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-dialog.tsx`

**Interfaces:**
- Consumes: `generateOntologyDraft`, `applyOntologyDraft`, `GeneratedOntologyDraft`, shadcn `Dialog`, `Tabs`, `Button`, `Checkbox`, `Input`, `Badge`
- Produces:
  - `<AiGenerateOntologyDialog open={open} onOpenChange={setOpen} ontologyId={ontologyId} cqCount={cqCount} />`

- [ ] **Step 1: Create dialog types and state interfaces**

Define `AiGenerateDialogStep = "config" | "review"`, provider selection state (`"gemini" | "ollama"`), and review item toggle records in `types.ts`.

- [ ] **Step 2: Implement `ai-generate-config-step.tsx`**

Build configuration step UI:
- Provider switcher (Gemini vs Ollama tabs).
- Optional API Key input for Gemini; Base URL / Model input for Ollama.
- Summary info card showing total CQs to analyze.
- "Analyze & Generate Draft" button with `Loader2` spinning icon while awaiting response.

- [ ] **Step 3: Implement `ai-generate-review-step.tsx`**

Build staged review interface:
- Tabs for:
  - **Modules**: List with checkbox, name, description.
  - **Classes**: List grouped by module, showing attributes preview and checkbox.
  - **Relations**: Triples `Domain -> Predicate -> Range` with checkbox.
  - **CQ Mappings**: Table showing Question -> Subject, Predicate, Object, and Module badges.
- Toggles to Select All / Deselect All.
- Footer actions: "Back to Configuration", "Cancel", and primary "Apply Selected to Ontology".
- On apply: invokes `applyOntologyDraft`, invalidates TanStack Query, fires Sonner success toast, closes dialog.

- [ ] **Step 4: Implement `ai-generate-dialog.tsx`**

Assemble the dialog container wrapping both steps with clean state transitions.

- [ ] **Step 5: Verify build & commit**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS.

```bash
git add src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/
git commit -m "feat(ontology): create AI generate ontology dialog and review step components" --no-verify
```

---

### Task 6: Integrate Action into Competency Questions Tab & Documentation

**Files:**
- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/competency-questions-tab.tsx`
- Modify: `src/features/ontology/README.md`

**Interfaces:**
- Consumes: `<AiGenerateOntologyDialog />` from Task 5
- Produces: Integrated button and updated feature documentation

- [ ] **Step 1: Add "AI Generate Ontology" trigger button to toolbar**

In `competency-questions-tab.tsx`:
- Import `Sparkles` from `lucide-react` and `AiGenerateOntologyDialog`.
- Add button beside "Add competency question":
  - Label: "AI Generate Ontology" with `Sparkles` icon.
  - Tooltip: "Draft modules, classes, and relations from competency questions using AI".
  - Disabled if `cqs.length === 0`.
- Wire state to open `AiGenerateOntologyDialog`.

- [ ] **Step 2: Update feature documentation**

In `src/features/ontology/README.md`:
- Document the AI ontology generation feature under Scope and Domain Concepts.
- Update server entry points referencing `generate-ontology.ts`.

- [ ] **Step 3: Run full verification suite**

Run:
1. `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
2. `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- test`
3. `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- lint`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/ontology-details-dialog/competency-questions-tab/competency-questions-tab.tsx src/features/ontology/README.md
git commit -m "feat(ontology): integrate AI ontology generation into competency questions toolbar" --no-verify
```
