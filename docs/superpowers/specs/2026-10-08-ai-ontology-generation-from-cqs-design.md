# AI-Assisted Ontology Generation from Competency Questions

- **Date:** 2026-10-08
- **Status:** Approved
- **Scope:** Architectural Subsystem

---

## 1. Overview & Problem Statement

Currently in KG Workbench, constructing an ontology (modules, classes, attributes, relations) from Competency Questions (CQs) is a manual, labor-intensive process. Domain experts formulate CQs to specify what queries the knowledge graph must answer, but must then manually invent module partitions, map classes and attributes, create relation edges, and link each CQ's subject, predicate, and object.

This feature introduces an AI-assisted ontology drafting pipeline that:
1. Analyzes the full set of Competency Questions present in an ontology document.
2. Infers cohesive domain modules, entity classes with attributes, and relation edges.
3. Maps each Competency Question to its corresponding subject class, predicate relation, object class, and module.
4. Presents a staged preview/review dialog where users inspect, adjust, and toggle proposed elements.
5. Merges approved entities into the ontology transactionally, deduplicating with existing items and auto-linking the CQs.

---

## 2. Low-Cost AI Provider Strategy

To keep ongoing usage cheap or free:
- **Primary Provider: Google Gemini API (`generativelanguage.googleapis.com/v1beta`)**:
  - Model: `gemini-2.0-flash`.
  - Cost: Free tier in Google AI Studio (up to 15 RPM, 1,500 requests/day). Paid tier costs ~$0.10 per 1M input tokens (< $0.001 per run).
  - Protocol: Direct HTTP `fetch` to REST endpoint with native `responseSchema` for guaranteed structured JSON output.
  - Credentials: Defaults to server `GEMINI_API_KEY` in environment; allows optional modal override.
- **Offline / Local Provider: Ollama (`http://localhost:11434`)**:
  - Models: e.g. `qwen2.5`, `llama3`.
  - Cost: $0 (runs 100% locally).
  - Protocol: Direct HTTP `fetch` to `/api/chat` with `format: "json"`.

---

## 3. Schema & Data Contracts

### 3.1 Structured Draft Schema (Zod)
Located in `src/features/ontology/schemas/ai-generation.ts`:

```typescript
import { z } from "zod"

export const GeneratedAttributeSchema = z.object({
  name: z.string().trim().min(1),
  dataType: z
    .enum(["xsd:string", "xsd:integer", "xsd:decimal", "xsd:boolean", "xsd:date"])
    .default("xsd:string"),
  description: z.string().default(""),
})

export const GeneratedClassSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  moduleName: z.string().trim().min(1),
  attributes: z.array(GeneratedAttributeSchema).default([]),
})

export const GeneratedModuleSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
})

export const GeneratedRelationSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  domainClassName: z.string().trim().min(1),
  rangeClassName: z.string().trim().min(1),
})

export const GeneratedCQMappingSchema = z.object({
  cqId: z.string().uuid(),
  subjectClassName: z.string().trim().min(1),
  predicateRelationName: z.string().trim().min(1),
  objectClassName: z.string().trim().min(1),
  moduleNames: z.array(z.string().trim()).default([]),
})

export const GeneratedOntologyDraftSchema = z.object({
  modules: z.array(GeneratedModuleSchema),
  classes: z.array(GeneratedClassSchema),
  relations: z.array(GeneratedRelationSchema),
  cqMappings: z.array(GeneratedCQMappingSchema),
})

export type GeneratedOntologyDraft = z.infer<typeof GeneratedOntologyDraftSchema>
```

---

## 4. Backend Architecture

