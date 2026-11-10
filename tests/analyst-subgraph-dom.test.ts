import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import React from "react"

import type {
  AnalystSubgraph,
  AnalystSubgraphEdge,
  AnalystSubgraphNode,
} from "../src/features/analyst/types"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

if (isChildTest || !isReactServer) {
  const { renderToStaticMarkup } = await import("react-dom/server")

  // Test 1: SubgraphFlowView empty state
  test("SubgraphFlowView renders empty state when nodes are empty", async () => {
    const { SubgraphFlowView } =
      await import("../src/features/analyst/components/subgraph-preview/subgraph-flow-view")

    const html = renderToStaticMarkup(
      React.createElement(SubgraphFlowView, {
        nodes: [],
        edges: [],
      })
    )

    assert.ok(
      html.includes("No Subgraph Available"),
      "Must render empty state heading when no nodes exist"
    )
    assert.ok(
      html.includes("does not contain any traversed graph entities"),
      "Must render descriptive empty state text"
    )
    assert.ok(
      html.includes('data-testid="subgraph-flow-empty"'),
      "Must include subgraph-flow-empty testid"
    )
  })

  // Test 2: SubgraphFlowView with custom nodes and edges
  test("SubgraphFlowView renders custom nodes with kind badges, metadata preview, and edge elements", async () => {
    const { SubgraphFlowView } =
      await import("../src/features/analyst/components/subgraph-preview/subgraph-flow-view")

    const nodes: AnalystSubgraphNode[] = [
      {
        id: "n1",
        label: "Baltic Marine Institute",
        kind: "Organization",
        metadata: { country: "Finland", founded: 1982 },
      },
      {
        id: "n2",
        label: "Gulf of Finland",
        kind: "Location",
        metadata: { depth: "55m" },
      },
    ]

    const edges: AnalystSubgraphEdge[] = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        label: "monitors",
      },
    ]

    const html = renderToStaticMarkup(
      React.createElement(SubgraphFlowView, {
        nodes,
        edges,
      })
    )

    assert.ok(
      html.includes("Baltic Marine Institute"),
      "Must render source node label"
    )
    assert.ok(html.includes("Gulf of Finland"), "Must render target node label")
    assert.ok(
      html.includes("Organization"),
      "Must render Organization kind badge"
    )
    assert.ok(html.includes("Location"), "Must render Location kind badge")
    assert.ok(html.includes("country"), "Must render metadata key in preview")
    assert.ok(html.includes("Finland"), "Must render metadata value in preview")
    assert.ok(
      html.includes('data-testid="subgraph-flow-canvas"'),
      "Must render graph canvas container"
    )
  })

  // Test 3: AnalystSubgraphModal rendering modal with nodes and edges
  test("AnalystSubgraphModal renders header title, node/edge count badges, legend, and close button", async () => {
    const { AnalystSubgraphModal } =
      await import("../src/features/analyst/components/subgraph-preview/analyst-subgraph-modal")

    const subgraph: AnalystSubgraph = {
      nodes: [
        {
          id: "n1",
          label: "Baltic Marine Institute",
          kind: "Organization",
          metadata: { country: "Finland" },
        },
        {
          id: "n2",
          label: "Gulf of Finland",
          kind: "Location",
        },
      ],
      edges: [
        {
          id: "e1",
          source: "n1",
          target: "n2",
          label: "monitors",
        },
      ],
    }

    const html = renderToStaticMarkup(
      React.createElement(AnalystSubgraphModal, {
        open: true,
        inline: true,
        subgraph,
        onOpenChange: () => {},
      })
    )

    assert.ok(
      html.includes("Reasoning Subgraph"),
      "Must render modal header title"
    )
    assert.ok(html.includes("2 nodes"), "Must display node count badge")
    assert.ok(html.includes("1 edge"), "Must display edge count badge")
    assert.ok(
      html.includes(
        "Interactive visualization of the entities and relations traversed to answer this query."
      ),
      "Must render description text"
    )
    assert.ok(
      html.includes("Baltic Marine Institute"),
      "Must render node in canvas"
    )
    assert.ok(
      html.includes("Organization") && html.includes("Location"),
      "Must render distinct kinds in footer legend"
    )
    assert.ok(
      html.includes("min-h-[500px]"),
      "Must render min-h-[500px] for full canvas height"
    )
    assert.ok(html.includes("Close"), "Must render close button in footer")
  })

  // Test 4: AnalystSubgraphModal handles null and empty subgraph gracefully
  test("AnalystSubgraphModal handles null or empty subgraph gracefully", async () => {
    const { AnalystSubgraphModal } =
      await import("../src/features/analyst/components/subgraph-preview/analyst-subgraph-modal")

    // Case A: null subgraph
    const nullHtml = renderToStaticMarkup(
      React.createElement(AnalystSubgraphModal, {
        open: true,
        inline: true,
        subgraph: null,
        onOpenChange: () => {},
      })
    )

    assert.ok(
      nullHtml.includes("0 nodes"),
      "Must display 0 nodes for null subgraph"
    )
    assert.ok(
      nullHtml.includes("0 edges"),
      "Must display 0 edges for null subgraph"
    )
    assert.ok(
      nullHtml.includes("No Subgraph Available"),
      "Must render empty state canvas when subgraph is null"
    )
    assert.ok(
      nullHtml.includes("No entity kinds"),
      "Must handle empty legend when no nodes present"
    )

    // Case B: empty arrays subgraph
    const emptyHtml = renderToStaticMarkup(
      React.createElement(AnalystSubgraphModal, {
        open: true,
        inline: true,
        subgraph: { nodes: [], edges: [] },
        onOpenChange: () => {},
      })
    )

    assert.ok(
      emptyHtml.includes("0 nodes"),
      "Must display 0 nodes for empty subgraph"
    )
    assert.ok(
      emptyHtml.includes("0 edges"),
      "Must display 0 edges for empty subgraph"
    )
  })

  // Test 5: computeSubgraphLayout layout computation with sample data
  test("computeSubgraphLayout arranges nodes with dagre and computes directional handles", async () => {
    const { computeSubgraphLayout } =
      await import("../src/features/analyst/components/subgraph-preview/subgraph-flow-view")

    const sampleNodes: AnalystSubgraphNode[] = [
      { id: "inst-1", label: "University of Helsinki", kind: "Organization" },
      { id: "loc-1", label: "Gulf of Finland", kind: "Location" },
      {
        id: "station-1",
        label: "Tvärminne Zoological Station",
        kind: "Location",
      },
    ]

    const sampleEdges: AnalystSubgraphEdge[] = [
      {
        id: "e1",
        source: "inst-1",
        target: "loc-1",
        label: "conductsResearchIn",
      },
      {
        id: "e2",
        source: "loc-1",
        target: "station-1",
        label: "containsStation",
      },
    ]

    const { nodes, edges } = computeSubgraphLayout(
      sampleNodes,
      sampleEdges,
      "LR"
    )

    assert.equal(nodes.length, 3, "Must produce 3 positioned flow nodes")
    assert.equal(edges.length, 2, "Must produce 2 styled flow edges")

    for (const node of nodes) {
      assert.ok(
        typeof node.position.x === "number" && !Number.isNaN(node.position.x),
        `Node ${node.id} must have numeric X coordinate`
      )
      assert.ok(
        typeof node.position.y === "number" && !Number.isNaN(node.position.y),
        `Node ${node.id} must have numeric Y coordinate`
      )
      assert.equal(node.type, "subgraphNode", "Node type must be subgraphNode")
    }

    // In LR direction, source node should precede target node on X axis
    const instNode = nodes.find((n) => n.id === "inst-1")!
    const locNode = nodes.find((n) => n.id === "loc-1")!
    const stationNode = nodes.find((n) => n.id === "station-1")!

    assert.ok(
      instNode.position.x < locNode.position.x,
      "inst-1 should be to the left of loc-1"
    )
    assert.ok(
      locNode.position.x < stationNode.position.x,
      "loc-1 should be to the left of station-1"
    )

    // Verify edge styling and handle assignment
    const edge1 = edges.find((e) => e.id === "e1")!
    assert.equal(edge1.type, "smoothstep", "Edge type must be smoothstep")
    assert.equal(
      edge1.sourceHandle,
      "s-right",
      "LR source handle should be s-right"
    )
    assert.equal(
      edge1.targetHandle,
      "t-left",
      "LR target handle should be t-left"
    )
    assert.ok(edge1.markerEnd, "Edge must have markerEnd arrow configured")

    // Single-node handling
    const singleResult = computeSubgraphLayout(
      [{ id: "solo", label: "Solo Entity", kind: "Concept" }],
      []
    )
    assert.equal(
      singleResult.nodes.length,
      1,
      "Single node graph must produce 1 node"
    )
    assert.equal(
      singleResult.edges.length,
      0,
      "Single node graph must produce 0 edges"
    )
    assert.ok(typeof singleResult.nodes[0].position.x === "number")

    // Empty graph handling
    const emptyResult = computeSubgraphLayout([], [])
    assert.equal(emptyResult.nodes.length, 0)
    assert.equal(emptyResult.edges.length, 0)
  })
}

