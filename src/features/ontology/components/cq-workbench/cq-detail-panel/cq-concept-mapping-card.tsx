"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Link2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ClassPicker } from "@/components/shared/class-picker/class-picker"
import { RelationPicker } from "@/features/documents/components/fact-card/relation-picker/relation-picker"
import type {
  OntologyCqTriple,
  OntologyModule,
  OntologyRelation,
} from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"

export interface EditableTriple {
  subjectClassId: string | null
  predicateRelationId: string | null
  objectClassId: string | null
}

export interface CqConceptMappingCardProps {
  triples?: OntologyCqTriple[]
  subjectClassId?: string | null
  predicateRelationId?: string | null
  objectClassId?: string | null
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  modules: OntologyModule[]
  currentModuleId?: string | null
  onUpdateTriples: (triples: EditableTriple[]) => Promise<void>
  onSubjectChange?: (id: string | null) => void
  onPredicateChange?: (id: string | null) => void
  onObjectChange?: (id: string | null) => void
}

export function CqConceptMappingCard({
  triples,
  subjectClassId = null,
  predicateRelationId = null,
  objectClassId = null,
  classes,
  relations,
  modules,
  currentModuleId = null,
  onUpdateTriples,
}: CqConceptMappingCardProps) {
  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  )
  const relationMap = useMemo(
    () => new Map(relations.map((r) => [r.id, r])),
    [relations]
  )

  // Initialize hops from triples or fallback to legacy single-triple
  const initialHops: EditableTriple[] = useMemo(() => {
    if (triples && triples.length > 0) {
      return triples.map((t) => ({
        subjectClassId: t.subject_class_id,
        predicateRelationId: t.predicate_relation_id,
        objectClassId: t.object_class_id,
      }))
    }
    if (subjectClassId || predicateRelationId || objectClassId) {
      return [
        {
          subjectClassId,
          predicateRelationId,
          objectClassId,
        },
      ]
    }
    return [
      {
        subjectClassId: null,
        predicateRelationId: null,
        objectClassId: null,
      },
    ]
  }, [triples, subjectClassId, predicateRelationId, objectClassId])

  const [prevInitialHops, setPrevInitialHops] = useState(initialHops)
  const [hops, setHops] = useState<EditableTriple[]>(initialHops)

  if (prevInitialHops !== initialHops) {
    setPrevInitialHops(initialHops)
    setHops(initialHops)
  }

  // Coverage status calculation
  const { isFull, isPartial, mappedCount, totalCount } = useMemo(() => {
    let mapped = 0
    let partial = 0
    for (const h of hops) {
      const hasS = Boolean(h.subjectClassId && classMap.has(h.subjectClassId))
      const hasP = Boolean(
        h.predicateRelationId && relationMap.has(h.predicateRelationId)
      )
      const hasO = Boolean(h.objectClassId && classMap.has(h.objectClassId))
      if (hasS && hasP && hasO) {
        mapped++
      } else if (hasS || hasP || hasO) {
        partial++
      }
    }
    const full = hops.length > 0 && mapped === hops.length
    const part = (partial > 0 || (mapped > 0 && mapped < hops.length)) && !full
    return {
      isFull: full,
      isPartial: part,
      mappedCount: mapped,
      totalCount: hops.length,
    }
  }, [hops, classMap, relationMap])

  async function handleHopsCommit(nextHops: EditableTriple[]) {
    setHops(nextHops)
    await onUpdateTriples(nextHops)
  }

  function updateHop(
    index: number,
    field: keyof EditableTriple,
    value: string | null
  ) {
    const next = hops.map((hop, i) =>
      i === index ? { ...hop, [field]: value } : hop
    )
    handleHopsCommit(next)
  }

  function addHop() {
    const lastHop = hops[hops.length - 1]
    const next: EditableTriple[] = [
      ...hops,
      {
        // Convenient chain linking: new subject defaults to previous object
        subjectClassId: lastHop?.objectClassId ?? null,
        predicateRelationId: null,
        objectClassId: null,
      },
    ]
    handleHopsCommit(next)
  }

  function removeHop(index: number) {
    if (hops.length <= 1) {
      const next = [
        {
          subjectClassId: null,
          predicateRelationId: null,
          objectClassId: null,
        },
      ]
      handleHopsCommit(next)
      return
    }
    const next = hops.filter((_, i) => i !== index)
    handleHopsCommit(next)
  }

  function moveHop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= hops.length) return
    const next = [...hops]
    const temp = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = temp
    handleHopsCommit(next)
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Concept Mapping & Graph Patterns
          </h3>
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
          {isFull
            ? totalCount > 1
              ? `Fully Mapped (${totalCount} hops)`
              : "Fully Mapped"
            : isPartial
              ? `Partially Mapped (${mappedCount}/${totalCount} hops)`
              : "Unmapped"}
        </span>
      </div>

      {/* Live Visual Graph Pattern Flow */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>Graph Pattern Flow</span>
          <span className="font-mono text-[10px]">
            {hops.length} {hops.length === 1 ? "hop" : "hops"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hops.map((hop, hIdx) => {
            const sName = hop.subjectClassId
              ? classMap.get(hop.subjectClassId)?.name
              : null
            const pName = hop.predicateRelationId
              ? relationMap.get(hop.predicateRelationId)?.name
              : null
            const oName = hop.objectClassId
              ? classMap.get(hop.objectClassId)?.name
              : null

            return (
              <div key={hIdx} className="flex flex-wrap items-center gap-1.5">
                {hIdx > 0 && (
                  <span className="text-xs font-bold text-muted-foreground/50">
                    →
                  </span>
                )}
                <div
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    sName
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      : "border-dashed border-border text-muted-foreground"
                  }`}
                >
                  {sName ?? `Hop #${hIdx + 1} Subject`}
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ──
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                      pName
                        ? "bg-primary/10 font-semibold text-primary"
                        : "border border-dashed border-border text-[10px] text-muted-foreground"
                    }`}
                  >
                    {pName ? `:${pName}` : "(predicate)"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ──►
                  </span>
                </div>

                <div
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    oName
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      : "border-dashed border-border text-muted-foreground"
                  }`}
                >
                  {oName ?? "Object Class"}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ordered Hop Rows */}
      <div className="flex flex-col gap-3">
        {hops.map((hop, hIdx) => (
          <div
            key={hIdx}
            className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {hIdx + 1}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Hop #{hIdx + 1}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {hIdx > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => moveHop(hIdx, -1)}
                    title="Move Hop Up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                )}
                {hIdx < hops.length - 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => moveHop(hIdx, 1)}
                    title="Move Hop Down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeHop(hIdx)}
                  title="Remove Hop"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Subject Class Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Subject Class{" "}
                  <span className="font-normal text-muted-foreground">
                    (Domain)
                  </span>
                </label>
                <ClassPicker
                  value={hop.subjectClassId ?? ""}
                  onValueChange={(id) =>
                    updateHop(hIdx, "subjectClassId", id || null)
                  }
                  allClasses={classes}
                  modules={modules}
                  currentModuleId={currentModuleId}
                  placeholder="Select subject class..."
                  noneOption={{ value: "", label: "None (Unmapped)" }}
                  onClear={() => updateHop(hIdx, "subjectClassId", null)}
                />
              </div>

              {/* Predicate Relation Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Predicate Relation{" "}
                  <span className="font-normal text-muted-foreground">
                    (Edge)
                  </span>
                </label>
                <RelationPicker
                  value={hop.predicateRelationId}
                  options={relations}
                  classes={classes}
                  modules={modules}
                  disabled={false}
                  onSelect={(id) => updateHop(hIdx, "predicateRelationId", id)}
                />
              </div>

              {/* Object Class Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Object Class{" "}
                  <span className="font-normal text-muted-foreground">
                    (Range)
                  </span>
                </label>
                <ClassPicker
                  value={hop.objectClassId ?? ""}
                  onValueChange={(id) =>
                    updateHop(hIdx, "objectClassId", id || null)
                  }
                  allClasses={classes}
                  modules={modules}
                  currentModuleId={currentModuleId}
                  placeholder="Select object class..."
                  noneOption={{ value: "", label: "None (Unmapped)" }}
                  onClear={() => updateHop(hIdx, "objectClassId", null)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Hop Action */}
      <div className="flex items-center justify-between border-t border-border/40 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addHop}
          className="gap-1.5 border-dashed text-xs hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Connected Hop
        </Button>
      </div>
    </div>
  )
}
