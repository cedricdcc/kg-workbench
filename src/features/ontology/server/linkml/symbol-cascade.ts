import { and, eq, inArray, like, or, sql } from "drizzle-orm"
import {
  datasetSources,
  documentEntities,
  entityAttributeValues,
  extractionRuns,
  factRelationAttributeValues,
  facts,
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
} from "@/server/db/schema"
import type {
  CanonicalOntologySnapshot,
  OntologyAttributeSnapshot,
  OntologyClassSnapshot,
  OntologyModuleSnapshot,
  OntologyRelationSnapshot,
} from "./types"

export type SymbolKind = "class" | "relation" | "attribute" | "module"

export interface SymbolRenameItem {
  kind: SymbolKind
  oldKey: string
  newKey: string
}

export interface SymbolDeleteItem {
  kind: SymbolKind
  key: string
}

export interface SymbolAddItem {
  kind: SymbolKind
  key: string
}

export interface SymbolDiffReport {
  renames: SymbolRenameItem[]
  deletions: SymbolDeleteItem[]
  additions: SymbolAddItem[]

  renamedClasses: Array<{ oldKey: string; newKey: string }>
  deletedClasses: string[]
  addedClasses: string[]

  renamedRelations: Array<{ oldKey: string; newKey: string }>
  deletedRelations: string[]
  addedRelations: string[]

  renamedAttributes: Array<{ oldKey: string; newKey: string }>
  deletedAttributes: string[]
  addedAttributes: string[]

  renamedModules: Array<{ oldKey: string; newKey: string }>
  deletedModules: string[]
  addedModules: string[]
}

export interface DiffLinkmlOptions {
  classRenames?: Record<string, string>
  relationRenames?: Record<string, string>
  attributeRenames?: Record<string, string>
  moduleRenames?: Record<string, string>
}

/**
 * Structural database transaction / executor interface compatible with Drizzle's
 * NodePgDatabase, transaction runners, and in-memory test mocks.
 */
export interface DbTransaction {
  select: (fields?: unknown) => {
    from: (table: unknown) => {
      where: (clause: unknown) => Promise<Array<{ id: string }>>
    }
  }
  update: (table: unknown) => {
    set: (values: Record<string, unknown>) => {
      where: (clause: unknown) => Promise<unknown>
    }
  }
  delete: (table: unknown) => {
    where: (clause: unknown) => Promise<unknown>
  }
}

/**
 * Computes a semantic diff between two CanonicalOntologySnapshots to detect
 * renamed, deleted, and added classes, relations, attributes, and modules.
 */
