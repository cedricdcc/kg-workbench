"use client"

import { useMemo, useState } from "react"
import { ExternalLink, HelpCircle, Save, Trash2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { OntologyModule, OntologyRelation } from "@/domain/ontology"
import type {
  OntologyClassWithAttributes,
  OntologyCQWithModules,
} from "@/features/ontology/server/queries"
import { routes } from "@/lib/routes"
import {
  CqConceptMappingCard,
  type EditableTriple,
} from "./cq-concept-mapping-card"
import { CqModuleSelector } from "./cq-module-selector"

interface CqDetailPanelProps {
  cq: OntologyCQWithModules | null
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  modules: OntologyModule[]
  currentModuleId?: string | null
  onUpdateQuestion: (question: string) => Promise<void>
  onUpdateMapping: (mapping: {
    subjectClassId: string | null
    predicateRelationId: string | null
    objectClassId: string | null
  }) => Promise<void>
  onUpdateTriples?: (triples: EditableTriple[]) => Promise<void>
  onToggleModule: (moduleId: string) => Promise<void>
  onDelete: () => Promise<void>
}

export function CqDetailPanel(props: CqDetailPanelProps) {
  if (!props.cq) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card/20 p-8 text-center text-muted-foreground">
        <div className="mb-3 rounded-full bg-muted p-4">
          <HelpCircle className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          No Question Selected
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Select a competency question from the list on the left to review its
          formulation, map concepts, and inspect its ontological coverage.
        </p>
      </div>
    )
  }

  return <CqDetailPanelEditor key={props.cq.id} {...props} cq={props.cq} />
}

interface CqDetailPanelEditorProps extends Omit<CqDetailPanelProps, "cq"> {
  cq: OntologyCQWithModules
}

function CqDetailPanelEditor({
  cq,
  classes,
  relations,
  modules,
  currentModuleId = null,
  onUpdateQuestion,
  onUpdateMapping,
  onUpdateTriples,
  onToggleModule,
  onDelete,
}: CqDetailPanelEditorProps) {
  const [localQuestion, setLocalQuestion] = useState(cq.question)
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)

  const selectedModuleIds = useMemo(() => {
    return new Set((cq.modules ?? []).map((m) => m.id))
  }, [cq.modules])

  const isQuestionDirty = localQuestion.trim() !== cq.question.trim()

  async function handleSaveQuestion() {
    if (!isQuestionDirty) return
    setIsSavingQuestion(true)
    try {
      await onUpdateQuestion(localQuestion.trim())
    } finally {
      setIsSavingQuestion(false)
    }
  }

  return (
    <ScrollArea className="h-full bg-card/20">
      <div className="flex flex-col gap-6 p-6">
        {/* Header with Title and Delete action */}
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Question Inspector
            </h2>
            <p className="text-xs text-muted-foreground">
              Define question requirements and map to ontology classes and
              relations
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>

        {/* Section 1: Question Formulation */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Question Formulation
            </label>
            {isQuestionDirty ? (
              <Button
                size="sm"
                onClick={handleSaveQuestion}
                disabled={isSavingQuestion}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <Save className="h-3 w-3" />
                <span>Save Text</span>
              </Button>
            ) : null}
          </div>
          <Textarea
            value={localQuestion}
            onChange={(e) => setLocalQuestion(e.target.value)}
            onBlur={handleSaveQuestion}
            rows={3}
            placeholder="Formulate the competency question..."
            className="resize-y text-xs"
          />
        </div>

        {/* Section 2: Concept Mapping Card */}
        <CqConceptMappingCard
          triples={cq.triples}
          subjectClassId={cq.subject_class_id}
          predicateRelationId={cq.predicate_relation_id}
          objectClassId={cq.object_class_id}
          classes={classes}
          relations={relations}
          modules={modules}
          currentModuleId={currentModuleId}
          onUpdateTriples={async (updatedTriples) => {
            if (onUpdateTriples) {
              await onUpdateTriples(updatedTriples)
            } else {
              const first = updatedTriples[0]
              await onUpdateMapping({
                subjectClassId: first?.subjectClassId ?? null,
                predicateRelationId: first?.predicateRelationId ?? null,
                objectClassId: first?.objectClassId ?? null,
              })
            }
          }}
        />

        {/* Section 3: Module Associations */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <CqModuleSelector
            modules={modules}
            selectedModuleIds={selectedModuleIds}
            onToggleModule={(moduleId) => onToggleModule(moduleId)}
          />
        </div>

        {/* Section 4: Fact Inspector Bridge */}
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Knowledge Graph Verification
            </span>
            <span className="text-[11px] text-muted-foreground">
              Inspect extracted facts and instances answering this question in
              the document viewer
            </span>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            <Link href={routes.knowledgeGraph.root}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Inspect in Knowledge Graph</span>
            </Link>
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
