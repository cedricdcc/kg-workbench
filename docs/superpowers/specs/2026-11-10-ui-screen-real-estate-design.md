# UI Screen Real Estate & Viewport Modal Design Specification

## 1. Executive Summary & Intent

Modern data intelligence and knowledge engineering workflows involve high-dimensional schemas, complex multi-hop graph paths, tabular data distributions, and multi-step mapping wizards.

Currently, the KG Workbench interface restricts several key workflows to narrow floating modal boxes (`sm:max-w-3xl`, `max-w-xl`, etc.) and leaves substantial unused whitespace across wide monitors (notably in the Competency Questions workbench, Graph Analyst chat, and Settings).

This specification defines a comprehensive system-wide overhaul of screen real estate:

1. **Option B Near-Full Viewport Modals:** Upgrades all heavy data and workspace modals to an expansive near-full viewport format (`fixed inset-3 md:inset-6 z-50 h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)] rounded-xl border shadow-2xl bg-background flex flex-col overflow-hidden`), preserving a slim outer backdrop margin while dedicating 96%+ of the display area to content.
2. **Competency Questions Full-Screen Workbench:** Eliminates the whitespace bottleneck in `/ontology?view=questions`, unlocking wide multi-column layout, horizontal concept triple chains, and responsive question lists.
3. **Systemic UI Space Optimizations:** Expands layout boundaries across `/settings` (responsive 2-column dashboard), `/analyst` (full-width reasoning traces and responsive contradiction grid), and `/ontology` (full-width attribute/relation tables).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Immersive Workspace Modals (Option B):** Heavy modals (`TabularProfilerModal`, `DatasetMappingModal`, `AnalystSubgraphModal`, `ReasonerReportModal`, `ReferenceVocabulariesDialog`) occupy 96%+ of viewport dimensions with pinned headers, pinned action footers, and flex-scrolling bodies.
- **Bounded Wide Modals:** Forms that require comfortable side-by-side layout without stretching empty fields across 2000px (`ResolveDialog`, `UploadDocumentDialog` Step 1, `BlastRadiusModal`) use `viewport="wide"` (`max-w-5xl w-[92vw] max-h-[88vh]`).
- **Competency Questions Workspace Density:** Remove the `max-w-2xl` clamp from `CqListPanel`, let `CqDetailPanel` stretch across the full width, and expand the Subject &rarr; Predicate &rarr; Object triple cards horizontally to display multi-hop mappings without cramped wrapping.
- **Settings Multi-Column Grid:** Replace `max-w-4xl` with a responsive two-column grid (`API Credentials` on the left, `System Services Health Monitor` on the right).
- **Graph Analyst Message & Grid Expansion:** Remove `max-w-3xl` restriction on assistant response messages: full-width prose across the top with a responsive 2-column sub-grid for Citations and Reasoning Trace underneath on desktop.
- **Preserve Focused Confirmations:** Keep lightweight confirmation alerts (e.g. Delete Class, Delete Module, Dismiss Confirmation) as compact center dialogs (`viewport="default"`).

### Non-Goals

- Changing the underlying business logic, server actions, or database schemas.
- Replacing the shadcn / Radix Dialog primitive with a different third-party library.

### Anti-Goals

- Disrupting mobile or tablet responsiveness; full-viewport modals must adapt smoothly to small viewports (`inset-2` on mobile, `inset-6` on desktop).
- Causing horizontal page scrollbars on the root document.

---

## 3. Approaches Considered & Trade-offs

| Approach                                                        | Description                                                                                                                                                                                | Pros                                                                                                                    | Cons                                                                                       | Decision                      |
| :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :---------------------------- |
| **Approach 1: Edge-to-Edge Full Screen (Option A)**             | Modals cover 100% of the screen (`fixed inset-0 h-screen w-screen rounded-none`).                                                                                                          | Maximum raw pixels; feels like a dedicated sub-app.                                                                     | Loses visual grounding; users can feel disconnected from the underlying workbench context. | Rejected in favor of Option B |
| **Approach 2: Near-Full Viewport Modal with Margin (Option B)** | Modals expand to `fixed inset-3 md:inset-6 z-50 h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)] rounded-xl border shadow-2xl bg-background`. | 96%+ screen utilization; keeps clean desktop framing and clear modal hierarchy; preserves click-outside dismissibility. | Requires standardizing pinned header/footer flex layouts across all modals.                | **Selected (User Choice)**    |
| **Approach 3: Full Page Routes (`/profiler`, `/mapping`)**      | Convert modals into separate Next.js pages.                                                                                                                                                | Complete control over route-level layouts.                                                                              | Heavy navigation churn; loses instant client-side state and background context.            | Rejected                      |

