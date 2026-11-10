# UI Screen Real Estate & Viewport Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the application's UI screen real estate by upgrading heavy data modals to Option B near-full viewport sizing (`fixed inset-3 md:inset-6 z-50 h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)] rounded-xl border shadow-2xl bg-background`), eliminating whitespace in the Competency Questions workbench with an expansive multi-column triples editor, and optimizing screen utilization across Settings, Analyst, and Ontology views.

**Architecture:** Introduce explicit `viewport` sizing tiers on `DialogContent` in `src/components/ui/dialog.tsx` (`fullscreen`, `wide`, `default`). Upgrade workspace modals across Tabular, Analyst, Ontology, and Document features to Option B fullscreen or wide tiers with pinned headers/footers and flex-scrolling data bodies. Redesign the Competency Questions workbench (`cq-workbench.tsx`, `cq-detail-panel.tsx`, `cq-concept-mapping-card.tsx`) into an expansive split-pane with horizontal triple chaining. Expand Settings into a responsive 2-column dashboard and Analyst into a wide layout with side-by-side citations/traces.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI Dialog primitives, React Flow, TanStack Query, shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-11-10-ui-screen-real-estate-design.md`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-11-10-ui-screen-real-estate-design.md)

## Global Constraints

- Strictly preserve all existing database schemas, Drizzle models, and server action contracts (no DB migrations or schema churn).
- Use `pnpm` via `npm exec pnpm -- <cmd>` on this Windows platform.
- Preserve all existing confirmation dialogs (Delete, Rename, Dismiss) as focused center dialogs (`viewport="default"`).
- Maintain 100% TypeScript type safety (`next typegen && tsc --noEmit` must pass with 0 errors).
- Zero ESLint warnings or errors (`npm exec pnpm -- lint`).

## Review Focus

1. **Modal Body Scrolling & Pinned Actions:** Full-viewport dialogs must keep headers and action footers pinned while the body scrolls (`flex-1 min-h-0 overflow-auto`), preventing buttons from getting pushed off-screen.
2. **Mobile & Tablet Responsiveness:** On viewports under `md:` (768px), `viewport="fullscreen"` must degrade gracefully to `inset-2` without horizontal viewport overflow.
3. **CQ Triples Multi-Hop Wrapping:** Long triple chains with multiple hops must wrap cleanly on narrow screens while expanding to an unbroken horizontal flow on desktop monitors.
4. **Chat Message Bubble Readability:** Expanding assistant bubbles to `max-w-6xl` must keep paragraph line-length readable without distorting user message bubbles on the right.
5. **Existing DOM Test Regressions:** Modal DOM tests checking `role="dialog"` and specific test-ids must continue passing seamlessly.

---

### Task 1: Dialog Primitive Viewport Sizing (`src/components/ui/dialog.tsx`)

**Files:**

- Modify: `src/components/ui/dialog.tsx:50-80`
- Create: `tests/dialog-viewport-variants.test.ts`

**Interfaces:**

- Consumes: Radix UI `DialogPrimitive.Content`
- Produces: `DialogContent` with `viewport?: "default" | "wide" | "fullscreen"` prop

- [ ] **Step 1: Write the failing test**

Create `tests/dialog-viewport-variants.test.ts` verifying that `DialogContent` accepts `viewport="fullscreen"` and `viewport="wide"` and renders the expected Tailwind utility classes (`fixed top-3 left-3`, `w-[calc(100vw-1.5rem)]`, `max-w-5xl`, etc.), while defaulting to standard centered styles when omitted.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/dialog-viewport-variants.test.ts`
Expected: FAIL (viewport prop not recognized or classes missing)

- [ ] **Step 3: Implement `viewport` variants in `src/components/ui/dialog.tsx`**

Extend `DialogContent` props with `viewport?: "default" | "wide" | "fullscreen"`.
Apply:

