"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  OntologyExample,
  OntologyLanguage,
  OntologyLocalizedText,
  OntologyModule,
  OntologyNote,
  OntologyRelation,
  OntologyRelationAttribute,
} from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import {
  deleteRelation,
  updateRelation,
} from "@/features/ontology/server/actions/relations"
import { ClassPicker } from "@/components/shared/class-picker"
import { EntityInstances } from "../shared/entity-instances/entity-instances"
import { LocalizedTextEditor } from "../shared/localized-text-editor/localized-text-editor"
import { NotesEditor } from "../shared/notes-editor/notes-editor"
import { SemanticAlignmentsCard } from "../shared/semantic-alignments-card/semantic-alignments-card"
import { RelationAttributes } from "./relation-attributes/relation-attributes"
import { DefectCalloutBanner } from "../shared/defect-callout-banner"
import type { OntologyDefect } from "@/features/ontology/utils/linter"
import { BlastRadiusModal } from "../blast-radius-modal/blast-radius-modal"

interface RelationDetailProps {
  relation: OntologyRelation
  allClasses: OntologyClassWithAttributes[]
  modules: OntologyModule[]
  currentModuleId?: string | null
  ontologyId: string
  languages: OntologyLanguage[]
  defaultLanguage?: string | null
  localizedTexts: OntologyLocalizedText[]
  notes: OntologyNote[]
  examples: OntologyExample[]
  relationAttributes: OntologyRelationAttribute[]
  attributeMetadata: {
    localizedTexts: OntologyLocalizedText[]
    notes: OntologyNote[]
    examples: OntologyExample[]
    languages: OntologyLanguage[]
    defaultLanguage?: string | null
  }
  activeDefects?: OntologyDefect[]
  onQuickFix?: (defect: OntologyDefect) => void
}

export function RelationDetail({
  relation,
  allClasses,
  modules,
  currentModuleId,
  ontologyId,
  languages,
  defaultLanguage,
  localizedTexts,
  notes,
  examples,
  relationAttributes,
  attributeMetadata,
  activeDefects,
  onQuickFix,
}: RelationDetailProps) {
  const [isPending, startTransition] = useTransition()
  const [isBlastRadiusOpen, setIsBlastRadiusOpen] = useState(false)

  function handleDomainChange(classId: string) {
    startTransition(async () => {
      await updateRelation(relation.id, { domainClassId: classId })
    })
  }

  function handleRangeChange(classId: string) {
    startTransition(async () => {
      await updateRelation(relation.id, { rangeClassId: classId })
    })
  }

  function handleCardinalityChange(value: string) {
    startTransition(async () => {
      await updateRelation(relation.id, {
        cardinality: value === "__none__" ? null : value,
      })
    })
  }

  function handleDelete() {
    setIsBlastRadiusOpen(true)
  }

  return (
    <>
      <Tabs defaultValue="general" className="min-w-0 px-6 pt-3 pb-6">
        <TabsList className="w-full justify-start" variant="line">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="instances">
            Instances ({examples.length})
          </TabsTrigger>
          <TabsTrigger value="attributes">
            Attributes ({relationAttributes.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-1.5 space-y-6">
          {activeDefects && activeDefects.length > 0 && (
            <DefectCalloutBanner
              defects={activeDefects}
              onQuickFix={onQuickFix}
            />
          )}

          <section className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start">
              <div className="w-full min-w-0 md:w-fit">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Domain class
                </p>
                <ClassPicker
                  value={relation.domain_class_id}
                  onValueChange={handleDomainChange}
                  allClasses={allClasses}
                  modules={modules}
                  currentModuleId={currentModuleId ?? null}
                  disabled={isPending}
                />
              </div>

              <div className="w-full min-w-0 md:w-fit">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Range class
                </p>
                <ClassPicker
                  value={relation.range_class_id}
                  onValueChange={handleRangeChange}
                  allClasses={allClasses}
                  modules={modules}
                  currentModuleId={currentModuleId ?? null}
                  disabled={isPending}
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Cardinality
              </p>
              <Select
                value={relation.cardinality ?? "__none__"}
                onValueChange={handleCardinalityChange}
                disabled={isPending}
              >
                <SelectTrigger className="w-48 text-xs">
                  <SelectValue placeholder="Select cardinality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  <SelectItem value="1:1">1:1 (One to One)</SelectItem>
                  <SelectItem value="1:N">1:N (One to Many)</SelectItem>
                  <SelectItem value="N:1">N:1 (Many to One)</SelectItem>
                  <SelectItem value="N:M">N:M (Many to Many)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <LocalizedTextEditor
              ontologyId={ontologyId}
              target={{ type: "relation", id: relation.id }}
              languages={languages}
              localizedTexts={localizedTexts}
              defaultLanguage={defaultLanguage}
              fields={[
                {
                  name: "name",
                  label: "Name",
                  canonicalValue: relation.name,
                  onSaveCanonical: (name) =>
                    updateRelation(relation.id, { name }),
                },
                {
                  name: "description",
                  label: "Description",
                  canonicalValue: relation.description,
                  multiline: true,
                  placeholder: "No description",
                  onSaveCanonical: (description) =>
                    updateRelation(relation.id, { description }),
                },
                {
                  name: "inverseName",
                  label: "Inverse name",
                  canonicalValue: relation.inverse_name ?? "",
                  placeholder: "No inverse name",
                  onSaveCanonical: (inverseName) =>
                    updateRelation(relation.id, {
                      inverseName: inverseName || null,
                    }),
                },
              ]}
            />
          </section>

          <section>
            <SemanticAlignmentsCard
              ontologyId={ontologyId}
              entityId={relation.id}
              entityName={relation.name}
              entityType="relation"
            />
          </section>

          <div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete relation
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="instances" className="mt-1.5 space-y-6">
          <EntityInstances
            ontologyId={ontologyId}
            target={{ type: "relation", id: relation.id }}
            instancePolicy={relation.instance_policy}
            examples={examples}
            instanceCandidateLabel="Allowed predicate"
            candidatePluralLabel="allowed predicates"
            onInstancePolicyChange={(nextPolicy) =>
              updateRelation(relation.id, { instancePolicy: nextPolicy })
            }
          />
        </TabsContent>

        <TabsContent value="attributes" className="mt-1.5 space-y-6">
          <RelationAttributes
            ontologyId={ontologyId}
            relationId={relation.id}
            attributes={relationAttributes}
            languages={attributeMetadata.languages}
            defaultLanguage={attributeMetadata.defaultLanguage}
            localizedTexts={attributeMetadata.localizedTexts}
            notes={attributeMetadata.notes}
            examples={attributeMetadata.examples}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-1.5 space-y-6">
          <NotesEditor
            ontologyId={ontologyId}
            target={{ type: "relation", id: relation.id }}
            notes={notes}
          />
        </TabsContent>
      </Tabs>

      <BlastRadiusModal
        open={isBlastRadiusOpen}
        onOpenChange={setIsBlastRadiusOpen}
        target={{
          type: "relation",
          id: relation.id,
          name: relation.name,
          ontologyId,
        }}
        onConfirmDelete={async () => {
          await deleteRelation(relation.id)
        }}
      />
    </>
  )
}
