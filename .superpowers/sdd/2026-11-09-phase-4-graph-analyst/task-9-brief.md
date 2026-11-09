# Task 9: Contradictions & Semantic Drift View

**Files:**

- Create: `src/features/analyst/components/contradictions-view/contradictions-tab.tsx`
- Create: `src/features/analyst/components/contradictions-view/contradiction-card.tsx`
- Create: `src/features/analyst/components/contradictions-view/resolve-dialog.tsx`
- Create: `tests/analyst-contradictions-dom.test.ts`

## Instructions

1. **`src/features/analyst/components/contradictions-view/contradictions-tab.tsx`**:
   - Filter bar: status filter (All, Open, Resolved, Dismissed) and search input.
   - Run Drift Analysis trigger button (invokes `runDriftAnalysisAction`).
   - List of `ContradictionCard` items.
   - Empty state when no contradictions are found ("Knowledge Graph is coherent: no conflicting assertions detected").

2. **`src/features/analyst/components/contradictions-view/contradiction-card.tsx`**:
   - Header with entity label, relation name badge, and conflict type pill (`value_mismatch`, `temporal_drift`, `negation`).
   - Side-by-side comparison:
     - Fact A card: value, document/table source title, quote text / anchor.
     - Fact B card: value, document/table source title, quote text / anchor.
   - Explanation text highlighting the conflict.
   - Status badge and action button "Resolve Conflict" opening `ResolveDialog`.

3. **`src/features/analyst/components/contradictions-view/resolve-dialog.tsx`**:
   - Options to resolve:
     - "Keep Statement A (Mark B as invalid)"
     - "Keep Statement B (Mark A as invalid)"
     - "Dismiss as Compatible (Both valid in context)"
   - Optional notes input.
   - Submit calls `resolveContradictionAction`.

4. **`tests/analyst-contradictions-dom.test.ts`**:
   - Test contradiction card rendering side-by-side comparison and conflict pills.
   - Test resolve dialog action triggering.

5. Commit:
   `git add src/features/analyst/components/contradictions-view/ tests/analyst-contradictions-dom.test.ts`
   `git commit -m "feat(analyst): implement contradiction management and drift resolution UI"`
