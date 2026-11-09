"use client"

import { useMemo } from "react"
import { Network } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { AnalystSubgraph } from "../../types"
import { getKindStyles, SubgraphFlowView } from "./subgraph-flow-view"

export interface AnalystSubgraphModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subgraph: AnalystSubgraph | null
  inline?: boolean
  className?: string
  "data-testid"?: string
}

export function AnalystSubgraphModal({
  open,
  onOpenChange,
  subgraph,
  inline = false,
  className,
  "data-testid": dataTestId = "analyst-subgraph-modal",
}: AnalystSubgraphModalProps) {
  const nodes = useMemo(() => subgraph?.nodes ?? [], [subgraph?.nodes])
  const edges = useMemo(() => subgraph?.edges ?? [], [subgraph?.edges])
  const nodeCount = nodes.length
  const edgeCount = edges.length

  const distinctKinds = useMemo(() => {
    const kinds = new Set<string>()
    for (const node of nodes) {
      if (node.kind) {
        kinds.add(node.kind)
      }
    }
    return Array.from(kinds)
  }, [nodes])

  const headerContent = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">
            Reasoning Subgraph
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="text-[11px] font-normal"
            data-testid="subgraph-node-count-badge"
          >
            {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
          </Badge>
          <Badge
            variant="outline"
            className="text-[11px] font-normal"
            data-testid="subgraph-edge-count-badge"
          >
            {edgeCount} {edgeCount === 1 ? "edge" : "edges"}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Interactive visualization of the entities and relations traversed to
        answer this query.
      </p>
    </>
  )

  const footerContent = (
    <>
      <div
        className="flex flex-wrap items-center gap-1.5"
        data-testid="subgraph-kind-legend"
      >
        <span className="text-[11px] font-medium text-muted-foreground">
          Legend:
        </span>
        {distinctKinds.length > 0 ? (
          distinctKinds.map((kind) => {
            const styles = getKindStyles(kind)
            return (
              <span
                key={kind}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  styles.badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                {kind}
              </span>
            )
          })
        ) : (
          <span className="text-[10px] text-muted-foreground">
            No entity kinds
          </span>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(false)}
        className="h-8 text-xs"
      >
        Close
      </Button>
    </>
  )

  if (inline) {
    return (
      <div
        className={cn(
          "flex w-full max-w-4xl flex-col gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
          className
        )}
        data-testid={dataTestId}
      >
        <div className="flex flex-col gap-1.5 text-left">{headerContent}</div>

        <div className="min-h-[400px] w-full">
          <SubgraphFlowView nodes={nodes} edges={edges} />
        </div>

        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          {footerContent}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex max-w-4xl flex-col gap-4 p-6", className)}
        data-testid={dataTestId}
      >
        <DialogHeader className="flex flex-col gap-1.5 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <DialogTitle className="text-sm font-semibold tracking-tight">
                Reasoning Subgraph
              </DialogTitle>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="text-[11px] font-normal"
                data-testid="subgraph-node-count-badge"
              >
                {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
              </Badge>
              <Badge
                variant="outline"
                className="text-[11px] font-normal"
                data-testid="subgraph-edge-count-badge"
              >
                {edgeCount} {edgeCount === 1 ? "edge" : "edges"}
              </Badge>
            </div>
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            Interactive visualization of the entities and relations traversed to
            answer this query.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[400px] w-full">
          <SubgraphFlowView nodes={nodes} edges={edges} />
        </div>

        <DialogFooter className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
