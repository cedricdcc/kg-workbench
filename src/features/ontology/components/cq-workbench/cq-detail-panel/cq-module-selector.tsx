"use client"

import { Check, Layers } from "lucide-react"

import type { OntologyModule } from "@/domain/ontology"

interface CqModuleSelectorProps {
  modules: OntologyModule[]
  selectedModuleIds: Set<string>
  onToggleModule: (moduleId: string) => void
}

export function CqModuleSelector({
  modules,
  selectedModuleIds,
  onToggleModule,
}: CqModuleSelectorProps) {
  if (modules.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Associated Modules</label>
        <p className="text-xs text-muted-foreground">No ontology modules defined yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <label className="text-xs font-semibold text-foreground">
            Associated Modules ({selectedModuleIds.size} of {modules.length})
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {modules.map((m) => {
          const isSelected = selectedModuleIds.has(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggleModule(m.id)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90"
                  : "border border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
              <span>{m.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
