"use client"

import { Key, Layers, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  ArchivedDatasetSource,
  TabularColumnProfile,
} from "@/features/tabular/types"
import type { WizardState } from "./types"

interface StepEntitySelectionProps {
  dataset: ArchivedDatasetSource
  wizardState: WizardState
  onChange: (updates: Partial<WizardState>) => void
  existingClasses: Array<{ id: string; name: string }>
}

export function StepEntitySelection({
  dataset,
  wizardState,
  onChange,
  existingClasses,
}: StepEntitySelectionProps) {
  const columns = dataset.profileSummary?.columns || []
  const candidateKeys = dataset.profileSummary?.candidateKeys || []

  return (
    <div className="space-y-4 py-2 text-xs">
      <div className="space-y-1 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Layers className="h-4 w-4 text-primary" />
          <span>Step 1: Define Target Entity & Identifier</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Map the table rows in <strong>{dataset.sourceName}</strong> to an
          ontology Class, and select a candidate primary key column to generate
          unique entity IRIs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Target Class Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Target Ontology Class</Label>
          <div className="space-y-1.5">
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={wizardState.targetClassId || ""}
              onChange={(e) => {
                const id = e.target.value
                if (id) {
                  const found = existingClasses.find((c) => c.id === id)
                  onChange({
                    targetClassId: id,
                    targetClassName: found
                      ? found.name
                      : wizardState.targetClassName,
                  })
                } else {
                  onChange({ targetClassId: undefined })
                }
              }}
            >
              <option value="">-- Create new class --</option>
              {existingClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {!wizardState.targetClassId && (
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  New Class Name
                </Label>
                <Input
                  value={wizardState.targetClassName}
                  onChange={(e) =>
                    onChange({ targetClassName: e.target.value })
                  }
                  placeholder="e.g. Customer, SensorReading"
                  className="mt-1 h-8 text-xs font-medium"
                />
              </div>
            )}
          </div>
        </div>

        {/* Primary Key Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Primary Identifier Column
            </Label>
            {candidateKeys.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                {candidateKeys.length} candidate key(s)
              </span>
            )}
          </div>

          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
            value={wizardState.primaryKeyColumn}
            onChange={(e) => {
              const col = e.target.value
              onChange({
                primaryKeyColumn: col,
                columnMappings: wizardState.columnMappings.map((m) => ({
                  ...m,
                  isPrimaryKey: m.columnName === col,
                })),
              })
            }}
          >
            {columns.map((c: TabularColumnProfile) => (
              <option key={c.name} value={c.name}>
                {c.name}{" "}
                {c.isUniqueCandidate
                  ? "★ [Unique]"
                  : `(${c.distinctCount} distinct)`}
              </option>
            ))}
          </select>

          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Values in this column will form the entity IRI fragment.
          </p>
        </div>
      </div>
    </div>
  )
}