export function diffLinkmlSnapshots(
  before: CanonicalOntologySnapshot,
  after: CanonicalOntologySnapshot,
  options?: DiffLinkmlOptions
): SymbolDiffReport {
  // 1. MODULES DIFF
  const beforeModules = new Map(before.modules.map((m) => [m.id, m]))
  const afterModules = new Map(after.modules.map((m) => [m.id, m]))

  const candidateDeletedModules: OntologyModuleSnapshot[] = []
  const candidateAddedModules: OntologyModuleSnapshot[] = []

  for (const [id, mod] of beforeModules.entries()) {
    if (!afterModules.has(id)) {
      candidateDeletedModules.push(mod)
    }
  }
  for (const [id, mod] of afterModules.entries()) {
    if (!beforeModules.has(id)) {
      candidateAddedModules.push(mod)
    }
  }

  const renamedModules: Array<{ oldKey: string; newKey: string }> = []
  const deletedModules: string[] = []
  const addedModules: string[] = []

  const matchedOldModules = new Set<string>()
  const matchedNewModules = new Set<string>()

  for (const oldMod of candidateDeletedModules) {
    if (options?.moduleRenames?.[oldMod.id]) {
      const explicitNew = options.moduleRenames[oldMod.id]
      if (afterModules.has(explicitNew)) {
        renamedModules.push({ oldKey: oldMod.id, newKey: explicitNew })
        matchedOldModules.add(oldMod.id)
        matchedNewModules.add(explicitNew)
        continue
      }
    }

    let bestMatch: OntologyModuleSnapshot | null = null
    let bestScore = 0

    for (const newMod of candidateAddedModules) {
      if (matchedNewModules.has(newMod.id)) continue
      let score = 0
      if (oldMod.name === newMod.name) score += 10
      if (oldMod.description && oldMod.description === newMod.description)
        score += 5

      // Check UI layout coordinates
      const oldLayout = before.ui_layout?.moduleLayouts?.[oldMod.id]
      const newLayout = after.ui_layout?.moduleLayouts?.[newMod.id]
      if (
        oldLayout &&
        newLayout &&
        oldLayout.x === newLayout.x &&
        oldLayout.y === newLayout.y
      ) {
        score += 8
      }

      // Bonus only if there is already positive evidence
      if (
        score > 0 &&
        candidateDeletedModules.length === 1 &&
        candidateAddedModules.length === 1
      ) {
        score += 2
      }

      if (score > bestScore && score >= 6) {
        bestScore = score
        bestMatch = newMod
      }
    }

    if (bestMatch) {
      renamedModules.push({ oldKey: oldMod.id, newKey: bestMatch.id })
      matchedOldModules.add(oldMod.id)
      matchedNewModules.add(bestMatch.id)
    }
  }

  for (const oldMod of candidateDeletedModules) {
    if (!matchedOldModules.has(oldMod.id)) {
      deletedModules.push(oldMod.id)
    }
  }
  for (const newMod of candidateAddedModules) {
    if (!matchedNewModules.has(newMod.id)) {
      addedModules.push(newMod.id)
    }
  }

  // 2. CLASSES DIFF
  const beforeClasses = new Map(before.classes.map((c) => [c.id, c]))
  const afterClasses = new Map(after.classes.map((c) => [c.id, c]))

  const candidateDeletedClasses: OntologyClassSnapshot[] = []
  const candidateAddedClasses: OntologyClassSnapshot[] = []

  for (const [id, cls] of beforeClasses.entries()) {
    if (!afterClasses.has(id)) {
      candidateDeletedClasses.push(cls)
    }
  }
  for (const [id, cls] of afterClasses.entries()) {
    if (!beforeClasses.has(id)) {
      candidateAddedClasses.push(cls)
    }
  }

  const renamedClasses: Array<{ oldKey: string; newKey: string }> = []
  const deletedClasses: string[] = []
  const addedClasses: string[] = []

  const matchedOldClasses = new Set<string>()
  const matchedNewClasses = new Set<string>()

  for (const oldCls of candidateDeletedClasses) {
    if (options?.classRenames?.[oldCls.id]) {
      const explicitNew = options.classRenames[oldCls.id]
      if (afterClasses.has(explicitNew)) {
        renamedClasses.push({ oldKey: oldCls.id, newKey: explicitNew })
        matchedOldClasses.add(oldCls.id)
        matchedNewClasses.add(explicitNew)
        continue
      }
    }

    let bestMatch: OntologyClassSnapshot | null = null
    let bestScore = 0

    for (const newCls of candidateAddedClasses) {
      if (matchedNewClasses.has(newCls.id)) continue
      let score = 0
      if (oldCls.name === newCls.name) score += 10
      if (oldCls.description && oldCls.description === newCls.description)
        score += 5

      // UI Layout coordinate matching
      let hasPositionMatch = false
      if (before.ui_layout?.classPositions && after.ui_layout?.classPositions) {
        for (const positions of Object.values(
          before.ui_layout.classPositions
        )) {
          const oldPos = positions[oldCls.id]
          if (!oldPos) continue
          for (const newPositions of Object.values(
            after.ui_layout.classPositions
          )) {
            const newPos = newPositions[newCls.id]
            if (newPos && newPos.x === oldPos.x && newPos.y === oldPos.y) {
              hasPositionMatch = true
              break
            }
          }
        }
      }
      if (hasPositionMatch) score += 8

      // Check relation referencing
      const oldRelCount = before.relations.filter(
        (r) => r.domain_class_id === oldCls.id || r.range_class_id === oldCls.id
      ).length
      const newRelCount = after.relations.filter(
        (r) => r.domain_class_id === newCls.id || r.range_class_id === newCls.id
      ).length
      if (oldRelCount > 0 && newRelCount > 0) score += 5

      // Check attribute overlap
      const oldAttrNames = new Set(
        before.attributes
          .filter((a) => a.class_id === oldCls.id)
          .map((a) => a.name)
      )
      const newAttrNames = new Set(
        after.attributes
          .filter((a) => a.class_id === newCls.id)
          .map((a) => a.name)
      )
      for (const name of oldAttrNames) {
        if (newAttrNames.has(name)) score += 4
      }

      // Bonus only if there is already positive evidence
      if (
        score > 0 &&
        candidateDeletedClasses.length === 1 &&
        candidateAddedClasses.length === 1
      ) {
        score += 2
      }

      if (score > bestScore && score >= 6) {
        bestScore = score
        bestMatch = newCls
      }
    }

    if (bestMatch) {
      renamedClasses.push({ oldKey: oldCls.id, newKey: bestMatch.id })
      matchedOldClasses.add(oldCls.id)
      matchedNewClasses.add(bestMatch.id)
    }
  }

  for (const oldCls of candidateDeletedClasses) {
    if (!matchedOldClasses.has(oldCls.id)) {
      deletedClasses.push(oldCls.id)
    }
  }
  for (const newCls of candidateAddedClasses) {
    if (!matchedNewClasses.has(newCls.id)) {
      addedClasses.push(newCls.id)
    }
  }

  const classRenameMap = new Map(
    renamedClasses.map((r) => [r.oldKey, r.newKey])
  )

  // 3. RELATIONS DIFF
  const beforeRelations = new Map(before.relations.map((r) => [r.id, r]))
  const afterRelations = new Map(after.relations.map((r) => [r.id, r]))

  const candidateDeletedRelations: OntologyRelationSnapshot[] = []
  const candidateAddedRelations: OntologyRelationSnapshot[] = []

  for (const [id, rel] of beforeRelations.entries()) {
    if (!afterRelations.has(id)) {
      candidateDeletedRelations.push(rel)
    }
  }
  for (const [id, rel] of afterRelations.entries()) {
    if (!beforeRelations.has(id)) {
      candidateAddedRelations.push(rel)
    }
  }

  const renamedRelations: Array<{ oldKey: string; newKey: string }> = []
  const deletedRelations: string[] = []
  const addedRelations: string[] = []

  const matchedOldRelations = new Set<string>()
  const matchedNewRelations = new Set<string>()

  for (const oldRel of candidateDeletedRelations) {
    if (options?.relationRenames?.[oldRel.id]) {
      const explicitNew = options.relationRenames[oldRel.id]
      if (afterRelations.has(explicitNew)) {
        renamedRelations.push({ oldKey: oldRel.id, newKey: explicitNew })
        matchedOldRelations.add(oldRel.id)
        matchedNewRelations.add(explicitNew)
        continue
      }
    }

    let bestMatch: OntologyRelationSnapshot | null = null
    let bestScore = 0

    const mappedDomain =
      classRenameMap.get(oldRel.domain_class_id) || oldRel.domain_class_id
    const mappedRange =
      classRenameMap.get(oldRel.range_class_id) || oldRel.range_class_id

    for (const newRel of candidateAddedRelations) {
      if (matchedNewRelations.has(newRel.id)) continue
      let score = 0
      if (oldRel.name === newRel.name) score += 10
      if (newRel.domain_class_id === mappedDomain) score += 6
      if (newRel.range_class_id === mappedRange) score += 6
      if (oldRel.description && oldRel.description === newRel.description)
        score += 4

      // Bonus only if there is already positive evidence
      if (
        score > 0 &&
        candidateDeletedRelations.length === 1 &&
        candidateAddedRelations.length === 1
      ) {
        score += 2
      }

      if (score > bestScore && score >= 6) {
        bestScore = score
        bestMatch = newRel
      }
    }

    if (bestMatch) {
      renamedRelations.push({ oldKey: oldRel.id, newKey: bestMatch.id })
      matchedOldRelations.add(oldRel.id)
      matchedNewRelations.add(bestMatch.id)
    }
  }

  for (const oldRel of candidateDeletedRelations) {
    if (!matchedOldRelations.has(oldRel.id)) {
      deletedRelations.push(oldRel.id)
    }
  }
  for (const newRel of candidateAddedRelations) {
    if (!matchedNewRelations.has(newRel.id)) {
      addedRelations.push(newRel.id)
    }
  }

  // 4. ATTRIBUTES DIFF
  const beforeAttributes = new Map(before.attributes.map((a) => [a.id, a]))
  const afterAttributes = new Map(after.attributes.map((a) => [a.id, a]))

  const candidateDeletedAttrs: OntologyAttributeSnapshot[] = []
  const candidateAddedAttrs: OntologyAttributeSnapshot[] = []

  for (const [id, attr] of beforeAttributes.entries()) {
    if (!afterAttributes.has(id)) {
      candidateDeletedAttrs.push(attr)
    }
  }
  for (const [id, attr] of afterAttributes.entries()) {
    if (!beforeAttributes.has(id)) {
      candidateAddedAttrs.push(attr)
    }
  }

  const renamedAttributes: Array<{ oldKey: string; newKey: string }> = []
  const deletedAttributes: string[] = []
  const addedAttributes: string[] = []

  const matchedOldAttrs = new Set<string>()
  const matchedNewAttrs = new Set<string>()

  for (const oldAttr of candidateDeletedAttrs) {
    if (options?.attributeRenames?.[oldAttr.id]) {
      const explicitNew = options.attributeRenames[oldAttr.id]
      if (afterAttributes.has(explicitNew)) {
        renamedAttributes.push({ oldKey: oldAttr.id, newKey: explicitNew })
        matchedOldAttrs.add(oldAttr.id)
        matchedNewAttrs.add(explicitNew)
        continue
      }
    }

    let bestMatch: OntologyAttributeSnapshot | null = null
    let bestScore = 0
    const mappedClassId =
      classRenameMap.get(oldAttr.class_id) || oldAttr.class_id

    for (const newAttr of candidateAddedAttrs) {
      if (matchedNewAttrs.has(newAttr.id)) continue
      let score = 0
      const isSameOrMappedClass = newAttr.class_id === mappedClassId

      if (isSameOrMappedClass) {
        if (oldAttr.name === newAttr.name) score += 10
        if (oldAttr.data_type === newAttr.data_type) score += 4
        if (oldAttr.description && oldAttr.description === newAttr.description)
          score += 2
        if (
          score > 0 &&
          candidateDeletedAttrs.length === 1 &&
          candidateAddedAttrs.length === 1
        ) {
          score += 2
        }
      }

      if (score > bestScore && score >= 6) {
        bestScore = score
        bestMatch = newAttr
      }
    }

    if (bestMatch) {
      renamedAttributes.push({ oldKey: oldAttr.id, newKey: bestMatch.id })
      matchedOldAttrs.add(oldAttr.id)
      matchedNewAttrs.add(bestMatch.id)
    }
  }

  for (const oldAttr of candidateDeletedAttrs) {
    if (!matchedOldAttrs.has(oldAttr.id)) {
      deletedAttributes.push(oldAttr.id)
    }
  }
  for (const newAttr of candidateAddedAttrs) {
    if (!matchedNewAttrs.has(newAttr.id)) {
      addedAttributes.push(newAttr.id)
    }
  }

  // Renames ordered: ATTRIBUTES FIRST, then RELATIONS, then CLASSES, then MODULES
  const renames: SymbolRenameItem[] = [
    ...renamedAttributes.map((r) => ({
      kind: "attribute" as const,
      oldKey: r.oldKey,
      newKey: r.newKey,
    })),
    ...renamedRelations.map((r) => ({
      kind: "relation" as const,
      oldKey: r.oldKey,
      newKey: r.newKey,
    })),
    ...renamedClasses.map((r) => ({
      kind: "class" as const,
      oldKey: r.oldKey,
      newKey: r.newKey,
    })),
    ...renamedModules.map((r) => ({
      kind: "module" as const,
      oldKey: r.oldKey,
      newKey: r.newKey,
    })),
  ]

  const deletions: SymbolDeleteItem[] = [
    ...deletedAttributes.map((k) => ({ kind: "attribute" as const, key: k })),
    ...deletedRelations.map((k) => ({ kind: "relation" as const, key: k })),
    ...deletedClasses.map((k) => ({ kind: "class" as const, key: k })),
    ...deletedModules.map((k) => ({ kind: "module" as const, key: k })),
  ]

  const additions: SymbolAddItem[] = [
    ...addedModules.map((k) => ({ kind: "module" as const, key: k })),
    ...addedClasses.map((k) => ({ kind: "class" as const, key: k })),
    ...addedRelations.map((k) => ({ kind: "relation" as const, key: k })),
    ...addedAttributes.map((k) => ({ kind: "attribute" as const, key: k })),
  ]

  return {
    renames,
    deletions,
    additions,
    renamedClasses,
    deletedClasses,
    addedClasses,
    renamedRelations,
    deletedRelations,
    addedRelations,
    renamedAttributes,
    deletedAttributes,
    addedAttributes,
    renamedModules,
    deletedModules,
    addedModules,
  }
}

