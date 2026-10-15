---
feature: ontology
status: active
purpose: Create, inspect, document, import, JSON/OWL export, and visualize ontology documents, modules, classes, relations, and attributes.
scope:
  - ontology document import and selection
  - ontology document JSON and OWL export with dependency review
  - module create, import, export, rename, duplicate, and delete flows
  - module, class, relation, and attribute metadata authoring
  - class, relation, relation attribute, and attribute CRUD
  - browser/detail views and React Flow canvas state
  - persisted layout and class-position state for visual mode and JSON round-trips
  - AI-assisted ontology draft generation and staged review from competency questions
  - reference vocabularies and standard ontology indexing (OLS4 & LOV)
  - zero-cost local vector similarity matching and semantic entity alignment
  - real-time in-memory ontology defect linter and OOPS! pitfall mapping engine
  - defect suppressions persistence and quick-fix actions (clearing parent cycles, pruning dangling relations)
  - contextual defect warning callouts in detail views and visual canvas node badges
  - AI generation guardrails and OWL export pre-flight linter diagnostics notes scaffolding
entry_points:
  - path: src/app/ontology/page.tsx
    purpose: Server route that resolves the active ontology document and initial data.
  - path: src/features/ontology/components/ontology-shell/ontology-shell.tsx
    purpose: Client shell that coordinates browser, detail, visual, and ontology metadata dialog regions.
server_entry_points:
  - path: src/features/ontology/server/queries/
    purpose: Focused read layer and client-callable query functions for ontology documents, structure, metadata, reference ontologies, and saved layout state.
  - path: src/features/ontology/server/actions/
    purpose: Focused write actions for ontology CRUD, JSON import/export, module transfer, visual layout persistence, atomic class reconciliation, and reference vocabularies sync.
  - path: src/features/ontology/server/actions/generate-ontology.ts
    purpose: AI-assisted ontology draft generation from competency questions with local vector grounding, contextual expansion, and transactional persistence.
  - path: src/features/ontology/server/services/ai-relation-reconciliation.ts
    purpose: On-demand AI relation reconciliation and property remapping suggestion service using Gemini.
  - path: src/features/ontology/utils/linter/
    purpose: Pure TypeScript defect linter rule engine, OOPS! pitfall taxonomy, and in-memory health analysis.
update_this_readme_when:
  - route composition changes
  - shell or canvas flow changes
  - new subareas are added under this feature
---

# Ontology

## Domain Concepts

- `ontology document`: top-level ontology version loaded in the feature
- `group scope`: every ontology document belongs to one access group and is only visible within that group
- `shared workspace`: unprotected local mode and protected shared-password mode use `shared`; configured password groups remain separate
- `module`: group of related ontology classes inside a document, with its own overview metadata surface
- `class`: entity type definition used by documents and relations
- `attribute`: structured field attached to a class
- `relation`: typed edge between a domain class and a range class
- `relation attribute`: structured field attached to a relation/fact edge
- `localized text`: editor-only translation for ontology metadata fields
- `note`: timestamped, author-labelled annotation attached to ontology, module, class, relation, CQ, or attribute targets
- `example`: sample value or triple attached to class, relation, CQ, or attribute targets; class and relation examples can be marked as allowed candidates and CQs can pin subject, predicate, and object examples
- `class position`: saved node position for visual mode
- `module layout`: saved module bounds for the canvas
- `export dependency`: class or relation reference that crosses the current export selection and needs an explicit decision
- `reference ontology`: external vocabulary or standard ontology (e.g. SOSA/SSN, ENVO, Schema.org) cached locally from OLS4/LOV
- `vector alignment`: zero-cost local 384-d semantic embedding matching suggesting reuse, subClassOf, or equivalence for entities
- `contextual graph closure`: Option B automatic discovery of direct parents and linked relations for adopted standard terms
- `adopt class reconciliation`: in-place transformation of existing classes to standard terms without UUID churn or canvas layout disruption, with interactive remapping/deletion of connected relations and attribute retention controls
- `defect linter`: real-time in-memory TypeScript rule engine mapping structural pitfalls to standard OOPS! codes (P29 cycles, P10 dangling edges, P04 orphan nodes, P24 duplicates, P11 inverse mismatch, P08 missing docs, P28 competing patterns)
- `defect suppression`: per-ontology persistence of dismissed or accepted defect IDs in `ontologyDefectSuppressions`
- `OWL export diagnostics`: pre-flight validation scaffolding that attaches diagnostic summary notes and pitfall warnings into RDF/OWL `rdfs:comment` annotations

## Flow

1. `src/app/ontology/page.tsx` resolves the active ontology document and its related data on the server.
2. `OntologyShell` switches between browser mode and visual mode while keeping module and selection state local.
3. `module-tab-bar.tsx` handles module switching plus module-scoped overview, create/import, rename, duplicate, export, and delete actions.
4. `left-browser-panel.tsx` wraps class, relation, and reference standard vocabulary browsing through `EntityTypeTabs` when the shell is in browser mode.
5. `visual-region.tsx` renders `OntologyCanvas` for React Flow editing and selection when the shell is in visual mode, including class example previews on nodes, selected relation example previews on edges, and defect warning markers on class nodes.
   Manual node and module moves stay local in the canvas state immediately and persist in the background without re-fitting the viewport on each drag save.
6. `ontology-header.tsx` handles ontology creation, JSON import, import-format guidance, export dialog entry points, and renders `ontology-defects-pill.tsx`.
7. `selection.ts` resolves class/relation selections, while `OntologyShell` also tracks explicit module overview selection.
8. `detail-panel-shell.tsx` hosts tabbed class, relation, or module detail views with metadata editors for translations, notes, examples, instance rules, relation attributes, contextual defect callout banners, and inline competency-question authoring in the ontology details dialog.
9. Server actions persist ontology structure changes, metadata rows, saved visual layout state, JSON round-trips, and OWL export generation.
10. `ontology-defects-pill.tsx` displays real-time defect counts in the header, opening `ontology-defects-sheet.tsx` for inspecting, quick-fixing, and suppressing defects. Canvas nodes highlight active defect markers and detail panels show contextual banners.
11. OWL export runs pre-flight validation and injects linter diagnostic notes into the exported ontology comments.

## Constraints

- when a component needs subcomponents, prefer a folder like `components/<name>/<name>.tsx` for new work and keep related parts in separate files
- all server reads and writes in this feature must stay scoped to the current access group via the root `ontology document`
