# Phase 4: Workbench UI — LinkML & Code Compiler Studio + `ohi.dev` Dependency Browser

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: `open`

**Goal:** Build the **LinkML & Code Compiler Studio** dialog (`/src/features/ontology/components/compiler-studio-dialog`) for live preview, editing, and 1-click export of `.linkml.yaml`, `.shacl.ttl`, `.rdfs.ttl`, `.owl.ttl`, Pydantic `models.py`, JSON Schema, Mermaid ER, and `ohi.yaml` / `ohi.lock.json`, and upgrade the Standards Browser (`/src/features/ontology/components/standards-browser`) into a full `ohi.dev` dependency & lockfile manager.

**Architecture:** Multi-file client components under `src/features/ontology/components/` built on existing shadcn/ui primitives (`Dialog`, `Tabs`, `Badge`, `Button`, `ScrollArea`). Server actions compile and persist LinkML artifacts and `ohi.dev` lockfile updates, while `ontology-issues-sheet.tsx` surfaces `@neverblink/linkml` lint issues and `ohi.lock.json` SHA-256 drift alerts.

**Tech Stack:** React 19, Next.js 16 App Router, Tailwind CSS, shadcn/ui, Lucide React, `@neverblink/linkml@0.18.2`.

**Spec:** `docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md` (Section 5.7)

## Global Constraints

- Follow the multi-file component pattern: `components/<component-name>/<component-name>.tsx` with focused subcomponents in separate files.
- Reuse existing shadcn primitives from `src/components/ui/*` and shared components from `src/components/shared/*`.
- Update `src/features/ontology/README.md` to document the new Compiler Studio and `ohi.dev` Package Manager flows.
- Run `pnpm check` at the end of the phase.

## Review Focus

1. **Destructive Raw LinkML YAML Edits:** When a user edits raw LinkML YAML in `raw-linkml-editor-tab.tsx` and removes a class/slot that has extracted facts or mapped CQs, saving must preview the impacted count (Blast Radius warning) before committing `cascadeSymbolDelete`.
2. **Invalid Raw LinkML Syntax Handling:** Saving malformed YAML or a schema that fails `LinkML.loadFromString` in `raw-linkml-editor-tab.tsx` must display inline compiler error diagnostics without overwriting the last valid `linkml_yaml`.
3. **Transitive Dependency Visibility:** Adding `w3c/dcat@3` in `standards-browser.tsx` must clearly distinguish direct dependencies (`selections[]`) from automatically locked transitive dependencies (`files[]`, such as `w3c/prov-o@2013`, `w3c/skos@2009`, `dublincore/dcterms@2020`).
4. **Lockfile Drift Quick-Fix:** If `verifyOhiLockfile` detects a SHA-256 mismatch or unsynced `ohi.yaml`, `ontology-issues-sheet.tsx` and `ohi-lockfile-status-bar.tsx` must offer a 1-click **Re-lock & Verify (`ohi sync`)** action.
5. **Download Filenames & MIME Types:** Downloading each artifact from the Compiler Studio must use the exact `ohi` file suffixes (`.linkml.yaml`, `.shacl.ttl`, `.rdfs.ttl`, `.owl.ttl`, `models.py`, `ohi.yaml`, `ohi.lock.json`).

---

### Slice 4.1: Build LinkML & Code Compiler Studio Dialog `open`

**Files:**

- Create: `src/features/ontology/components/compiler-studio-dialog/compiler-studio-dialog.tsx`
- Create: `src/features/ontology/components/compiler-studio-dialog/compiler-format-tabs.tsx`
- Create: `src/features/ontology/components/compiler-studio-dialog/artifact-code-viewer.tsx`
- Create: `src/features/ontology/components/compiler-studio-dialog/raw-linkml-editor-tab.tsx`
- Create: `src/features/ontology/components/compiler-studio-dialog/ohi-manifest-lock-tab.tsx`
- Create: `src/features/ontology/components/compiler-studio-dialog/types.ts`
- Create: `src/features/ontology/server/actions/compiler-studio.ts`
- Modify: `src/features/ontology/components/ontology-header/ontology-actions-menu.tsx`
- Test: `tests/compiler-studio-actions.test.ts`

**Interfaces:**

- Consumes: `compileLinkmlOntology`, `saveCanonicalOntology`, `diffLinkmlSnapshots`
- Produces:
  - `getCompiledOntologyStudioDataAction(ontologyId: string): Promise<CompilerStudioData>`
  - `saveRawLinkmlYamlAction(ontologyId: string, newLinkmlYaml: string, confirmCascade?: boolean): Promise<SaveRawLinkmlResult>`
  - `<CompilerStudioDialog />` accessible from the Ontology Header Actions Menu

