"use client"

import { useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  GitMerge,
  Layers,
  Link2,
  Loader2,
  Sparkles,
  Workflow,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { mergeClasses } from "@/features/ontology/server/actions/class-refactoring"
import { mapClassToStandardParent } from "@/features/ontology/server/actions/reference-vocabularies"
import type {
  ClassAlignment,
  RedundancyCluster,
} from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

export type ExamplePreviewTarget =
  | { type: "redundancy"; cluster: RedundancyCluster }
  | { type: "alignment"; alignment: ClassAlignment }

interface RefactorExamplePreviewDialogProps {
  ontologyId: string
  target: ExamplePreviewTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  onOpenStudio?: (classId: string) => void
}

export function RefactorExamplePreviewDialog({
  ontologyId,
  target,
  open,
  onOpenChange,
  onSuccess,
  onOpenStudio,
}: RefactorExamplePreviewDialogProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [selectedTargetClassId, setSelectedTargetClassId] = useState<string>("")

  if (!target) return null

  // Redundancy handling
  const isRedundancy = target.type === "redundancy"
  const cluster = isRedundancy ? target.cluster : null

  // Choose canonical default (e.g. shortest name or first class)
  const defaultTargetId =
    cluster && cluster.classIds.length > 0 ? cluster.classIds[0] : ""
  const currentTargetId = selectedTargetClassId || defaultTargetId

  // Alignment handling
  const isAlignment = target.type === "alignment"
  const alignment = isAlignment ? target.alignment : null

  async function handleApplyRedundancyMerge() {
    if (!cluster || !currentTargetId) return
    setIsApplying(true)
    try {
      const sourceIds = cluster.classIds.filter((id) => id !== currentTargetId)
      let totalMigrated = 0

      for (const srcId of sourceIds) {
        const res = await mergeClasses({
          ontologyId,
          sourceClassId: srcId,
          targetClassId: currentTargetId,
          retainedAttributeIds: [],
        })
        totalMigrated += res.migratedRelations
      }

      toast.success(
        `Merged ${sourceIds.length} redundant class(es). Re-routed ${totalMigrated} relation(s).`
      )
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply merge."
      toast.error(msg)
    } finally {
      setIsApplying(false)
    }
  }

  async function handleApplyAlignment() {
    if (!alignment) return
    setIsApplying(true)
    try {
      await mapClassToStandardParent(ontologyId, alignment.classId, {
        curie: alignment.candidateCurie,
        label: alignment.candidateLabel,
        description: `Aligned standard term (${alignment.candidateCurie})`,
      })
      toast.success(
        `Linked "${alignment.className}" as subclass of "${alignment.candidateCurie}".`
      )
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to align standard class."
      toast.error(msg)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <header className="flex items-center justify-between border-b bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              {isRedundancy ? (
                <GitMerge className="h-5 w-5" />
              ) : (
                <Link2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isRedundancy
                  ? "Refactoring Example: Consolidate Redundant Classes"
                  : "Refactoring Example: Standard Vocabulary Alignment"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isRedundancy
                  ? `Simulated transformation for cluster "${cluster?.clusterName}"`
                  : `Simulated transformation for local class "${alignment?.className}"`}
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-6 p-6">
          {/* Before & After Interactive Comparison */}
          {isRedundancy && cluster && (
            <div className="space-y-5">
              <div className="rounded-lg border bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Detected Problem:</span> High
                lexical and semantic overlap between{" "}
                <strong>{cluster.classNames.join(", ")}</strong> (
                {Math.round(cluster.similarityScore * 100)}% similarity). Having
                multiple overlapping classes fragments relations and violates
                OWL single-concept normalization.
              </div>

              {/* Before & After Cards */}
              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr,auto,1fr]">
                {/* BEFORE Card */}
                <div className="flex flex-col justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wider text-destructive uppercase">
                        Current State (Before)
                      </span>
                      <Badge
                        variant="outline"
                        className="border-destructive/30 text-[10px] text-destructive"
                      >
                        {cluster.classNames.length} Fragmented Classes
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2">
                      {cluster.classNames.map((name, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-medium text-foreground">
                            {name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Isolated Node
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Multiple duplicate concepts with disconnected attributes and
                    split relations.
                  </p>
                </div>

                {/* Arrow Transition */}
                <div className="flex items-center justify-center py-2 md:py-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                {/* AFTER Card */}
                <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                        Proposed Outcome (After)
                      </span>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-[10px] text-emerald-600"
                      >
                        Unified Concept
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2 rounded-md border border-emerald-500/20 bg-background p-3 text-xs shadow-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>
                          Canonical:{" "}
                          {cluster.classNames.find(
                            (_, idx) =>
                              cluster.classIds[idx] === currentTargetId
                          ) || cluster.classNames[0]}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <p>
                          ✔ All connected relations consolidated &amp;
                          re-pointed
                        </p>
                        <p>✔ Retains unique attributes from member classes</p>
                        <p>✔ Removes redundant class nodes from taxonomy</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Cleaner ontology graph with unified queryability and zero
                    semantic collisions.
                  </p>
                </div>
              </div>

              {/* Target Class Selection */}
              <div className="space-y-2.5 rounded-xl border bg-card p-4 shadow-xs">
                <label className="text-xs font-semibold text-foreground">
                  Select Surviving Canonical Class:
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {cluster.classIds.map((id, idx) => {
                    const isSelected = id === currentTargetId
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedTargetClassId(id)}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary shadow-xs"
                            : "bg-background text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span>{cluster.classNames[idx]}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Standard Alignment Before & After */}
          {isAlignment && alignment && (
            <div className="space-y-5">
              <div className="rounded-lg border bg-sky-500/10 p-3.5 text-xs text-sky-800 dark:text-sky-300">
                <span className="font-semibold">Detected Match:</span> Local
                class <strong>{alignment.className}</strong> strongly matches
                industry standard <strong>{alignment.candidateCurie}</strong> (
                {alignment.candidateLabel}) with{" "}
                <strong>
                  {Math.round(alignment.similarity * 100)}% confidence
                </strong>
                .
              </div>

              {/* Before & After Cards */}
              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr,auto,1fr]">
                {/* BEFORE Card */}
                <div className="flex flex-col justify-between rounded-xl border border-muted-foreground/30 bg-muted/10 p-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Current State (Before)
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Custom / Isolated
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1.5 rounded-md border bg-background p-3 text-xs shadow-xs">
                      <div className="font-semibold text-foreground">
                        {alignment.className}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Custom application term with no external
                        interoperability or standard semantics.
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Cannot be linked across external semantic graphs or
                    federated SPARQL queries.
                  </p>
                </div>

                {/* Arrow Transition */}
                <div className="flex items-center justify-center py-2 md:py-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                {/* AFTER Card */}
                <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                        Proposed Outcome (After)
                      </span>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-[10px] text-emerald-600"
                      >
                        Standards Compliant
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2 rounded-md border border-emerald-500/20 bg-background p-3 text-xs shadow-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Layers className="h-4 w-4 text-emerald-500" />
                        <span>
                          {alignment.className}{" "}
                          <span className="font-mono text-xs text-muted-foreground">
                            rdfs:subClassOf
                          </span>{" "}
                          <code className="rounded bg-muted px-1 font-mono text-emerald-700 dark:text-emerald-300">
                            {alignment.candidateCurie}
                          </code>
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <p>✔ Preserves local class identity and data</p>
                        <p>
                          ✔ Automatically inherits standard ontology properties
                        </p>
                        <p>
                          ✔ Compliant with FAIR data and external RDF reasoners
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Highest recommended OWL strategy: retains domain precision
                    while gaining international standards interoperability.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div>
              {isRedundancy && onOpenStudio && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    onOpenStudio(currentTargetId)
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Workflow className="h-3.5 w-3.5" />
                  Open in Full Refactor Studio
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs text-muted-foreground"
              >
                Cancel
              </Button>

              {isRedundancy ? (
                <Button
                  size="sm"
                  variant="default"
                  disabled={isApplying}
                  onClick={handleApplyRedundancyMerge}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  {isApplying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isApplying
                    ? "Merging Classes..."
                    : "Apply Merge Transformation"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  disabled={isApplying}
                  onClick={handleApplyAlignment}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  {isApplying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isApplying
                    ? "Linking Standard..."
                    : `Adopt as Standard Parent (rdfs:subClassOf)`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
