"use client"

import { useMemo } from "react"
import {
  Background,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

interface NeighborhoodGraphDiffProps {
  currentClass: { id: string; name: string }
  oldParentClass?: { id: string; name: string } | null
  newParentClass?: { id: string; name: string } | null
  mergeTargetClass?: { id: string; name: string } | null
  relations?: Array<{
    id: string
    name: string
    otherClassName: string
    direction: "incoming" | "outgoing"
  }>
}

export function NeighborhoodGraphDiff({
  currentClass,
  oldParentClass,
  newParentClass,
  mergeTargetClass,
  relations = [],
}: NeighborhoodGraphDiffProps) {
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = []
    const edgeList: Edge[] = []

    // 1. Current Class Node (Center)
    nodeList.push({
      id: currentClass.id,
      position: { x: 220, y: 130 },
      data: { label: currentClass.name },
      style: {
        background: "hsl(var(--card))",
        color: "hsl(var(--card-foreground))",
        border: "2px solid hsl(var(--primary))",
        borderRadius: "8px",
        padding: "8px 14px",
        fontWeight: 600,
        fontSize: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      },
    })

    // 2. Old Parent Node & Edge (Red dashed)
    if (oldParentClass && oldParentClass.id !== newParentClass?.id) {
      nodeList.push({
        id: `old-${oldParentClass.id}`,
        position: { x: 80, y: 20 },
        data: { label: `${oldParentClass.name} (Previous Parent)` },
        style: {
          background: "hsl(var(--muted))",
          color: "hsl(var(--muted-foreground))",
          border: "1px dashed #ef4444",
          borderRadius: "6px",
          padding: "6px 10px",
          fontSize: "11px",
        },
      })

      edgeList.push({
        id: `edge-old-parent`,
        source: currentClass.id,
        target: `old-${oldParentClass.id}`,
        label: "subClassOf (removed)",
        style: { stroke: "#ef4444", strokeDasharray: "4 4", strokeWidth: 1.5 },
        labelStyle: { fill: "#ef4444", fontSize: "10px", fontWeight: 500 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
      })
    }

    // 3. New Parent Node & Edge (Green solid)
    if (newParentClass) {
      nodeList.push({
        id: `new-${newParentClass.id}`,
        position: { x: 360, y: 20 },
        data: { label: `${newParentClass.name} (Target Parent)` },
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: "2px solid #10b981",
          borderRadius: "6px",
          padding: "6px 10px",
          fontSize: "11px",
        },
      })

      edgeList.push({
        id: `edge-new-parent`,
        source: currentClass.id,
        target: `new-${newParentClass.id}`,
        label: "subClassOf (added)",
        style: { stroke: "#10b981", strokeWidth: 2 },
        labelStyle: { fill: "#10b981", fontSize: "10px", fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
      })
    }

    // 4. Merge Target Node & Edge (Purple dashed)
    if (mergeTargetClass) {
      nodeList.push({
        id: `merge-${mergeTargetClass.id}`,
        position: { x: 440, y: 130 },
        data: { label: `${mergeTargetClass.name} (Merged Target)` },
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: "2px solid #8b5cf6",
          borderRadius: "6px",
          padding: "8px 12px",
          fontSize: "11px",
          fontWeight: 600,
        },
      })

      edgeList.push({
        id: `edge-merge-target`,
        source: currentClass.id,
        target: `merge-${mergeTargetClass.id}`,
        label: "merge into",
        style: { stroke: "#8b5cf6", strokeDasharray: "5 5", strokeWidth: 2 },
        labelStyle: { fill: "#8b5cf6", fontSize: "10px", fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
      })
    }

    // 5. Neighbor Relations (Sample)
    const sampledRelations = relations.slice(0, 3)
    sampledRelations.forEach((rel, index) => {
      const neighborId = `neighbor-${rel.id}`
      const x = 120 + index * 160
      const y = 240

      nodeList.push({
        id: neighborId,
        position: { x, y },
        data: { label: rel.otherClassName },
        style: {
          background: "hsl(var(--muted)/40)",
          color: "hsl(var(--muted-foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "6px",
          padding: "4px 8px",
          fontSize: "10px",
        },
      })

      const isOutgoing = rel.direction === "outgoing"
      edgeList.push({
        id: `rel-${rel.id}`,
        source: isOutgoing ? currentClass.id : neighborId,
        target: isOutgoing ? neighborId : currentClass.id,
        label: rel.name,
        style: { stroke: "hsl(var(--muted-foreground)/60)", strokeWidth: 1.2 },
        labelStyle: {
          fill: "hsl(var(--muted-foreground))",
          fontSize: "9px",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--muted-foreground)/60)",
        },
      })
    })

    return { nodes: nodeList, edges: edgeList }
  }, [
    currentClass,
    oldParentClass,
    newParentClass,
    mergeTargetClass,
    relations,
  ])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span className="font-medium">
          Neighborhood Structural Diff Preview
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full bg-emerald-500" />
            Added
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full bg-red-500" />
            Removed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full bg-purple-500" />
            Merged
          </span>
        </div>
      </div>

      <div className="relative h-[220px] w-full overflow-hidden rounded-lg border bg-muted/10">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
        >
          <Background gap={14} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}