---

## 4. Detailed Component Specifications

### 4.1 Dialog Primitive Sizing Tiers (`src/components/ui/dialog.tsx`)

Enhance `DialogContent` to support three explicit viewport sizing tiers:

```tsx
interface DialogContentProps extends React.ComponentProps<
  typeof DialogPrimitive.Content
> {
  showCloseButton?: boolean
  viewport?: "default" | "wide" | "fullscreen"
}
```

1. **`viewport="fullscreen"` (Option B Workspace Modals):**
   ```css
   fixed top-3 left-3 md:top-6 md:left-6 z-50
   w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)]
   h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)]
   max-w-none max-h-none -translate-x-0 -translate-y-0
   rounded-xl border bg-background text-popover-foreground shadow-2xl
   flex flex-col overflow-hidden outline-none duration-100
   ```
2. **`viewport="wide"` (Bounded Multi-Column / Comparison Dialogs):**
   ```css
   fixed top-1/2 left-1/2 z-50
   w-[calc(100vw-2rem)] max-w-5xl max-h-[88vh]
   -translate-x-1/2 -translate-y-1/2
   rounded-xl border bg-background text-popover-foreground shadow-2xl
   flex flex-col overflow-hidden outline-none duration-100
   ```
3. **`viewport="default"` (Classic Centered Confirmations):**
   ```css
   fixed top-1/2 left-1/2 z-50
   w-full max-w-[calc(100%-2rem)] sm:max-w-md
   -translate-x-1/2 -translate-y-1/2
   rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none
   ```

---

### 4.2 Workspace Modal Mapping & Layouts

1. **`TabularProfilerModal` (`src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx`)**:
   - `viewport="fullscreen"`.
   - Pinned header with badges (row/col count, format, status).
   - Content area: Full-width data table preview with horizontal scrolling taking full available width.
   - Side-by-side column profiling cards and candidate keys.
2. **`DatasetMappingModal` (`src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx`)**:
   - `viewport="fullscreen"`.
   - Pinned 3-step progress bar at top and action buttons at bottom.
   - Column-to-property mapping renders in an expansive responsive 2-column or 3-column grid rather than a single cramped list.
3. **`AnalystSubgraphModal` (`src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx`)**:
   - `viewport="fullscreen"`.
   - React Flow canvas expands to fill the entire remaining height (`flex-1 h-full min-h-0`), with floating entity-kind legend and node-count badges pinned at the top/bottom.
4. **`BlastRadiusModal` (`src/features/ontology/components/blast-radius-modal/blast-radius-modal.tsx`)**:
   - `viewport="wide"` (or `fullscreen` when critical dependencies exist).
   - Flight-deck presentation using existing `BlastRadiusReport.details`:
     - Top: Risk score gauge and severity badge (`critical` / `warning` / `low`).
     - Impact breakdown cards:
       - Card 1: Broken Competency Questions & Triples (`details.competencyQuestions`).
       - Card 2: Invalidated Relations & Orphaned Subclasses (`details.relations`, `details.orphanedSubclasses`).
       - Card 3: Affected Attributes & Aggregate Extracted Facts (`details.attributes`, `details.affectedFactsCount`).
5. **`ReasonerReportModal` (`src/features/ontology/components/reasoner-modal/reasoner-report-modal.tsx`)**:
   - `viewport="fullscreen"`.
   - Diagnostic console: Consistency badge and ontology stats on top, full-width SHACL violation inspection list and entailment graph summaries.
6. **`UploadDocumentDialog` (`src/features/documents/components/upload-document-dialog/upload-document-dialog.tsx`)**:
   - Step 1 (UploadForm): `viewport="wide"` for clean, well-spaced configuration.
   - Step 2 (ModuleDetailStep): `viewport="fullscreen"` for module inspection.
7. **`ReferenceVocabulariesDialog` (`src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx`)**:
   - `viewport="fullscreen"`.
   - Preserves all 4 tabs (`library`, `search`, `tester`, `upload`).
   - Inside Library and Search tabs: Master-detail split pane (term list on left 35%, full term metadata, parent IRIs, CURIEs, and copy actions on right 65%).
