"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink, GitFork } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ContextualConnection } from "@/features/ontology/schemas/ai-generation"

interface ContextualExpansionSectionProps {
  items: ContextualConnection[]
  selectedCurieSet: Set<string>
  onToggle: (curie: string) => void
  onToggleAll: () => void
}

export function ContextualExpansionSection({
  items,
  selectedCurieSet,
  onToggle,
  onToggleAll,
}: ContextualExpansionSectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (items.length === 0) return null

  const allSelected = items.every((i) => selectedCurieSet.has(i.curie.toLowerCase()))
  const selectedCount = items.filter((i) => selectedCurieSet.has(i.curie.toLowerCase())).length

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3"
    >
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-left text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-primary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <GitFork className="h-3.5 w-3.5 text-primary" />
            <span>Suggested Contextual Standard Connections</span>
            <Badge variant="outline" className="text-[10px] bg-background border-primary/30">
              Option B Graph Closure
            </Badge>
          </button>
        </CollapsibleTrigger>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {selectedCount} of {items.length} selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleAll}
            className="h-6 px-2 text-[10px]"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </div>

      <CollapsibleContent className="mt-2.5 space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Standard ontologies specify parent hierarchies and linked properties. Selecting these incorporates direct parents and relations to maintain contextual semantic integrity.
        </p>

        <div className="grid max-h-[160px] gap-1.5 overflow-y-auto pr-1">
          {items.map((item) => {
            const isSelected = selectedCurieSet.has(item.curie.toLowerCase())
            const isParent = item.type === "parentClass"

            return (
              <div
                key={item.curie}
                onClick={() => onToggle(item.curie)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded border p-2 text-xs transition-colors ${
                  isSelected
                    ? "border-primary/40 bg-background/80 shadow-xs"
                    : "border-transparent bg-background/40 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(item.curie)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">
                        {item.curie}
                      </span>
                      {item.label && item.label !== item.curie && (
                        <span className="text-muted-foreground">
                          ({item.label})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-[9px] ${
                      isParent
                        ? "border-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                        : "border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {isParent ? "Parent Class" : "Connected Relation"}
                  </Badge>
                  {item.iri && (
                    <a
                      href={item.iri}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                      title={item.iri}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
