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
  onSubjectChange,
  onPredicateChange,
  onObjectChange,
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
    if (index === 0) {
      if (field === "subjectClassId") onSubjectChange?.(value)
      if (field === "predicateRelationId") onPredicateChange?.(value)
      if (field === "objectClassId") onObjectChange?.(value)
    }
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
    <div
      className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-2xs"
      data-testid="cq-concept-mapping-card"
    >
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
        {hops.map((hop, hIdx) => {
          const subjectClass = hop.subjectClassId
            ? classMap.get(hop.subjectClassId)
            : null
          const objectClass = hop.objectClassId
            ? classMap.get(hop.objectClassId)
            : null
          const relation = hop.predicateRelationId
            ? relationMap.get(hop.predicateRelationId)
            : null

          return (
            <div key={hIdx} className="flex flex-col gap-3">
              <div
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 shadow-2xs"
                data-testid="cq-hop-row"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {hIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      Hop #{hIdx + 1}
                    </span>
                    {hIdx > 0 &&
                      hops[hIdx - 1]?.objectClassId === hop.subjectClassId &&
                      hop.subjectClassId && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Chained from Hop #{hIdx}
                        </span>
                      )}
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

                {/* Expansive Horizontal Concept Chain: [ Subject ] ──( Predicate )──> [ Object ] */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
                  {/* Subject Class Picker Card */}
                  <div
                    className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-border/50 bg-background/50 p-3 shadow-2xs"
                    data-testid="cq-subject-picker"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Subject Class{" "}
                        <span className="font-normal text-muted-foreground">
                          (Domain)
                        </span>
                      </label>
                      {subjectClass && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Source Node
                        </span>
                      )}
                    </div>
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
                    <AttributeBadgeStrip
                      cls={subjectClass}
                      testId="subject-attribute-badges"
                    />
                  </div>

                  {/* Predicate Relation Chaining Connector: ──( Predicate Relation Picker )──> */}
                  <div
                    className="flex flex-col items-center justify-start gap-1 lg:w-[280px] lg:shrink-0 lg:pt-2 xl:w-[320px]"
                    data-testid="cq-predicate-picker"
                  >
                    <div className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <div className="hidden h-px flex-1 bg-border/70 lg:block" />
                      <label className="shrink-0 text-center text-xs font-semibold text-foreground">
                        Predicate Relation{" "}
                        <span className="font-normal text-muted-foreground">
                          (Edge)
                        </span>
                      </label>
                      <div className="hidden h-px flex-1 bg-border/70 lg:block" />
                    </div>

                    <div className="flex w-full items-center gap-1">
                      {/* Left horizontal connector line from Subject */}
                      <div className="hidden items-center text-muted-foreground/50 select-none lg:flex">
                        <span className="h-0.5 w-4 rounded-full bg-border/80" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <RelationPicker
                          value={hop.predicateRelationId}
                          options={relations}
                          classes={classes}
                          modules={modules}
                          disabled={false}
                          className="mt-0 h-8 bg-background px-2.5 text-xs shadow-2xs"
                          onSelect={(id) =>
                            updateHop(hIdx, "predicateRelationId", id)
                          }
                        />
                      </div>

                      {/* Right horizontal connector arrow into Object */}
                      <div className="hidden items-center text-muted-foreground/50 select-none lg:flex">
                        <span className="h-0.5 w-3 rounded-full bg-border/80" />
                        <span className="-ml-0.5 text-xs font-bold text-primary">
                          ▸
                        </span>
                      </div>
                    </div>

                    {relation && (
                      <span className="max-w-full truncate text-[10px] text-muted-foreground/80">
                        {relation.description || `:${relation.name}`}
                      </span>
                    )}
                  </div>

                  {/* Object Class Picker Card */}
                  <div
                    className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-border/50 bg-background/50 p-3 shadow-2xs"
                    data-testid="cq-object-picker"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Object Class{" "}
                        <span className="font-normal text-muted-foreground">
                          (Range)
                        </span>
                      </label>
                      {objectClass && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Target Node
                        </span>
                      )}
                    </div>
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
                    <AttributeBadgeStrip
                      cls={objectClass}
                      testId="object-attribute-badges"
                    />
                  </div>
                </div>
              </div>

              {hIdx < hops.length - 1 && (
                <div className="-my-1 flex items-center justify-center">
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-0.5 text-[10px] font-medium text-muted-foreground shadow-2xs">
                    <span>
                      {hop.objectClassId &&
                      classMap.get(hop.objectClassId)?.name
                        ? `Chains to Hop #${hIdx + 2} from ${classMap.get(hop.objectClassId)!.name}`
                        : `Chains to Hop #${hIdx + 2}`}
                    </span>
                    <span className="font-bold text-primary">↓</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Hop Action */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addHop}
          data-testid="cq-add-hop-button"
          className="w-full gap-2 border-dashed border-border/80 bg-background/50 py-5 text-xs font-medium text-muted-foreground shadow-2xs transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          <span>Add Connected Hop (Chain Graph Pattern)</span>
        </Button>
      </div>
    </div>
  )
}

function AttributeBadgeStrip({
  cls,
  testId,
}: {
  cls: OntologyClassWithAttributes | null | undefined
  testId?: string
}) {
  if (!cls) return null

  if (cls.attributes && cls.attributes.length > 0) {
    return (
      <div
        className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-border/40 pt-1.5"
        data-testid={testId}
      >
        <span className="text-[10px] font-medium text-muted-foreground">
          Attributes:
        </span>
        {cls.attributes.map((attr) => (
          <span
            key={attr.id}
            title={
              attr.data_type ? `${attr.name} (${attr.data_type})` : attr.name
            }
            className="inline-flex items-center rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
          >
            {attr.name}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div
      className="mt-1 border-t border-border/40 pt-1 text-[10px] text-muted-foreground/50 italic"
      data-testid={testId}
    >
      No class attributes
    </div>
  )
}