- `viewport="fullscreen"`: `fixed top-3 left-3 md:top-6 md:left-6 z-50 w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)] h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] max-w-none max-h-none -translate-x-0 -translate-y-0 rounded-xl border bg-background text-popover-foreground shadow-2xl flex flex-col overflow-hidden outline-none duration-100`
- `viewport="wide"`: `fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-5xl max-h-[88vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background text-popover-foreground shadow-2xl flex flex-col overflow-hidden outline-none duration-100`
- `viewport="default"`: `fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-popover p-4 text-xs/relaxed text-popover-foreground shadow-lg duration-100 outline-none sm:max-w-md`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/dialog-viewport-variants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dialog.tsx tests/dialog-viewport-variants.test.ts
git commit -m "feat(ui): add viewport sizing tiers to DialogContent primitive"
```

---

### Task 2: Tabular Profiler & Dataset Mapping Modals (Option B)

**Files:**

- Modify: `src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx:210-310`
- Modify: `src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx:135-220`
- Test: `tests/tabular-profiler-modal-dom.test.ts`
- Test: `tests/dataset-mapping-wizard-dom.test.ts`

**Interfaces:**

- Consumes: `DialogContent` with `viewport="fullscreen"`
- Produces: Full-screen tabular data profiler with full-width preview table and responsive mapping wizard

- [ ] **Step 1: Inspect existing tabular modal tests**

Run: `npm exec pnpm -- tsx --test tests/tabular-profiler-modal-dom.test.ts tests/dataset-mapping-wizard-dom.test.ts`
Expected: Baseline PASS

- [ ] **Step 2: Upgrade `TabularProfilerModal` to `viewport="fullscreen"`**

In `tabular-profiler-modal.tsx`:

- Change `<DialogContent className="sm:max-w-3xl">` to `<DialogContent viewport="fullscreen" className="p-6">`.
- Wrap content in `flex flex-col flex-1 min-h-0 overflow-hidden`.
- Ensure data preview table container has `w-full overflow-x-auto` to expand across all 1920px+ displays without artificial width clamping.

- [ ] **Step 3: Upgrade `DatasetMappingModal` to `viewport="fullscreen"`**

In `dataset-mapping-modal.tsx`:

- Change `<DialogContent className="sm:max-w-3xl">` to `<DialogContent viewport="fullscreen" className="p-6">`.
- Ensure Step 2 (Attributes mapping) and Step 3 (Review & commit) render in a responsive 2-column or 3-column layout (`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4`) taking advantage of wide displays.

- [ ] **Step 4: Verify tabular modal tests pass**

Run: `npm exec pnpm -- tsx --test tests/tabular-profiler-modal-dom.test.ts tests/dataset-mapping-wizard-dom.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/components/
git commit -m "feat(tabular): upgrade profiler and mapping wizard modals to full viewport"
```

---

### Task 3: Analyst Subgraph Modal & Contradiction Resolve Dialog

**Files:**

- Modify: `src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx:150-180`
- Modify: `src/features/analyst/components/contradictions-view/resolve-dialog.tsx:260-310`
- Test: `tests/analyst-subgraph-dom.test.ts`
- Test: `tests/analyst-contradictions-dom.test.ts`

**Interfaces:**

- Consumes: `DialogContent` with `viewport="fullscreen"` and `viewport="wide"`
- Produces: Full-screen React Flow subgraph visualizer and wide side-by-side contradiction resolve dialog

- [ ] **Step 1: Inspect existing analyst modal tests**

Run: `npm exec pnpm -- tsx --test tests/analyst-subgraph-dom.test.ts tests/analyst-contradictions-dom.test.ts`
Expected: Baseline PASS

- [ ] **Step 2: Upgrade `AnalystSubgraphModal` to `viewport="fullscreen"`**

In `analyst-subgraph-modal.tsx`:

- Set `viewport="fullscreen"` on `DialogContent`.
- Set graph canvas height to `flex-1 h-full min-h-[500px]` so React Flow occupies the entire height between header and footer.
- Keep legend and node-count badges pinned at the bottom and top cleanly.

- [ ] **Step 3: Upgrade `ResolveDialog` to `viewport="wide"`**

In `resolve-dialog.tsx`:

- Set `viewport="wide"` on `DialogContent`.
- In `ResolveDialogForm`, render Statement A and Statement B side-by-side on desktop (`grid grid-cols-1 md:grid-cols-2 gap-4`) with full quotes and metadata badges, followed by the resolution radio strategy group and custom audit notes.

- [ ] **Step 4: Verify analyst tests pass**

Run: `npm exec pnpm -- tsx --test tests/analyst-subgraph-dom.test.ts tests/analyst-contradictions-dom.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/analyst/components/
git commit -m "feat(analyst): upgrade subgraph modal to fullscreen and resolve dialog to wide"
```

---

### Task 4: Ontology Modals (Blast Radius, Reasoner Report, Reference Vocabularies, Upload)

**Files:**

- Modify: `src/features/ontology/components/blast-radius-modal/blast-radius-modal.tsx:90-130`
- Modify: `src/features/ontology/components/reasoner-modal/reasoner-report-modal.tsx:48-75`
- Modify: `src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx:90-140`
- Modify: `src/features/documents/components/upload-document-dialog/upload-document-dialog.tsx:70-90`
- Test: `tests/blast-radius.test.ts`
- Test: `tests/reasoner-report-modal-dom.test.ts`
- Test: `tests/reference-vocabularies-dialog-contract.test.ts`

**Interfaces:**

- Consumes: `DialogContent` with `viewport="fullscreen"` and `viewport="wide"`
- Produces: Expansive flight deck for blast radius, full-viewport reasoner console, 2-pane registry explorer, and comfortable document upload dialog

- [ ] **Step 1: Inspect existing ontology modal tests**

Run: `npm exec pnpm -- tsx --test tests/blast-radius.test.ts tests/reasoner-report-modal-dom.test.ts tests/reference-vocabularies-dialog-contract.test.ts`
Expected: Baseline PASS

- [ ] **Step 2: Upgrade `BlastRadiusModal` to `viewport="wide"`**

In `blast-radius-modal.tsx`:

- Set `viewport="wide"` on `DialogContent`.
- Render the 3 impact cards in a responsive 3-column layout on desktop:
  - Card 1: Broken Competency Questions (`details.competencyQuestions`).
  - Card 2: Affected Relations & Orphaned Subclasses (`details.relations`, `details.orphanedSubclasses`).
  - Card 3: Affected Attributes & Summary of Facts (`details.attributes`, `details.affectedFactsCount`).

- [ ] **Step 3: Upgrade `ReasonerReportModal` and `ReferenceVocabulariesDialog` to `viewport="fullscreen"`**

- In `reasoner-report-modal.tsx`: Set `viewport="fullscreen"`, expand SHACL constraint violations into full-width table.
- In `reference-vocabularies-dialog.tsx`: Set `viewport="fullscreen"`, preserve all 4 tabs (`library`, `search`, `tester`, `upload`), and render search/library terms in a master-detail 2-pane layout (left: term list 35%, right: metadata/parent IRIs 65%).

- [ ] **Step 4: Upgrade `UploadDocumentDialog`**

- In `upload-document-dialog.tsx`: Set `viewport="wide"` for Step 1 (UploadForm) and `viewport="fullscreen"` for Step 2 (ModuleDetailStep).

- [ ] **Step 5: Verify tests pass**

Run: `npm exec pnpm -- tsx --test tests/blast-radius.test.ts tests/reasoner-report-modal-dom.test.ts tests/reference-vocabularies-dialog-contract.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/components/ src/features/documents/components/
git commit -m "feat(ontology): upgrade blast radius, reasoner, vocabulary, and upload dialogs"
```

---

### Task 5: Competency Questions Full-Screen Workbench Layout

**Files:**

- Modify: `src/features/ontology/components/cq-workbench/cq-workbench.tsx:315-350`
- Modify: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-detail-panel.tsx:90-180`
- Modify: `src/features/ontology/components/cq-workbench/cq-detail-panel/cq-concept-mapping-card.tsx:180-260`
- Test: `tests/cq-coverage.test.ts`
- Test: `tests/cq-coverage-multi-triple.test.ts`

