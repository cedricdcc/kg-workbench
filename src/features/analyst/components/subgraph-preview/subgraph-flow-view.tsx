"use client"

import { useMemo } from "react"
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { Network } from "lucide-react"

if (typeof window !== "undefined") {
  import("@xyflow/react/dist/style.css")
}

import { layoutWithDagre, selectHandles } from "@/lib/flow-layout"
import { cn } from "@/lib/utils"
import type { AnalystSubgraphEdge, AnalystSubgraphNode } from "../../types"

export interface KindStyle {
  badge: string
  dot: string
  border: string
}

/**
 * Returns distinct badge, dot, and border styling for entity kinds
 * (e.g., Organization, Location, Person, Concept, Dataset).
 */
export function getKindStyles(kind?: string): KindStyle {
  const normalized = (kind || "").toLowerCase().trim()

  if (
    normalized.includes("org") ||
    normalized.includes("institution") ||
    normalized.includes("company") ||
    normalized.includes("agency")
  ) {
    return {
      badge:
        "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
      dot: "bg-blue-500",
      border: "border-blue-500/30",
    }
  }

  if (
    normalized.includes("loc") ||
    normalized.includes("place") ||
    normalized.includes("geo") ||
    normalized.includes("country") ||
    normalized.includes("city") ||
    normalized.includes("sea") ||
    normalized.includes("gulf") ||
    normalized.includes("station")
  ) {
    return {
      badge:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
      dot: "bg-emerald-500",
      border: "border-emerald-500/30",
    }
  }

  if (
    normalized.includes("person") ||
    normalized.includes("author") ||
    normalized.includes("researcher") ||
    normalized.includes("scientist")
  ) {
    return {
      badge:
        "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      dot: "bg-amber-500",
      border: "border-amber-500/30",
    }
  }

  if (
    normalized.includes("concept") ||
    normalized.includes("topic") ||
    normalized.includes("theme") ||
    normalized.includes("property")
  ) {
    return {
      badge:
        "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
      dot: "bg-purple-500",
      border: "border-purple-500/30",
    }
  }

  if (
    normalized.includes("data") ||
    normalized.includes("dataset") ||
    normalized.includes("table") ||
    normalized.includes("record")
  ) {
    return {
      badge:
        "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25",
      dot: "bg-cyan-500",
      border: "border-cyan-500/30",
    }
  }

  if (
    normalized.includes("event") ||
    normalized.includes("measurement") ||
    normalized.includes("sample") ||
    normalized.includes("observation")
  ) {
    return {
      badge:
        "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
      dot: "bg-rose-500",
      border: "border-rose-500/30",
    }
  }

  return {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    border: "border-border",
  }
}

export interface SubgraphNodeData extends Record<string, unknown> {
  label: string
  kind: string
  metadata?: Record<string, unknown>
}

const H = "!h-1.5 !w-1.5 !border-0 !bg-muted-foreground/40"

/**
 * Custom node component rendering entity label, kind badge, and attributes preview.
 */
export function SubgraphNodeComponent({
  data,
}: NodeProps<Node<SubgraphNodeData>>) {
  const { label, kind, metadata } = data
  const kindStyles = getKindStyles(kind)
  const metaEntries = metadata ? Object.entries(metadata) : []

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="t-left"
        className={H}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="t-right"
        className={H}
      />
      <Handle type="target" position={Position.Top} id="t-top" className={H} />
      <Handle
        type="target"
        position={Position.Bottom}
        id="t-bottom"
        className={H}
      />

      <div
        className={cn(
          "relative flex flex-col justify-between rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md",
          kindStyles.border
        )}
        style={{ width: 200, minHeight: 64 }}
        data-testid={`subgraph-node-${label}`}
      >
        {/* Top: Kind Badge */}
        <div className="flex items-center justify-between gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] leading-none font-medium",
              kindStyles.badge
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", kindStyles.dot)} />
            <span className="max-w-[140px] truncate">{kind || "Entity"}</span>
          </span>
        </div>

        {/* Entity Label */}
        <div
          className="mt-1.5 truncate text-xs font-semibold text-foreground"
          title={label}
        >
          {label}
        </div>

        {/* Attributes Preview (Metadata) */}
        {metaEntries.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5 border-t border-border/60 pt-1 text-[10px] text-muted-foreground">
            {metaEntries.slice(0, 2).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-1 truncate"
              >
                <span className="font-medium text-muted-foreground/80">
                  {k}:
                </span>
                <span className="max-w-[110px] truncate" title={String(v)}>
                  {String(v)}
                </span>
              </div>
            ))}
            {metaEntries.length > 2 && (
              <span className="text-[9px] text-muted-foreground/70">
                +{metaEntries.length - 2} more attribute
                {metaEntries.length - 2 > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Left}
        id="s-left"
        className={H}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="s-right"
        className={H}
      />
      <Handle type="source" position={Position.Top} id="s-top" className={H} />
      <Handle
        type="source"
        position={Position.Bottom}
        id="s-bottom"
        className={H}
      />
    </>
  )
}

