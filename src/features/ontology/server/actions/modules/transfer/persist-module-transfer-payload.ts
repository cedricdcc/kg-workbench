import type { OntologyModule } from "@/domain/ontology"
import type { ModuleTransfer } from "@/features/ontology/schemas/module-transfer"
import { getDb } from "@/server/database"
import {
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
} from "@/server/db/schema"
import { saveCanonicalOntology } from "../../../linkml/document-store"
import {
  buildMissingParentWarning,
  buildMissingRelationWarning,
} from "../shared"
import { assertModuleNameAvailable } from "../store"
import type {
  CreateModuleLocalizedTextInput,
  DuplicateModuleResult,
} from "../types"
import { describeCQ } from "./module-transfer-mappers"

type Maps = {
  oldAttributeIdToNewId: Map<string, string>
  oldClassIdToNewId: Map<string, string>
  oldCQIdToNewId: Map<string, string>
  oldRelationAttributeIdToNewId: Map<string, string>
  oldRelationIdToNewId: Map<string, string>
}

function mapRef(
  sourceId: string | null | undefined,
  label: string,
  type: "subject class" | "predicate relation" | "object class",
  map: Map<string, string>,
  warnings: string[]
) {
  if (!sourceId) return null
  const id = map.get(sourceId)
  if (id) return id
  warnings.push(
    `Cleared ${type} on competency question "${label}" because "${sourceId}" could not be resolved.`
  )
  return null
}