**Interfaces:**

- Consumes: CQ triple definitions and coverage metrics
- Produces: Zero-whitespace full-bleed CQ workbench with horizontal multi-hop triple rows

- [ ] **Step 1: Inspect existing CQ tests**

Run: `npm exec pnpm -- tsx --test tests/cq-coverage.test.ts tests/cq-coverage-multi-triple.test.ts`
Expected: Baseline PASS

- [ ] **Step 2: Remove `max-w-2xl` bottleneck in `cq-workbench.tsx`**

In `cq-workbench.tsx`:

- Change list panel container from `w-1/2 max-w-2xl min-w-[340px]` to `w-[360px] lg:w-[400px] shrink-0 border-r border-border/60`.
- Let the right detail inspector take `flex-1 min-w-0 bg-card/20`.

- [ ] **Step 3: Redesign `cq-detail-panel.tsx` for Wide Screens**

In `cq-detail-panel.tsx`:

- Replace narrow single-column cards with a responsive wide layout:
  - Top header with Title & Delete action.
  - Responsive top row on `lg:` viewports:
    - Left (65% width): Question Formulation textarea.
    - Right (35% width): Module Associations picker.
  - Main section: Concept Mapping Card expanding across 100% width.

- [ ] **Step 4: Expand `cq-concept-mapping-card.tsx` to Horizontal Triples Chain**

