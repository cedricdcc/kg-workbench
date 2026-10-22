"use client"

import { useMemo } from "react"
import { ArrowRight, Link2 } from "lucide-react"

import { ClassPicker } from "@/components/shared/class-picker/class-picker"
import { RelationPicker } from "@/features/documents/components/fact-card/relation-picker/relation-picker"
import type { OntologyModule, OntologyRelation } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"

interface CqConceptMappingCardProps {
  subjectClassId: string | null
  predicateRelationId: string | null
  objectClassId: string | null
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  modules: OntologyModule[]
  currentModuleId?: string | null
  onSubjectChange: (id: string | null) => void
  onPredicateChange: (id: string | null) => void
  onObjectChange: (id: string | null) => void
}

export function CqConceptMappingCard({
  subjectClassId,
  predicateRelationId,
  objectClassId,
  classes,
  relations,
  modules,
  currentModuleId = null,
  onSubjectChange,
  onPredicateChange,
  onObjectChange,
}: CqConceptMappingCardProps) {
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])
  const relationMap = useMemo(() => new Map(relations.map((r) => [r.id, r])), [relations])

  const subjectName = subjectClassId ? classMap.get(subjectClassId)?.name ?? "Unknown Class" : null
  const predicateName = predicateRelationId ? relationMap.get(predicateRelationId)?.name ?? "Unknown Relation" : null
  const objectName = objectClassId ? classMap.get(objectClassId)?.name ?? "Unknown Class" : null

  const isFull = Boolean(subjectName && predicateName && objectName)
  const isPartial = Boolean((subjectName || predicateName || objectName) && !isFull)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Concept Mapping</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            isFull
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : isPartial
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isFull ? "Fully Mapped" : isPartial ? "Partially Mapped" : "Unmapped"}
        </span>
      </div>

      {/* Live Visual Triple Preview */}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs">
        <div
          className={`rounded-md border px-2.5 py-1.5 font-medium transition-colors ${
            subjectName
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-dashed border-border text-muted-foreground"
          }`}
        >
          {subjectName ?? "Subject Class"}
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5" />
          <span
            className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
              predicateName
                ? "bg-primary/10 text-primary font-semibold"
                : "border-dashed border border-border text-muted-foreground"
            }`}
          >
            {predicateName ? `:${predicateName}` : "(predicate)"}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>

        <div
          className={`rounded-md border px-2.5 py-1.5 font-medium transition-colors ${
            objectName
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-dashed border-border text-muted-foreground"
          }`}
        >
          {objectName ?? "Object Class"}
        </div>
      </div>

      {/* SPO Selectors */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Subject Class Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            Subject Class <span className="text-muted-foreground font-normal">(Domain)</span>
          </label>
          <ClassPicker
            value={subjectClassId ?? ""}
            onValueChange={(id) => onSubjectChange(id || null)}
            allClasses={classes}
            modules={modules}
            currentModuleId={currentModuleId}
            placeholder="Select subject class..."
            noneOption={{ value: "", label: "None (Unmapped)" }}
            onClear={() => onSubjectChange(null)}
          />
        </div>

        {/* Predicate Relation Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            Predicate Relation <span className="text-muted-foreground font-normal">(Edge)</span>
          </label>
          <RelationPicker
            value={predicateRelationId}
            options={relations}
            classes={classes}
            modules={modules}
            disabled={false}
            onSelect={(id) => onPredicateChange(id)}
          />
        </div>

        {/* Object Class Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            Object Class <span className="text-muted-foreground font-normal">(Range)</span>
          </label>
          <ClassPicker
            value={objectClassId ?? ""}
            onValueChange={(id) => onObjectChange(id || null)}
            allClasses={classes}
            modules={modules}
            currentModuleId={currentModuleId}
            placeholder="Select object class..."
            noneOption={{ value: "", label: "None (Unmapped)" }}
            onClear={() => onObjectChange(null)}
          />
        </div>
      </div>
    </div>
  )
}
