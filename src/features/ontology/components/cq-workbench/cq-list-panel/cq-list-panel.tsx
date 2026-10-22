"use client"

import { useState } from "react"
import { HelpCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { OntologyCQWithModules } from "@/features/ontology/server/queries"
import type { EvaluatedCqCoverage } from "@/features/ontology/utils/cq-coverage"
import { CqListItem } from "./cq-list-item"

interface CqListPanelProps {
  cqs: OntologyCQWithModules[]
  evaluationsById: Record<string, EvaluatedCqCoverage>
  selectedCqId: string | null
  searchQuery?: string
  onSelectCq: (id: string) => void
  onQuickAdd: (question: string) => void
  onDuplicateCq: (cq: OntologyCQWithModules) => void
  onDeleteCq: (id: string) => void
  onReorderCq: (id: string, direction: "up" | "down") => void
}

export function CqListPanel({
  cqs,
  evaluationsById,
  selectedCqId,
  searchQuery,
  onSelectCq,
  onQuickAdd,
  onDuplicateCq,
  onDeleteCq,
  onReorderCq,
}: CqListPanelProps) {
  const [quickQuestion, setQuickQuestion] = useState("")

  function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quickQuestion.trim()) return
    onQuickAdd(quickQuestion.trim())
    setQuickQuestion("")
  }

  return (
    <div className="flex h-full flex-col border-r border-border/60 bg-muted/10">
      {/* Quick Add Row */}
      <div className="border-b border-border/60 p-3 bg-card/60 backdrop-blur-xs">
        <form onSubmit={handleQuickSubmit} className="flex items-center gap-2">
          <Input
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            placeholder="Quick add question... (Press Enter)"
            className="h-8 text-xs bg-background"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!quickQuestion.trim()}
            className="h-8 px-3 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </Button>
        </form>
      </div>

      {/* CQ List or Empty State */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {cqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="rounded-full bg-muted p-3 mb-2">
                <HelpCircle className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">No questions found</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                {searchQuery
                  ? "No competency questions match your active filters or search terms."
                  : "Start formulating questions to drive your ontology modeling."}
              </p>
            </div>
          ) : (
            cqs.map((cq, index) => {
              const coverage = evaluationsById[cq.id] ?? {
                status: "unmapped",
                hasSubject: false,
                hasPredicate: false,
                hasObject: false,
                subjectClassName: null,
                predicateRelationName: null,
                objectClassName: null,
              }

              return (
                <CqListItem
                  key={cq.id}
                  cq={cq}
                  coverage={coverage}
                  isSelected={cq.id === selectedCqId}
                  searchQuery={searchQuery}
                  onSelect={() => onSelectCq(cq.id)}
                  onDuplicate={() => onDuplicateCq(cq)}
                  onDelete={() => onDeleteCq(cq.id)}
                  onMoveUp={() => onReorderCq(cq.id, "up")}
                  onMoveDown={() => onReorderCq(cq.id, "down")}
                  canMoveUp={index > 0}
                  canMoveDown={index < cqs.length - 1}
                />
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
