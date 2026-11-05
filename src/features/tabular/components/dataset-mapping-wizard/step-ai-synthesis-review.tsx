"use client"

import { CheckCircle2, Layers, Network, PlusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { WizardState } from "./types"

interface StepAiSynthesisReviewProps {
  wizardState: WizardState
}

export function StepAiSynthesisReview({
  wizardState,
}: StepAiSynthesisReviewProps) {
  const synth = wizardState.synthesizedElements
  const newClasses = synth?.classes || []
  const newAttributes = synth?.attributes || []
  const newRelations = synth?.relations || []

  const activeMappings = wizardState.columnMappings.filter(
    (m) => m.targetKind !== "ignore"
  )

  return (
    <div className="space-y-4 py-2 text-xs">
      <div className="space-y-1 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>Step 3: Review Proposed Ontology & Dataset Mappings</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Verify the target class, identifier key, and any newly synthesized
          classes or relations before committing to the knowledge graph.
        </p>
      </div>

      {/* Target Class & Primary Key Summary */}
      <div className="grid grid-cols-2 gap-3 rounded-md border bg-background p-3">
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
            Target Ontology Class
          </span>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Layers className="h-4 w-4 text-primary" />
            <span>{wizardState.targetClassName}</span>
            {!wizardState.targetClassId && (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-600"
              >
                New Class
              </Badge>
            )}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
            Primary Key Column
          </span>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
            <span>{wizardState.primaryKeyColumn}</span>
            <Badge variant="secondary" className="text-[9px]">
              Entity ID
            </Badge>
          </div>
        </div>
      </div>

      {/* Synthesized Ontology Concepts */}
      {(newClasses.length > 0 ||
        newAttributes.length > 0 ||
        newRelations.length > 0) && (
        <div className="space-y-3 rounded-md border bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <PlusCircle className="h-3.5 w-3.5 text-blue-500" />
            <span>Synthesized Ontology Elements to be Created</span>
          </div>

          {newClasses.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground">
                New Classes:
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {newClasses.map((c) => (
                  <Badge
                    key={c.name}
                    variant="outline"
                    className="bg-background text-xs"
                  >
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {newAttributes.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground">
                New Attributes:
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {newAttributes.map((a, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="font-mono text-xs"
                  >
                    {a.className}.{a.name}: {a.dataType}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {newRelations.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground">
                New Relations:
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {newRelations.map((r, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="flex items-center gap-1 bg-background text-xs"
                  >
                    <Network className="h-3 w-3 text-primary" />
                    <span>
                      {r.sourceClass} → {r.name} → {r.targetClass}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mapped columns count */}
      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
        <span>
          Mapped Columns: <strong>{activeMappings.length}</strong> of{" "}
          {wizardState.columnMappings.length}
        </span>
        <span>
          Ignored Columns:{" "}
          <strong>
            {wizardState.columnMappings.length - activeMappings.length}
          </strong>
        </span>
      </div>
    </div>
  )
}