- [ ] **Step 1: Write failing tests for `getCompiledOntologyStudioDataAction` and `saveRawLinkmlYamlAction` (including syntax error rejection and symbol diff detection)**
      Create `tests/compiler-studio-actions.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/compiler-studio-actions.test.ts`

- [ ] **Step 3: Implement `compiler-studio.ts` server actions and the `/src/features/ontology/components/compiler-studio-dialog/` component suite**
      Include tabs for: **LinkML YAML (Editable)**, **W3C SHACL (`.shacl.ttl`)**, **RDFS (`.rdfs.ttl`)**, **OWL 2 (`.owl.ttl`)**, **Pydantic v2 (`models.py`)**, **JSON Schema**, **Mermaid ER**, and **`ohi.yaml` / `ohi.lock.json`**, with Copy and Download buttons using exact `ohi` suffixes.

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/compiler-studio-actions.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/components/compiler-studio-dialog/ src/features/ontology/components/ontology-header/ src/features/ontology/server/actions/compiler-studio.ts tests/compiler-studio-actions.test.ts`
      `git commit -m "feat(ontology): add LinkML and Code Compiler Studio dialog for SHACL, RDFS, OWL, and Pydantic"`

---

### Slice 4.2: Build `ohi.dev` Package & Dependency Browser UI `open`

**Files:**

- Create: `src/features/ontology/components/standards-browser/standards-browser.tsx`
- Create: `src/features/ontology/components/standards-browser/ohi-package-search-bar.tsx`
- Create: `src/features/ontology/components/standards-browser/ohi-package-card.tsx`
- Create: `src/features/ontology/components/standards-browser/ohi-dependency-tree-preview.tsx`
- Create: `src/features/ontology/components/standards-browser/ohi-lockfile-status-bar.tsx`
- Create: `src/features/ontology/components/standards-browser/types.ts`
- Modify: `src/features/ontology/components/left-browser-panel.tsx`

**Interfaces:**

- Consumes: `searchOhiPackages`, `inspectOhiPublication`, `addReferenceOntology`, `syncReferenceOntology`, `verifyOhiLockfileArtifacts`
- Produces: `<StandardsBrowser />` rendering locked `ohi.yaml` packages, transitive dependencies, SHA-256 verification badges, format selector (`linkml-yaml`, `owl-turtle`, `rdfs-turtle`), and `ohi.dev` catalog search.

- [ ] **Step 1: Implement `/src/features/ontology/components/standards-browser/` subcomponents and wire into `left-browser-panel.tsx`**

- [ ] **Step 2: Run typecheck and lint**
      Run: `npm exec pnpm -- typecheck && npm exec pnpm -- lint`

- [ ] **Step 3: Commit**
      `git add src/features/ontology/components/standards-browser/ src/features/ontology/components/left-browser-panel.tsx`
      `git commit -m "feat(ontology): add ohi.dev package manager and SHA-256 lockfile browser UI"`

---

### Slice 4.3: Integrate LinkML Linter & `ohi` Lockfile Drift into Ontology Issues Drawer `open`

**Files:**

- Modify: `src/features/ontology/utils/linter/`
- Modify: `src/features/ontology/components/ontology-issues-sheet/`
- Modify: `src/features/ontology/README.md`
- Test: `tests/linkml-linter-and-drift-issues.test.ts`

**Interfaces:**

- Consumes: `CompiledOntologyArtifacts["lint_issues"]`, `verifyOhiLockfileArtifacts`
- Produces: Unified defect list combining OOPS! structural rules, `@neverblink/linkml` `LinkML.lint(view)` issues, and `ohi.lock.json` SHA-256 drift warnings.

- [ ] **Step 1: Write failing test for combined LinkML lint + `ohi` lockfile drift issues**
      Create `tests/linkml-linter-and-drift-issues.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-linter-and-drift-issues.test.ts`

- [ ] **Step 3: Update linter engine, `ontology-issues-sheet`, and `src/features/ontology/README.md`**

- [ ] **Step 4: Run full check suite**
      Run: `npm exec pnpm -- check`
      Expected: All lint, typecheck, test, and build checks PASS.

- [ ] **Step 5: Commit**
      `git add src/features/ontology/ tests/linkml-linter-and-drift-issues.test.ts`
      `git commit -m "feat(ontology): surface LinkML compiler lint and ohi lockfile drift in issues drawer"`