export async function persistModuleTransferPayload({
  ontologyId,
  name,
  description,
  localizedTexts = [],
  payload,
}: {
  ontologyId: string
  name: string
  description?: string
  localizedTexts?: CreateModuleLocalizedTextInput[]
  payload: ModuleTransfer
}): Promise<DuplicateModuleResult> {
  const db = getDb()
  const validatedName = await assertModuleNameAvailable(ontologyId, name)
  const moduleId = validatedName
  const warnings: string[] = []

  const maps: Maps = {
    oldAttributeIdToNewId: new Map(),
    oldClassIdToNewId: new Map(),
    oldCQIdToNewId: new Map(),
    oldRelationAttributeIdToNewId: new Map(),
    oldRelationIdToNewId: new Map(),
  }

  for (const source of payload.classes) {
    maps.oldClassIdToNewId.set(source.id, source.name)
    maps.oldClassIdToNewId.set(source.name, source.name)
    for (const attr of source.attributes) {
      const attrKey = `${source.name}.${attr.name}`
      if (attr.id) maps.oldAttributeIdToNewId.set(attr.id, attrKey)
      maps.oldAttributeIdToNewId.set(attrKey, attrKey)
    }
  }

  for (const source of payload.relations) {
    if (source.id) maps.oldRelationIdToNewId.set(source.id, source.name)
    maps.oldRelationIdToNewId.set(source.name, source.name)
  }

  for (const source of payload.relationAttributes) {
    const relName =
      maps.oldRelationIdToNewId.get(source.relationId) || source.relationId
    const raKey = `${relName}.${source.name}`
    if (source.id) maps.oldRelationAttributeIdToNewId.set(source.id, raKey)
    maps.oldRelationAttributeIdToNewId.set(raKey, raKey)
  }

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.modules = draft.modules ?? []
      draft.classes = draft.classes ?? []
      draft.attributes = draft.attributes ?? []
      draft.relations = draft.relations ?? []
      draft.relation_attributes = draft.relation_attributes ?? []
      draft.notes = draft.notes ?? []
      draft.examples = draft.examples ?? []
      draft.localized_texts = draft.localized_texts ?? []

      // 1. Add Module
      draft.modules.push({
        id: moduleId,
        name: validatedName,
        description: description ?? payload.description ?? "",
      })

      // 2. Add Classes
      for (const source of payload.classes) {
        let parentKey: string | null = null
        if (source.parentClassId) {
          const parent = maps.oldClassIdToNewId.get(source.parentClassId)
          if (parent) {
            parentKey = parent
          } else {
            warnings.push(
              buildMissingParentWarning(source.name, source.parentClassId)
            )
          }
        }

        const classKey = source.name
        draft.classes.push({
          id: classKey,
          name: classKey,
          description: source.description ?? "",
          module_id: moduleId,
          parent_class_id: parentKey,
          instance_policy: "open",
        })

        // Attributes
        for (const attr of source.attributes) {
          draft.attributes.push({
            id: `${classKey}.${attr.name}`,
            class_id: classKey,
            name: attr.name,
            data_type: attr.dataType,
            required: attr.required,
            description: attr.description ?? "",
          })
        }
      }

      // 3. Add Relations
      for (const source of payload.relations) {
        const domain = maps.oldClassIdToNewId.get(source.domainClassId)
        const range = maps.oldClassIdToNewId.get(source.rangeClassId)
        if (!domain || !range) {
          warnings.push(buildMissingRelationWarning(source.name))
          continue
        }

        draft.relations.push({
          id: source.name,
          name: source.name,
          domain_class_id: domain,
          range_class_id: range,
          description: source.description ?? "",
          inverse_name: source.inverseName ?? null,
          cardinality: source.cardinality ?? null,
          instance_policy: "open",
        })
      }

      // 4. Add Relation Attributes
      for (const source of payload.relationAttributes) {
        const relationName = maps.oldRelationIdToNewId.get(source.relationId)
        if (!relationName) {
          warnings.push(
            `Skipped relation attribute "${source.name}" because relation "${source.relationId}" could not be resolved.`
          )
          continue
        }

        draft.relation_attributes.push({
          id: `${relationName}.${source.name}`,
          relation_id: relationName,
          name: source.name,
          data_type: source.dataType,
          description: source.description ?? "",
          required: source.required,
          sort_order: source.sortOrder,
        })
      }

      // 5. Add Notes
      for (const note of payload.notes) {
        const targetId =
          maps.oldClassIdToNewId.get(note.targetId) ??
          maps.oldRelationIdToNewId.get(note.targetId) ??
          maps.oldAttributeIdToNewId.get(note.targetId) ??
          maps.oldRelationAttributeIdToNewId.get(note.targetId) ??
          note.targetId

        draft.notes.push({
          id: note.id,
          target_type: note.targetType,
          target_id: targetId,
          body: note.body,
          author_name: note.authorName ?? "",
          sort_order: note.sortOrder,
        })
      }

      // 6. Add Examples
      for (const ex of payload.examples) {
        const targetId =
          maps.oldClassIdToNewId.get(ex.targetId) ??
          maps.oldRelationIdToNewId.get(ex.targetId) ??
          maps.oldAttributeIdToNewId.get(ex.targetId) ??
          ex.targetId

        draft.examples.push({
          id: ex.id,
          target_type: ex.targetType,
          target_id: targetId,
          value: ex.value,
          subject_label: ex.subjectLabel ?? null,
          predicate_label: ex.predicateLabel ?? null,
          object_label: ex.objectLabel ?? null,
          is_instance_candidate: Boolean(ex.isInstanceCandidate),
          sort_order: ex.sortOrder,
        })
      }

      // 7. Add Localized Texts
      for (const text of payload.localizedTexts) {
        const targetId =
          maps.oldClassIdToNewId.get(text.targetId) ??
          maps.oldRelationIdToNewId.get(text.targetId) ??
          maps.oldAttributeIdToNewId.get(text.targetId) ??
          text.targetId

        draft.localized_texts.push({
          target_type: text.targetType,
          target_id: targetId,
          field_name: text.fieldName,
          language_code: text.languageCode,
          value: text.value,
        })
      }

      for (const text of localizedTexts) {
        if (text.value && text.value.trim()) {
          draft.localized_texts.push({
            target_type: "module",
            target_id: moduleId,
            field_name: text.fieldName,
            language_code: text.languageCode,
            value: text.value.trim(),
          })
        }
      }
    },
    { db }
  )

  // 8. Add Competency Questions
  for (const source of payload.competencyQuestions) {
    const label = describeCQ(source)
    const [row] = await db
      .insert(ontologyCompetencyQuestions)
      .values({
        ontology_id: ontologyId,
        question: source.question,
        subject_class_id: mapRef(
          source.subjectClassId,
          label,
          "subject class",
          maps.oldClassIdToNewId,
          warnings
        ),
        predicate_relation_id: mapRef(
          source.predicateRelationId,
          label,
          "predicate relation",
          maps.oldRelationIdToNewId,
          warnings
        ),
        object_class_id: mapRef(
          source.objectClassId,
          label,
          "object class",
          maps.oldClassIdToNewId,
          warnings
        ),
        subject_example_id: null,
        predicate_example_id: null,
        object_example_id: null,
        sort_order: source.sortOrder,
      })
      .returning()

    if (row) {
      if (source.id) maps.oldCQIdToNewId.set(source.id, row.id)
      for (const ref of source.modules) {
        const targetMod = ref.name || moduleId
        await db
          .insert(ontologyCompetencyQuestionModules)
          .values({
            cq_id: row.id,
            module_id: targetMod,
          })
          .onConflictDoNothing()
      }
    }
  }

  const moduleResult: OntologyModule = {
    id: moduleId,
    ontology_id: ontologyId,
    name: validatedName,
    description: description ?? payload.description ?? "",
  }

  return { module: moduleResult, warnings }
}