async function getScopedRunAndEntityIds(
  tx: DbTransaction,
  ontologyId: string
): Promise<{ runIds: string[]; entityIds: string[] }> {
  const runs = await tx
    .select({ id: extractionRuns.id })
    .from(extractionRuns)
    .where(eq(extractionRuns.ontology_id, ontologyId))
  const runIds = runs.map((r: { id: string }) => r.id)

  if (runIds.length === 0) {
    return { runIds: [], entityIds: [] }
  }

  const entities = await tx
    .select({ id: documentEntities.id })
    .from(documentEntities)
    .where(inArray(documentEntities.extraction_run_id, runIds))
  const entityIds = entities.map((e: { id: string }) => e.id)

  return { runIds, entityIds }
}

async function getScopedCqIds(
  tx: DbTransaction,
  ontologyId: string
): Promise<string[]> {
  const cqs = await tx
    .select({ id: ontologyCompetencyQuestions.id })
    .from(ontologyCompetencyQuestions)
    .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId))
  return cqs.map((q: { id: string }) => q.id)
}

/**
 * Transactionally cascades a renamed symbol key across external tables
 * (document_entities, entity_attribute_values, facts, CQ triples, dataset_sources),
 * strictly scoped to the specified ontology.
 */
export async function cascadeSymbolRename(
  tx: DbTransaction,
  ontologyId: string,
  kind: "class" | "relation" | "attribute" | "module",
  oldKey: string,
  newKey: string
): Promise<void> {
  if (oldKey === newKey) return

  switch (kind) {
    case "class": {
      const { runIds, entityIds } = await getScopedRunAndEntityIds(
        tx,
        ontologyId
      )

      // 1. document_entities.class_id (only if this ontology has extraction runs)
      if (runIds.length > 0) {
        await tx
          .update(documentEntities)
          .set({ class_id: newKey })
          .where(
            and(
              eq(documentEntities.class_id, oldKey),
              inArray(documentEntities.extraction_run_id, runIds)
            )
          )
      }

      // 2. entity_attribute_values.attribute_id prefix replacement (only for entities of this ontology)
      if (entityIds.length > 0) {
        await tx
          .update(entityAttributeValues)
          .set({
            attribute_id: sql`${newKey} || substring(${entityAttributeValues.attribute_id} from ${oldKey.length + 1})`,
          })
          .where(
            and(
              inArray(entityAttributeValues.entity_id, entityIds),
              like(entityAttributeValues.attribute_id, `${oldKey}.%`)
            )
          )
      }

      // 3. ontology_competency_questions and cq_triples (only if this ontology has CQs)
      const cqIds = await getScopedCqIds(tx, ontologyId)
      if (cqIds.length > 0) {
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ subject_class_id: newKey })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.subject_class_id, oldKey)
            )
          )
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ object_class_id: newKey })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.object_class_id, oldKey)
            )
          )

        await tx
          .update(ontologyCqTriples)
          .set({ subject_class_id: newKey })
          .where(
            and(
              inArray(ontologyCqTriples.cq_id, cqIds),
              eq(ontologyCqTriples.subject_class_id, oldKey)
            )
          )
        await tx
          .update(ontologyCqTriples)
          .set({ object_class_id: newKey })
          .where(
            and(
              inArray(ontologyCqTriples.cq_id, cqIds),
              eq(ontologyCqTriples.object_class_id, oldKey)
            )
          )
      }

      // 4. dataset_sources mapping_spec JSONB (only if dataset_sources exist for this ontology)
      const ds = await tx
        .select({ id: datasetSources.id })
        .from(datasetSources)
        .where(eq(datasetSources.ontology_id, ontologyId))
      if (ds.length > 0) {
        try {
          await tx
            .update(datasetSources)
            .set({
              mapping_spec: sql`jsonb_set(coalesce(${datasetSources.mapping_spec}, '{}'::jsonb), '{targetClassId}', to_jsonb(${newKey}::text))`,
            })
            .where(
              and(
                eq(datasetSources.ontology_id, ontologyId),
                sql`${datasetSources.mapping_spec}->>'targetClassId' = ${oldKey}`
              )
            )
        } catch {
          // Fallback for mocks/non-PostgreSQL environments
        }
      }
      break
    }

    case "relation": {
      const runs = await tx
        .select({ id: extractionRuns.id })
        .from(extractionRuns)
        .where(eq(extractionRuns.ontology_id, ontologyId))
      const runIds = runs.map((r: { id: string }) => r.id)

      if (runIds.length > 0) {
        // 1. facts.relation_type_id
        await tx
          .update(facts)
          .set({ relation_type_id: newKey })
          .where(
            and(
              eq(facts.relation_type_id, oldKey),
              inArray(facts.extraction_run_id, runIds)
            )
          )

        // 2. fact_relation_attribute_values.relation_attribute_id prefix replacement
        const ontologyFacts = await tx
          .select({ id: facts.id })
          .from(facts)
          .where(inArray(facts.extraction_run_id, runIds))
        const factIds = ontologyFacts.map((f: { id: string }) => f.id)

        if (factIds.length > 0) {
          await tx
            .update(factRelationAttributeValues)
            .set({
              relation_attribute_id: sql`${newKey} || substring(${factRelationAttributeValues.relation_attribute_id} from ${oldKey.length + 1})`,
            })
            .where(
              and(
                inArray(factRelationAttributeValues.fact_id, factIds),
                like(
                  factRelationAttributeValues.relation_attribute_id,
                  `${oldKey}.%`
                )
              )
            )
        }
      }

      // 3. ontology_competency_questions & cq_triples (only if this ontology has CQs)
      const cqIds = await getScopedCqIds(tx, ontologyId)
      if (cqIds.length > 0) {
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ predicate_relation_id: newKey })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.predicate_relation_id, oldKey)
            )
          )

        await tx
          .update(ontologyCqTriples)
          .set({ predicate_relation_id: newKey })
          .where(
            and(
              inArray(ontologyCqTriples.cq_id, cqIds),
              eq(ontologyCqTriples.predicate_relation_id, oldKey)
            )
          )
      }
      break
    }

    case "attribute": {
      const { entityIds, runIds } = await getScopedRunAndEntityIds(
        tx,
        ontologyId
      )

      // 1. entity_attribute_values.attribute_id exact match (scoped to entities of this ontology)
      if (entityIds.length > 0) {
        await tx
          .update(entityAttributeValues)
          .set({ attribute_id: newKey })
          .where(
            and(
              inArray(entityAttributeValues.entity_id, entityIds),
              eq(entityAttributeValues.attribute_id, oldKey)
            )
          )
      }

      // 2. fact_relation_attribute_values.relation_attribute_id exact match (scoped to facts of this ontology)
      if (runIds.length > 0) {
        const ontologyFacts = await tx
          .select({ id: facts.id })
          .from(facts)
          .where(inArray(facts.extraction_run_id, runIds))
        const factIds = ontologyFacts.map((f: { id: string }) => f.id)

        if (factIds.length > 0) {
          await tx
            .update(factRelationAttributeValues)
            .set({ relation_attribute_id: newKey })
            .where(
              and(
                inArray(factRelationAttributeValues.fact_id, factIds),
                eq(factRelationAttributeValues.relation_attribute_id, oldKey)
              )
            )
        }
      }
      break
    }

    case "module": {
      const cqIds = await getScopedCqIds(tx, ontologyId)
      if (cqIds.length > 0) {
        // 1. ontology_competency_questions.module_id
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ module_id: newKey })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.module_id, oldKey)
            )
          )

        // 2. ontology_competency_question_modules.module_id (scoped to this ontology's CQs)
        await tx
          .update(ontologyCompetencyQuestionModules)
          .set({ module_id: newKey })
          .where(
            and(
              inArray(ontologyCompetencyQuestionModules.cq_id, cqIds),
              eq(ontologyCompetencyQuestionModules.module_id, oldKey)
            )
          )
      }
      break
    }
  }
}