In `cq-concept-mapping-card.tsx`:

- Render each hop's 3 pickers in an expansive horizontal chain on desktop:
  `[ Subject Class Picker ] ──( Predicate Relation Picker )──> [ Object Class Picker ]`
- Add compact read-only attribute badge strip underneath the selected subject and object classes.
- Allow multi-hop chaining buttons to span full width with clean card styling.

- [ ] **Step 5: Verify CQ tests pass**

Run: `npm exec pnpm -- tsx --test tests/cq-coverage.test.ts tests/cq-coverage-multi-triple.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/components/cq-workbench/
git commit -m "feat(ontology): eliminate whitespace in CQ workbench with horizontal concept chaining"
```

---

### Task 6: Settings & Graph Analyst Screen Real Estate Optimizations

**Files:**

- Modify: `src/features/settings/components/settings-shell/settings-shell.tsx:15-37`
- Modify: `src/features/analyst/components/chat-view/chat-message-item.tsx:165-225`
- Modify: `src/features/analyst/components/contradictions-view/contradictions-tab.tsx:235-300`
- Modify: `src/features/ontology/components/class-detail/class-detail.tsx:120-180`
- Test: `tests/settings-actions.test.ts`
- Test: `tests/analyst-chat-dom.test.ts`
- Test: `tests/analyst-contradictions-dom.test.ts`

**Interfaces:**

- Consumes: Settings provider states, Analyst messages, and Contradictions
- Produces: 2-column Settings dashboard, expansive Analyst chat bubbles with side-by-side traces, and responsive contradictions grid

- [ ] **Step 1: Inspect existing Settings and Analyst tests**

Run: `npm exec pnpm -- tsx --test tests/settings-actions.test.ts tests/analyst-chat-dom.test.ts tests/analyst-contradictions-dom.test.ts`
Expected: Baseline PASS

- [ ] **Step 2: Upgrade `SettingsShell` to a 2-Column Dashboard**

In `settings-shell.tsx`:

- Replace `max-w-4xl` with `w-full max-w-7xl mx-auto p-6 md:p-8`.
- Render the sections in a responsive 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-8 items-start`):
  - Column 1: `ApiKeysSection` (LLM Provider credentials).
  - Column 2: `ServicesSection` (System Services health monitors & live heartbeat).

- [ ] **Step 3: Expand Analyst Assistant Message Bubble**

In `chat-message-item.tsx`:

- Change assistant container from `max-w-3xl` to `max-w-6xl w-full`.
- Keep text prose full-width on top.
- Place `ReasoningTraceCard` and `Source Citations` in a responsive 2-column sub-grid (`grid grid-cols-1 md:grid-cols-2 gap-3`) beneath the prose on desktop viewports. If only one exists, span full width (`col-span-full`).

- [ ] **Step 4: Convert Contradictions to a Responsive Grid**

In `contradictions-tab.tsx`:

- Change the contradiction card stack from single column to a responsive 2-column grid on wide screens (`grid grid-cols-1 xl:grid-cols-2 gap-4`).

- [ ] **Step 5: Verify tests pass**

Run: `npm exec pnpm -- tsx --test tests/settings-actions.test.ts tests/analyst-chat-dom.test.ts tests/analyst-contradictions-dom.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/ src/features/analyst/ src/features/ontology/components/class-detail/
git commit -m "feat(ui): optimize screen real estate in settings, analyst chat, and contradictions"
```

---

### Task 7: Full System Verification, Type Checking, and Docker Rebuild

**Files:**

- Modify: Any files needing lint/type adjustments
- Verify: Full test suite, TypeScript, ESLint, and Docker stack

- [ ] **Step 1: Run TypeScript compiler check**

Run: `npm exec pnpm -- next typegen; npm exec pnpm -- tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run ESLint**

Run: `npm exec pnpm -- lint`
Expected: 0 errors / 0 warnings

- [ ] **Step 3: Run entire test suite**

Run: `npm exec pnpm -- test`
Expected: All tests pass

- [ ] **Step 4: Rebuild and restart the Docker application container**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/supabase.yaml up -d --build app`
Expected: Image built and container running

- [ ] **Step 5: Verify live application endpoints**

Run: `curl.exe -s -o /dev/null -w "%{http_code}" http://localhost:3010/ontology`
Expected: 200

- [ ] **Step 6: Commit and wrap up**

```bash
git add .
git commit -m "chore: verify screen real estate improvements and update build"
```