const nodeTypes = {
  subgraphNode: SubgraphNodeComponent,
}

export interface SubgraphLayoutResult {
  nodes: Node<SubgraphNodeData>[]
  edges: Edge[]
}

/**
 * Computes dagre layout positions and directional handles for nodes and edges.
 */
export function computeSubgraphLayout(
  nodes: AnalystSubgraphNode[],
  edges: AnalystSubgraphEdge[],
  direction: "LR" | "TB" = "LR"
): SubgraphLayoutResult {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  const initialNodes: Node<SubgraphNodeData>[] = nodes.map((node) => ({
    id: node.id,
    type: "subgraphNode",
    data: {
      label: node.label,
      kind: node.kind,
      metadata: node.metadata,
    },
    position: { x: 0, y: 0 },
  }))

  const nodeIds = new Set(nodes.map((n) => n.id))
  const validEdges = (edges || []).filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  )

  const initialEdges: Edge[] = validEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
  }))

  const positionedNodes = layoutWithDagre(
    initialNodes,
    initialEdges,
    direction
  ) as Node<SubgraphNodeData>[]

  const posMap = new Map<string, { x: number; y: number }>()
  for (const n of positionedNodes) {
    posMap.set(n.id, n.position)
  }

  const styledEdges: Edge[] = validEdges.map((edge) => {
    const sPos = posMap.get(edge.source)
    const tPos = posMap.get(edge.target)
    const { sourceHandle, targetHandle } =
      sPos && tPos
        ? selectHandles(sPos.x, sPos.y, tPos.x, tPos.y)
        : { sourceHandle: "s-right", targetHandle: "t-left" }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      label: edge.label,
      type: "smoothstep",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: "hsl(var(--muted-foreground))",
      },
      style: {
        stroke: "hsl(var(--muted-foreground) / 0.7)",
        strokeWidth: 1.5,
      },
      labelStyle: {
        fill: "hsl(var(--foreground))",
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: "hsl(var(--background))",
        fillOpacity: 0.95,
        stroke: "hsl(var(--border))",
        strokeWidth: 1,
        rx: 4,
        ry: 4,
      },
      labelBgPadding: [6, 2],
    }
  })

  return { nodes: positionedNodes, edges: styledEdges }
}

export interface SubgraphFlowViewProps {
  nodes?: AnalystSubgraphNode[]
  edges?: AnalystSubgraphEdge[]
  className?: string
  direction?: "LR" | "TB"
}

/**
 * Interactive React Flow canvas for reasoning subgraphs with responsive container,
 * controls, background, and empty-state fallback.
 */
export function SubgraphFlowView({
  nodes = [],
  edges = [],
  className,
  direction = "LR",
}: SubgraphFlowViewProps) {
  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () => computeSubgraphLayout(nodes, edges, direction),
    [nodes, edges, direction]
  )

  if (!nodes || nodes.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[450px] min-h-[400px] w-full flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center text-muted-foreground",
          className
        )}
        data-testid="subgraph-flow-empty"
      >
        <Network className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">No Subgraph Available</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          This reasoning step does not contain any traversed graph entities or
          relations.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative h-[450px] min-h-[400px] w-full overflow-hidden rounded-lg border bg-background/50",
        className
      )}
      data-testid="subgraph-flow-canvas"
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        zoomOnScroll={true}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={16} size={1} className="bg-muted/10" />
        <Controls
          showInteractive={false}
          className="rounded border bg-card text-card-foreground shadow-xs"
        />
      </ReactFlow>
    </div>
  )
}