/**
 * Transactionally cascades a deleted symbol key across external tables
 * (nulling out references or removing matching rows, mirroring foreign key behavior),
 * strictly scoped to the specified ontology.
 */
export async function cascadeSymbolDelete(
  tx: DbTransaction,
  ontologyId: string,
  kind: "class" | "relation" | "attribute" | "module",
  deletedKey: string
): Promise<void> {
  switch (kind) {
    case "class": {
      const { runIds, entityIds } = await getScopedRunAndEntityIds(
        tx,
        ontologyId
      )

      // 1. Null out document_entities.class_id (strictly scoped to this ontology's extraction runs)
      if (runIds.length > 0) {
        await tx
          .update(documentEntities)
          .set({ class_id: null })
          .where(
            and(
              eq(documentEntities.class_id, deletedKey),
              inArray(documentEntities.extraction_run_id, runIds)
            )
          )
      }

      // 2. Delete associated entity_attribute_values (strictly scoped to this ontology's entities)
      if (entityIds.length > 0) {
        await tx
          .delete(entityAttributeValues)
          .where(
            and(
              inArray(entityAttributeValues.entity_id, entityIds),
              or(
                eq(entityAttributeValues.attribute_id, deletedKey),
                like(entityAttributeValues.attribute_id, `${deletedKey}.%`)
              )
            )
          )
      }

      // 3. Null out ontology_competency_questions & cq_triples (only if this ontology has CQs)
      const cqIds = await getScopedCqIds(tx, ontologyId)
      if (cqIds.length > 0) {
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ subject_class_id: null })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.subject_class_id, deletedKey)
            )
          )
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ object_class_id: null })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.object_class_id, deletedKey)
            )
          )

        await tx
          .update(ontologyCqTriples)
          .set({ subject_class_id: null })
          .where(
            and(
              inArray(ontologyCqTriples.cq_id, cqIds),
              eq(ontologyCqTriples.subject_class_id, deletedKey)
            )
          )
        await tx
          .update(ontologyCqTriples)
          .set({ object_class_id: null })
          .where(
            and(
              inArray(ontologyCqTriples.cq_id, cqIds),
              eq(ontologyCqTriples.object_class_id, deletedKey)
            )
          )
      }
      break
    }

    case "relation": {
      const runs = await tx
        .select({ id: extractionRuns.id })
        .from(extractionRuns)
        .where(eq(extractionRuns.ontology_id, ontologyId))
      const runIds = runs.map((r: { id: string }) => r.id)

      if (runIds.length > 0) {
        const ontologyFacts = await tx
          .select({ id: facts.id })
          .from(facts)
          .where(inArray(facts.extraction_run_id, runIds))
        const factIds = ontologyFacts.map((f: { id: string }) => f.id)

        // 1. Delete associated fact_relation_attribute_values
        if (factIds.length > 0) {
          await tx
            .delete(factRelationAttributeValues)
            .where(
              and(
                inArray(factRelationAttributeValues.fact_id, factIds),
                or(
                  eq(
                    factRelationAttributeValues.relation_attribute_id,
                    deletedKey
                  ),
                  like(
                    factRelationAttributeValues.relation_attribute_id,
                    `${deletedKey}.%`
                  )
                )
              )
            )
        }

        // 2. Delete matching facts
        await tx
          .delete(facts)
          .where(
            and(
              eq(facts.relation_type_id, deletedKey),
              inArray(facts.extraction_run_id, runIds)
            )
          )
      }

      // 3. Null out ontology_competency_questions & cq_triples (only if this ontology has CQs)
      const cqIds = await getScopedCqIds(tx, ontologyId)
      if (cqIds.length > 0) {
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ predicate_relation_id: null })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.predicate_relation_id, deletedKey)
            )
          )

        await tx
          .update(ontologyCqTriples)
          .set({ predicate_relation_id: null })
          .where(
            and(
              inArray(ontologyCqTriples.cq_id, cqIds),
              eq(ontologyCqTriples.predicate_relation_id, deletedKey)
            )
          )
      }
      break
    }

    case "attribute": {
      const { entityIds, runIds } = await getScopedRunAndEntityIds(
        tx,
        ontologyId
      )

      // 1. Delete entity_attribute_values (scoped to entities of this ontology)
      if (entityIds.length > 0) {
        await tx
          .delete(entityAttributeValues)
          .where(
            and(
              inArray(entityAttributeValues.entity_id, entityIds),
              or(
                eq(entityAttributeValues.attribute_id, deletedKey),
                like(entityAttributeValues.attribute_id, `${deletedKey}.%`)
              )
            )
          )
      }

      // 2. Delete fact_relation_attribute_values (scoped to facts of this ontology)
      if (runIds.length > 0) {
        const ontologyFacts = await tx
          .select({ id: facts.id })
          .from(facts)
          .where(inArray(facts.extraction_run_id, runIds))
        const factIds = ontologyFacts.map((f: { id: string }) => f.id)

        if (factIds.length > 0) {
          await tx
            .delete(factRelationAttributeValues)
            .where(
              and(
                inArray(factRelationAttributeValues.fact_id, factIds),
                or(
                  eq(
                    factRelationAttributeValues.relation_attribute_id,
                    deletedKey
                  ),
                  like(
                    factRelationAttributeValues.relation_attribute_id,
                    `${deletedKey}.%`
                  )
                )
              )
            )
        }
      }
      break
    }

    case "module": {
      const cqIds = await getScopedCqIds(tx, ontologyId)
      if (cqIds.length > 0) {
        // 1. Null out ontology_competency_questions.module_id
        await tx
          .update(ontologyCompetencyQuestions)
          .set({ module_id: null })
          .where(
            and(
              eq(ontologyCompetencyQuestions.ontology_id, ontologyId),
              eq(ontologyCompetencyQuestions.module_id, deletedKey)
            )
          )

        // 2. Delete ontology_competency_question_modules (scoped to this ontology's CQs)
        await tx
          .delete(ontologyCompetencyQuestionModules)
          .where(
            and(
              inArray(ontologyCompetencyQuestionModules.cq_id, cqIds),
              eq(ontologyCompetencyQuestionModules.module_id, deletedKey)
            )
          )
      }
      break
    }
  }
}
