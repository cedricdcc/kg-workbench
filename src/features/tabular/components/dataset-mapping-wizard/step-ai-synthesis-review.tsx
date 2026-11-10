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

      {/* Responsive multi-column layout taking advantage of wide displays */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Card 1: Target Class & Primary Key Summary */}
        <div className="flex flex-col justify-between space-y-4 rounded-lg border bg-card p-4 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Target Entity & Identity
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                Target Ontology Class
              </span>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span>{wizardState.targetClassName}</span>
                {!wizardState.targetClassId && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-600 dark:text-emerald-400"
                  >
                    New Class
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                Primary Key Column
              </span>
              <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
                <span>{wizardState.primaryKeyColumn}</span>
                <Badge variant="secondary" className="text-[9px]">
                  Entity ID
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Mapped Columns:</span>
              <strong className="text-foreground">
                {activeMappings.length}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Ignored Columns:</span>
              <strong className="text-foreground">
                {wizardState.columnMappings.length - activeMappings.length}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: Property & Relation Mappings Overview */}
        <div className="flex flex-col space-y-3 rounded-lg border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b pb-2">
            <Network className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Property Mappings ({activeMappings.length})
            </span>
          </div>

          <div className="max-h-[320px] min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {activeMappings.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground italic">
                No active property mappings configured.
              </div>
            ) : (
              activeMappings.map((m) => (
                <div
                  key={m.columnName}
                  className="flex items-center justify-between rounded border bg-muted/20 px-2.5 py-1.5 font-mono text-[11px]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-foreground">
                      {m.columnName}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="truncate text-primary">
                      {m.targetKind === "relation"
                        ? m.targetRelationName || "hasRelation"
                        : m.targetAttributeName || m.columnName}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 font-mono text-[10px]"
                  >
                    {m.targetKind === "relation"
                      ? "relation"
                      : m.targetDataType || "xsd:string"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Synthesized Ontology Elements */}
        <div className="flex flex-col space-y-3 rounded-lg border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b pb-2">
            <PlusCircle className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-foreground">
              Synthesized Elements
            </span>
          </div>

          {newClasses.length > 0 ||
          newAttributes.length > 0 ||
          newRelations.length > 0 ? (
            <div className="max-h-[320px] min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {newClasses.length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    New Classes ({newClasses.length}):
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
                    New Attributes ({newAttributes.length}):
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
                    New Relations ({newRelations.length}):
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
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center space-y-1 py-8 text-center text-muted-foreground">
              <CheckCircle2 className="mb-1 h-6 w-6 text-emerald-500/80" />
              <div className="text-xs font-medium text-foreground">
                Direct Schema Mapping
              </div>
              <p className="max-w-[200px] text-[11px]">
                No new classes or relations need to be synthesized. All columns
                map directly to existing ontology concepts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