8. **`ResolveDialog` (`src/features/analyst/components/contradictions-view/resolve-dialog.tsx`)**:
   - `viewport="wide"`.
   - Side-by-side statement evidence cards with complete provenance quotes, audit rationale input, and resolution action buttons.

---

### 4.3 Competency Questions Workspace (`src/features/ontology/components/cq-workbench/`)

1. **`cq-workbench.tsx` Shell**:
   - Remove `w-1/2 max-w-2xl min-w-[340px]` from the list panel wrapper.
   - Set list panel to a balanced `w-[360px] lg:w-[400px] shrink-0 border-r border-border/60`.
   - Set detail inspector pane to `flex-1 min-w-0 bg-card/20`.
2. **`cq-detail-panel.tsx` Inspector Layout**:
   - Remove narrow card constraints.
   - Top row on `lg:` viewports: Split **Question Formulation** (65% width) and **Module Associations** (35% width).
   - Main section: **Concept Mapping Card** (`CqConceptMappingCard`) expands across 100% width.
3. **`cq-concept-mapping-card.tsx` Horizontal Triples Chain**:
   - Keep individual hops stacked, but render each hop's 3 selectors in a clear horizontal flow:
     `[ Subject Class Picker ] ──( Predicate Relation Picker )──> [ Object Class Picker ]`
   - Read-only attribute badges for the selected class displayed below in a compact horizontal scroll strip.
   - Eliminates blank whitespace by giving each triple hop full width to select domain/range without truncated dropdowns.

---

### 4.4 Other Screens Real Estate Improvements

1. **Settings Screen (`src/features/settings/components/settings-shell/settings-shell.tsx`)**:
   - Remove `max-w-4xl`. Replace with full-width container `w-full max-w-7xl mx-auto p-6 md:p-8`.
   - Render in a responsive 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-8 items-start`):
     - Column 1: API Keys & LLM Provider Credentials.
     - Column 2: System Services Live Monitor & Heartbeat Telemetry.
2. **Graph Analyst Chat View (`src/features/analyst/components/chat-view/`)**:
   - In `chat-message-item.tsx`, increase the assistant container from `max-w-3xl` to `max-w-6xl w-full`.
   - Text prose remains full-width across the top of the bubble.
   - Beneath the prose: A responsive grid (`grid grid-cols-1 md:grid-cols-2 gap-3`) containing the `ReasoningTraceCard` and the `Source Citations` list. If either is absent, the single item spans `col-span-full`.
3. **Graph Analyst Contradictions View (`src/features/analyst/components/contradictions-view/`)**:
   - In `contradictions-tab.tsx`, display contradictions in a responsive 2-column grid (`grid grid-cols-1 xl:grid-cols-2 gap-4`) so users can compare multiple conflicting claims without endless vertical scrolling.
4. **Ontology Schema View (`src/features/ontology/components/class-detail/`)**:
   - Ensure `AttributeTable` in `ClassDetail` expands to 100% width with clear data-type badges and required status tags.

---

## 5. Verification & Testing Strategy

1. **Visual & DOM Contract Tests**:
   - Verify modal rendering with `viewport="fullscreen"` classes (`fixed inset-3 md:inset-6`, `w-[calc(100vw-...)]`, `h-[calc(100vh-...)]`).
   - Run existing DOM test suites (`analyst-chat-dom.test.ts`, `analyst-subgraph-dom.test.ts`, `tabular-profiler-modal-dom.test.ts`, `dataset-mapping-wizard-dom.test.ts`, `cq-coverage-multi-triple.test.ts`).
2. **TypeScript & Build Verification**:
   - Execute `next typegen && tsc --noEmit`.
   - Run `eslint` across modified components.
3. **Container Rebuild & Live Validation**:
   - Rebuild Next.js app container: `docker compose ... up -d --build app`.
   - Validate live modal triggers across Tabular, Analyst, CQ Workbench, and Settings.

---

## 6. What's Left to the Builder

- Fine-tuning specific padding values (`p-4` vs `p-6`) across individual dialog headers to match existing typography rhythm.
- Exact breakpoint choices for 1-column vs 2-column switches (`lg:` vs `xl:`).