### 4.1 Adapter Services
Located in `src/features/ontology/server/services/ai-ontology-generator/`:
- `gemini-provider.ts`: Calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}` with system prompt and `responseSchema`.
- `ollama-provider.ts`: Calls `${baseUrl}/api/chat` with JSON formatting and structured prompt.
- `prompt-builder.ts`: Formats ontology metadata (name, usecase), existing module/class/relation names, and all competency questions `[{ id, question }]`.

### 4.2 Server Actions
Located in `src/features/ontology/server/actions/generate-ontology.ts`:

1. `generateOntologyDraft(ontologyId: string, options: ProviderOptions)`:
   - Verifies group access with `assertOntologyDocumentAccess(ontologyId)`.
   - Fetches all CQs for the ontology document via `getOntologyCQs(ontologyId)`.
   - Fetches existing modules, classes, and relations to inform the model and prevent accidental duplicates.
   - Executes AI call, parses JSON, and validates with `GeneratedOntologyDraftSchema`.
   - Returns draft payload to client without saving to DB.

2. `applyOntologyDraft(ontologyId: string, payload: FinalizedDraftPayload)`:
   - Verifies group access with `assertOntologyDocumentAccess(ontologyId)`.
   - Runs within `db.transaction`:
     - **Modules:** Matches proposed modules by name (case-insensitive). Inserts missing modules into `ontology_modules`. Builds `moduleName -> moduleId` map.
     - **Classes & Attributes:** Matches proposed classes by name. Inserts missing classes into `ontology_classes` with `module_id = moduleNameMap[class.moduleName]`. Inserts class attributes into `ontology_attributes`. Builds `className -> classId` map.
     - **Relations:** Matches by `(name, domainClassId, rangeClassId)`. Inserts missing relations into `ontology_relations`. Builds `relationName -> relationId` map.
     - **CQ Links:** For each approved CQ mapping, updates `ontology_competency_questions` (`subject_class_id`, `predicate_relation_id`, `object_class_id`) and inserts links into `ontology_competency_question_modules`.
   - Invokes `revalidatePath` and returns summary metrics (`createdModules`, `createdClasses`, `createdRelations`, `linkedCQs`).

---

## 5. Frontend & UI Architecture

### 5.1 Entry Point
- In `CompetencyQuestionsTab` (`src/features/ontology/components/ontology-details-dialog/competency-questions-tab/`):
  - Add an **"AI Generate Ontology"** button (`Sparkles` icon) to the header toolbar.
  - Disabled if `cqs.length === 0` with a descriptive tooltip.

### 5.2 Component Hierarchy
`src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/`:
- `ai-generate-dialog.tsx`: Root dialog managing active step (`config` vs `review`).
- `ai-generate-config-step.tsx`:
  - Provider selection: Gemini (`gemini-2.0-flash`) vs Local Ollama (`http://localhost:11434`).
  - Key / endpoint inputs.
  - Question count overview.
  - "Generate Draft" action with pending spinner.
- `ai-generate-review-step.tsx`:
  - Tabbed review staging:
    - **Modules:** Checkbox list of proposed modules, names, and descriptions.
    - **Classes:** Proposed classes grouped/tagged by module, listing previewed attributes.
    - **Relations:** Proposed triples (`Domain Class` &rarr; `predicate` &rarr; `Range Class`).
    - **CQ Mappings:** Table showing question &rarr; assigned Subject, Predicate, Object, and Module.
  - Selection checkboxes for batch inclusion/exclusion.
  - Action buttons: "Back", "Cancel", and primary "Apply Selected to Ontology".

---

## 6. Error Handling & Security

1. **API & Connection Errors:** Informative UI error messages if Ollama is unreachable on localhost or Gemini quota/key errors occur.
2. **Schema Sanitization:** Automatic strip of markdown code fences prior to JSON parsing; strict Zod validation.
3. **Database Consistency:** PostgreSQL transaction ensures atomic commit or complete rollback on failure.
4. **Access Boundaries:** Access verified via `assertOntologyDocumentAccess` ensuring group scoping. API keys never leaked to client responses.

---

## 7. Testing & Verification

1. **Unit Tests:**
   - Provider request payload formatting and response parsing.
   - Zod schema validation on valid and edge-case AI outputs.
2. **Integration Tests:**
   - Server action `applyOntologyDraft`: Verifies deduplication against existing items, proper foreign-key resolution, and CQ triple updates.
3. **Interactive Verification:**
   - Full flow in UI: Open dialog from CQ tab &rarr; generate draft &rarr; inspect tabs &rarr; toggle items &rarr; apply &rarr; verify canvas, browser panel, and CQ table reflect changes immediately.
