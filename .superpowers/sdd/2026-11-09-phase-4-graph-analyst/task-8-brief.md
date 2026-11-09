# Task 8: Interactive React Flow Subgraph Visualizer

**Files:**

- Create: `src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx`
- Create: `src/features/analyst/components/subgraph-preview/subgraph-flow-view.tsx`
- Create: `tests/analyst-subgraph-dom.test.ts`

## Instructions

1. **`src/features/analyst/components/subgraph-preview/subgraph-flow-view.tsx`**:
   - Client component rendering React Flow canvas (`@xyflow/react`):
     - Uses `dagre` layout to arrange nodes and edges cleanly.
     - Custom or styled nodes with entity label, kind/class badge, and attribute summary.
     - Styled edges with relation label and directional arrows.
     - Controls (ZoomIn, ZoomOut, FitView) and MiniMap or Background.
     - Handles empty or single-node graphs gracefully.

2. **`src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx`**:
   - Dialog component displaying:
     - Header: "Reasoning Subgraph" with node count and edge count badges.
     - Description: "Interactive visualization of the entities and relations traversed to answer this query."
     - Canvas container rendering `<SubgraphFlowView nodes={...} edges={...} />`.
     - Footer: Legend explaining node kinds and close button.

3. **`tests/analyst-subgraph-dom.test.ts`**:
   - Test rendering of subgraph modal with nodes and edges.
   - Test layout computation with sample data.

4. Commit:
   `git add src/features/analyst/components/subgraph-preview/ tests/analyst-subgraph-dom.test.ts`
   `git commit -m "feat(analyst): add interactive React Flow subgraph visualizer for query paths"`