// Test 6: AnalystShell references and wires AnalystSubgraphModal
test("AnalystShell imports and embeds AnalystSubgraphModal with props", () => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/analyst-shell/analyst-shell.tsx"
  )
  const content = fs.readFileSync(shellPath, "utf-8")

  assert.ok(
    content.includes("AnalystSubgraphModal"),
    "AnalystShell must import and embed AnalystSubgraphModal"
  )
  assert.ok(
    content.includes('from "../subgraph-preview/analyst-subgraph-modal"'),
    "AnalystShell must import AnalystSubgraphModal from subgraph-preview folder"
  )
  assert.ok(
    content.includes("open={isSubgraphModalOpen}"),
    "AnalystShell must bind open prop to isSubgraphModalOpen"
  )
  assert.ok(
    content.includes("onOpenChange={setIsSubgraphModalOpen}"),
    "AnalystShell must bind onOpenChange to setIsSubgraphModalOpen"
  )
  assert.ok(
    content.includes("subgraph={activeSubgraph}"),
    "AnalystShell must pass activeSubgraph to subgraph prop"
  )
})

// Test 7: AnalystSubgraphModal fullscreen layout requirements
test("AnalystSubgraphModal conforms to fullscreen viewport layout requirements", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx"
  )
  assert.ok(fs.existsSync(modalPath), "analyst-subgraph-modal.tsx must exist")
  const modalContent = fs.readFileSync(modalPath, "utf-8")

  assert.ok(
    modalContent.includes('viewport="fullscreen"'),
    "AnalystSubgraphModal must use DialogContent with viewport='fullscreen'"
  )
  assert.ok(
    modalContent.includes("flex-1") &&
      modalContent.includes("min-h-[500px]") &&
      modalContent.includes("h-full"),
    "AnalystSubgraphModal must expand canvas with flex-1 h-full min-h-[500px]"
  )
})

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for SubgraphFlowView and AnalystSubgraphModal via tsx runner", () => {
    const tsxCli = path.resolve(
      process.cwd(),
      "node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs"
    )
    const fallbackCli = path.resolve(
      process.cwd(),
      "node_modules/tsx/dist/cli.mjs"
    )
    const cliToUse = fs.existsSync(fallbackCli) ? fallbackCli : tsxCli

    const testFile = path.resolve(
      process.cwd(),
      "tests/analyst-subgraph-dom.test.ts"
    )
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CHILD_REACT_DOM_TEST: "1",
    }
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith("NODE_TEST_")) {
        delete childEnv[key]
      }
    }

    const output = execFileSync(
      process.execPath,
      [cliToUse, "--test", testFile],
      {
        encoding: "utf-8",
        env: childEnv,
      }
    )
    assert.ok(
      output.includes("pass") || output.includes("ok"),
      "Child client DOM rendering tests must pass"
    )
    assert.ok(
      !output.includes("fail 1"),
      "Child client DOM tests must have 0 failures"
    )
  })
}
