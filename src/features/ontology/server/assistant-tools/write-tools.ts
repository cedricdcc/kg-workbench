import { z } from "zod"
import YAML from "yaml"
import { getDb } from "@/server/database"
import {
  assertOntologyDocumentAccess,
  runWithGroupKey,
} from "@/server/group-access"
import {
  createCQ,
  deleteCQ,
  setCQModules,
  updateCQ,
  updateCQTriples,
} from "../actions/competency-questions"
import { addReferenceOntology } from "../actions/reference-vocabularies"
import {
  getClassBlastRadius,
  getRelationBlastRadius,
} from "../blast-radius/queries"
import type { BlastRadiusReport } from "../blast-radius/types"
import { linkmlYamlToSnapshot } from "../linkml/ast-mapper"
import { compileLinkmlOntology } from "../linkml/compiler"
import {
  saveCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import type {
  CanonicalOntologySnapshot,
  OntologyAttributeSnapshot,
  OntologyClassSnapshot,
  OntologyModuleSnapshot,
  OntologyRelationSnapshot,
} from "../linkml/types"
import type {
  OntologyToolContext,
  OntologyToolDefinition,
  StagedOperationKind,
} from "./types"

export interface WriteOperationDescription {
  summary: string
  kind: StagedOperationKind
  isDestructive: boolean
  blastRadiusWarning?: string
}

export interface WriteToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> extends OntologyToolDefinition<TInput, TOutput> {
  mode: "write"
  kind: StagedOperationKind
  isDestructive: boolean
  describeOperation: (
    ctx: OntologyToolContext,
    input: z.infer<TInput>
  ) => Promise<WriteOperationDescription>
}

export interface WriteToolsDeps {
  saveCanonicalOntology: typeof saveCanonicalOntology
  createCQ: typeof createCQ
  updateCQ: typeof updateCQ
  deleteCQ: typeof deleteCQ
  setCQModules: typeof setCQModules
  updateCQTriples: typeof updateCQTriples
  addReferenceOntology: typeof addReferenceOntology
  getClassBlastRadius: typeof getClassBlastRadius
  getRelationBlastRadius: typeof getRelationBlastRadius
  assertOntologyDocumentAccess: typeof assertOntologyDocumentAccess
  compileLinkmlOntology: typeof compileLinkmlOntology
}

const DEFAULT_WRITE_TOOLS_DEPS: WriteToolsDeps = {
  saveCanonicalOntology,
  createCQ,
  updateCQ,
  deleteCQ,
  setCQModules,
  updateCQTriples,
  addReferenceOntology,
  getClassBlastRadius,
  getRelationBlastRadius,
  assertOntologyDocumentAccess,
  compileLinkmlOntology,
}

function getDbFromContext(ctx: OntologyToolContext): AnyDbClient | undefined {
  return ctx.tx ?? ctx.db
}

function formatBlastRadiusWarning(
  report: BlastRadiusReport
): string | undefined {
  const {
    affectedFactsCount,
    affectedEntitiesCount,
    affectedCqsCount,
    affectedRelationsCount,
    affectedSubclassesCount,
    affectedAttributesCount,
  } = report.summary

  const parts: string[] = []
  if (affectedFactsCount > 0) parts.push(`${affectedFactsCount} facts`)
  if (affectedEntitiesCount > 0) parts.push(`${affectedEntitiesCount} entities`)
  if (affectedCqsCount > 0) parts.push(`${affectedCqsCount} CQs`)
  if (affectedRelationsCount > 0)
    parts.push(`${affectedRelationsCount} relations`)
  if (affectedSubclassesCount > 0)
    parts.push(`${affectedSubclassesCount} subclasses`)
  if (affectedAttributesCount > 0)
    parts.push(`${affectedAttributesCount} attributes`)

  if (parts.length === 0) return undefined
  return `Blast radius (${report.severity}): ${parts.join(", ")} affected.`
}

const cqTripleSchema = z.object({
  subjectClassId: z.string().min(1).nullable().optional(),
  predicateRelationId: z.string().min(1).nullable().optional(),
  objectClassId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

function applyClassRenameToSnapshot(
  draft: CanonicalOntologySnapshot,
  oldKey: string,
  newKey: string
): void {
  const targetClass = draft.classes.find(
    (c) => c.id === oldKey || c.name === oldKey
  )
  if (!targetClass) {
    throw new Error(`Ontology class "${oldKey}" was not found.`)
  }
  const actualOldKey = targetClass.id
  targetClass.id = newKey
  targetClass.name = newKey

  for (const attr of draft.attributes ?? []) {
    if (attr.class_id === actualOldKey) {
      attr.class_id = newKey
      attr.id = `${newKey}.${attr.name}`
    }
  }
  for (const cls of draft.classes) {
    if (cls.parent_class_id === actualOldKey) {
      cls.parent_class_id = newKey
    }
    for (const attr of cls.attributes ?? []) {
      if (attr.class_id === actualOldKey) {
        attr.class_id = newKey
        attr.id = `${newKey}.${attr.name}`
      }
    }
  }
  for (const rel of draft.relations ?? []) {
    if (rel.domain_class_id === actualOldKey) rel.domain_class_id = newKey
    if (rel.range_class_id === actualOldKey) rel.range_class_id = newKey
  }
  if (draft.ui_layout?.classPositions) {
    for (const modId of Object.keys(draft.ui_layout.classPositions)) {
      const modPositions = draft.ui_layout.classPositions[modId]
      if (modPositions && modPositions[actualOldKey]) {
        modPositions[newKey] = modPositions[actualOldKey]
        delete modPositions[actualOldKey]
      }
    }
  }
}

function applyRelationRenameToSnapshot(
  draft: CanonicalOntologySnapshot,
  oldKey: string,
  newKey: string
): void {
  const targetRel = (draft.relations ?? []).find(
    (r) => r.id === oldKey || r.name === oldKey
  )
  if (!targetRel) {
    throw new Error(`Relation "${oldKey}" not found.`)
  }
  const actualOldKey = targetRel.id
  targetRel.id = newKey
  targetRel.name = newKey

  for (const ra of draft.relation_attributes ?? []) {
    if (ra.relation_id === actualOldKey) {
      ra.relation_id = newKey
      ra.id = `${newKey}.${ra.name}`
    }
  }
}

function applyAttributeRenameToSnapshot(
  draft: CanonicalOntologySnapshot,
  oldKey: string,
  newKey: string
): void {
  const targetAttr = (draft.attributes ?? []).find(
    (a) => a.id === oldKey || a.name === oldKey
  )
  if (!targetAttr) {
    throw new Error(`Ontology attribute "${oldKey}" was not found.`)
  }
  const newName = newKey.includes(".") ? newKey.split(".").pop()! : newKey
  const fullNewKey = `${targetAttr.class_id}.${newName}`
  targetAttr.name = newName
  targetAttr.id = fullNewKey

  for (const cls of draft.classes) {
    for (const attr of cls.attributes ?? []) {
      if (attr.id === oldKey || attr.name === oldKey) {
        attr.name = newName
        attr.id = `${attr.class_id}.${newName}`
      }
    }
  }
}

function applyModuleRenameToSnapshot(
  draft: CanonicalOntologySnapshot,
  oldKey: string,
  newKey: string
): void {
  const targetMod = (draft.modules ?? []).find(
    (m) => m.id === oldKey || m.name === oldKey
  )
  if (!targetMod) {
    throw new Error(`Module "${oldKey}" not found.`)
  }
  const actualOldKey = targetMod.id
  targetMod.id = newKey
  targetMod.name = newKey

  for (const cls of draft.classes) {
    if (cls.module_id === actualOldKey) {
      cls.module_id = newKey
    }
  }
  if (draft.ui_layout?.moduleLayouts?.[actualOldKey]) {
    draft.ui_layout.moduleLayouts[newKey] =
      draft.ui_layout.moduleLayouts[actualOldKey]
    delete draft.ui_layout.moduleLayouts[actualOldKey]
  }
}

/**
 * Builds the 16 write tools for the shared Ontology Tool Engine.
 * Accepts optional dependency overrides for isolated unit testing.
 */
export function createWriteTools(overrides?: Partial<WriteToolsDeps>) {
  const deps: WriteToolsDeps = {
    ...DEFAULT_WRITE_TOOLS_DEPS,
    ...overrides,
  }

  async function ensureDocumentAccess(
    ctx: OntologyToolContext,
    ontologyId: string
  ): Promise<void> {
    const db = getDbFromContext(ctx)
    const shouldCheck =
      Boolean(overrides?.assertOntologyDocumentAccess) ||
      !overrides?.saveCanonicalOntology ||
      (db && typeof (db as { select?: unknown }).select === "function")
    if (!shouldCheck) return
    const accessDb = (db ?? getDb()) as ReturnType<typeof getDb>
    await deps.assertOntologyDocumentAccess(ontologyId, accessDb)
  }

  function defineWriteTool<TInput extends z.ZodTypeAny, TOutput>(
    definition: Omit<WriteToolDefinition<TInput, TOutput>, "mode">
  ): WriteToolDefinition<TInput, TOutput> {
    return {
      ...definition,
      mode: "write",
      describeOperation: (ctx, rawInput) => {
        const parsed = definition.inputSchema.parse(rawInput)
        return runWithGroupKey(ctx.groupKey, () =>
          definition.describeOperation(ctx, parsed)
        )
      },
      execute: (ctx, rawInput) => {
        const parsed = definition.inputSchema.parse(rawInput)
        return runWithGroupKey(ctx.groupKey, () =>
          definition.execute(ctx, parsed)
        )
      },
    }
  }

  const add_cq = defineWriteTool({
    name: "add_cq",
    description:
      "Create a new competency question, optionally assigning modules and initial SPO triples.",
    kind: "cq",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      question: z.string().min(1),
      moduleIds: z.array(z.string().min(1)).optional(),
      triples: z.array(cqTripleSchema).optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "cq",
      isDestructive: false,
      summary: `+ CQ: "${input.question}"`,
    }),
    execute: async (ctx, input) => {
      const cq = await deps.createCQ(
        input.ontologyId,
        {
          question: input.question,
          triples: input.triples,
        },
        { tx: ctx.tx, db: ctx.db }
      )
      if (input.moduleIds && input.moduleIds.length > 0) {
        await deps.setCQModules(cq.id, input.moduleIds, {
          tx: ctx.tx,
          db: ctx.db,
        })
      }
      return { cq }
    },
  })

  const update_cq = defineWriteTool({
    name: "update_cq",
    description: "Update a competency question's text or module assignments.",
    kind: "cq",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      cqId: z.string().min(1),
      question: z.string().min(1).optional(),
      moduleIds: z.array(z.string().min(1)).optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "cq",
      isDestructive: false,
      summary: input.question
        ? `~ Update CQ ${input.cqId}: "${input.question}"`
        : `~ Update CQ modules on ${input.cqId}`,
    }),
    execute: async (ctx, input) => {
      let updated = null
      if (input.question !== undefined) {
        updated = await deps.updateCQ(
          input.cqId,
          { question: input.question },
          { tx: ctx.tx, db: ctx.db }
        )
      }
      if (input.moduleIds !== undefined) {
        await deps.setCQModules(input.cqId, input.moduleIds, {
          tx: ctx.tx,
          db: ctx.db,
        })
      }
      return { cqId: input.cqId, cq: updated }
    },
  })

  const delete_cq = defineWriteTool({
    name: "delete_cq",
    description: "Delete a competency question by ID.",
    kind: "delete",
    isDestructive: true,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      cqId: z.string().min(1),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "delete",
      isDestructive: true,
      summary: `- Delete CQ: ${input.cqId}`,
    }),
    execute: async (ctx, input) => {
      await deps.deleteCQ(input.cqId, { tx: ctx.tx, db: ctx.db })
      return { cqId: input.cqId, deleted: true }
    },
  })

  const link_cq_triple = defineWriteTool({
    name: "link_cq_triple",
    description:
      "Attach or replace subject-predicate-object (SPO) triples linked to a competency question.",
    kind: "cq",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      cqId: z.string().min(1),
      triples: z.array(cqTripleSchema).min(1).optional(),
      subjectClassId: z.string().min(1).nullable().optional(),
      predicateRelationId: z.string().min(1).nullable().optional(),
      objectClassId: z.string().min(1).nullable().optional(),
    }),
    describeOperation: async (_ctx, input) => {
      const count = input.triples?.length ?? 1
      return {
        kind: "cq",
        isDestructive: false,
        summary: `~ Link ${count} SPO triple(s) on CQ ${input.cqId}`,
      }
    },
    execute: async (ctx, input) => {
      const triples = input.triples ?? [
        {
          subjectClassId: input.subjectClassId ?? null,
          predicateRelationId: input.predicateRelationId ?? null,
          objectClassId: input.objectClassId ?? null,
        },
      ]
      await deps.updateCQTriples(input.cqId, triples, {
        tx: ctx.tx,
        db: ctx.db,
      })
      return { cqId: input.cqId, tripleCount: triples.length }
    },
  })

  const create_class = defineWriteTool({
    name: "create_class",
    description: "Create a new ontology class in the canonical LinkML schema.",
    kind: "create",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      name: z.string().min(1),
      moduleId: z.string().min(1).nullable().optional(),
      description: z.string().optional(),
      parentClassId: z.string().min(1).nullable().optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "create",
      isDestructive: false,
      summary: `+ Class: ${input.name.trim()}${input.moduleId ? ` (module: ${input.moduleId})` : ""}`,
    }),
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const newClassId = input.name.trim()
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const exists = draft.classes.some(
            (c) => c.name.toLowerCase() === newClassId.toLowerCase()
          )
          if (exists) {
            throw new Error(`Class "${newClassId}" already exists.`)
          }
          const newCls: OntologyClassSnapshot = {
            id: newClassId,
            name: newClassId,
            description: input.description ?? "",
            module_id: input.moduleId ?? null,
            parent_class_id: input.parentClassId ?? null,
            instance_policy: "open",
            attributes: [],
          }
          draft.classes.push(newCls)
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { classId: newClassId, name: newClassId }
    },
  })

  const update_class = defineWriteTool({
    name: "update_class",
    description:
      "Update metadata, module assignment, or parent class for an existing ontology class.",
    kind: "update",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      classId: z.string().min(1),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      moduleId: z.string().min(1).nullable().optional(),
      parentClassId: z.string().min(1).nullable().optional(),
      instancePolicy: z.string().min(1).optional(),
    }),
    describeOperation: async (ctx, input) => {
      const newName = input.name?.trim()
      const isRename = Boolean(newName && newName !== input.classId)
      let blastRadiusWarning: string | undefined
      if (isRename) {
        try {
          const report = await deps.getClassBlastRadius(
            input.ontologyId,
            input.classId,
            getDbFromContext(ctx)
          )
          blastRadiusWarning = formatBlastRadiusWarning(report)
        } catch {
          // Class lookup may fail in dry-run or mocked preview contexts
        }
      }
      return {
        kind: isRename ? "rename" : "update",
        isDestructive: isRename,
        summary: isRename
          ? `~ Rename Class: ${input.classId} -> ${newName}`
          : `~ Update Class: ${input.classId}`,
        ...(blastRadiusWarning ? { blastRadiusWarning } : {}),
      }
    },
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const newName = input.name?.trim()
      const diffOptions =
        newName && newName !== input.classId
          ? { classRenames: { [input.classId]: newName } }
          : undefined

      let updatedId = input.classId
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const targetClass = draft.classes.find(
            (c) => c.id === input.classId || c.name === input.classId
          )
          if (!targetClass) {
            throw new Error(`Ontology class "${input.classId}" was not found.`)
          }
          if (newName && newName !== targetClass.id) {
            applyClassRenameToSnapshot(draft, targetClass.id, newName)
            updatedId = newName
          }
          if (input.description !== undefined) {
            targetClass.description = input.description
          }
          if (input.moduleId !== undefined) {
            targetClass.module_id = input.moduleId
          }
          if (input.parentClassId !== undefined) {
            targetClass.parent_class_id = input.parentClassId
          }
          if (input.instancePolicy !== undefined) {
            targetClass.instance_policy = input.instancePolicy
          }
        },
        { db: ctx.db, tx: ctx.tx, diffOptions }
      )
      return { classId: updatedId }
    },
  })

  const delete_class = defineWriteTool({
    name: "delete_class",
    description:
      "Delete an ontology class and cascade removal of its attributes and connected relations.",
    kind: "delete",
    isDestructive: true,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      classId: z.string().min(1),
    }),
    describeOperation: async (ctx, input) => {
      let blastRadiusWarning: string | undefined
      try {
        const report = await deps.getClassBlastRadius(
          input.ontologyId,
          input.classId,
          getDbFromContext(ctx)
        )
        blastRadiusWarning = formatBlastRadiusWarning(report)
      } catch {
        // Ignore if class not found or DB unavailable in preview
      }
      return {
        kind: "delete",
        isDestructive: true,
        summary: `- Delete Class: ${input.classId}`,
        ...(blastRadiusWarning ? { blastRadiusWarning } : {}),
      }
    },
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const exists = draft.classes.some(
            (c) => c.id === input.classId || c.name === input.classId
          )
          if (!exists) {
            throw new Error(`Ontology class "${input.classId}" was not found.`)
          }
          draft.classes = draft.classes.filter(
            (c) => c.id !== input.classId && c.name !== input.classId
          )
          draft.attributes = (draft.attributes ?? []).filter(
            (a) => a.class_id !== input.classId
          )
          draft.relations = (draft.relations ?? []).filter(
            (r) =>
              r.domain_class_id !== input.classId &&
              r.range_class_id !== input.classId
          )
          for (const c of draft.classes) {
            if (c.parent_class_id === input.classId) {
              c.parent_class_id = null
            }
          }
          if (draft.ui_layout?.classPositions) {
            for (const modId of Object.keys(draft.ui_layout.classPositions)) {
              if (draft.ui_layout.classPositions[modId]) {
                delete draft.ui_layout.classPositions[modId][input.classId]
              }
            }
          }
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { classId: input.classId, deleted: true }
    },
  })

  const rename_symbol = defineWriteTool({
    name: "rename_symbol",
    description:
      "Transactionally rename a class, relation, attribute, or module across LinkML AST, CQs, and fact references.",
    kind: "rename",
    isDestructive: true,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      symbolKind: z.enum(["class", "relation", "attribute", "module"]),
      oldKey: z.string().min(1),
      newKey: z.string().min(1),
    }),
    describeOperation: async (ctx, input) => {
      let blastRadiusWarning: string | undefined
      try {
        if (input.symbolKind === "class") {
          const report = await deps.getClassBlastRadius(
            input.ontologyId,
            input.oldKey,
            getDbFromContext(ctx)
          )
          blastRadiusWarning = formatBlastRadiusWarning(report)
        } else if (input.symbolKind === "relation") {
          const report = await deps.getRelationBlastRadius(
            input.ontologyId,
            input.oldKey,
            getDbFromContext(ctx)
          )
          blastRadiusWarning = formatBlastRadiusWarning(report)
        }
      } catch {
        // Ignore if symbol not found or DB unavailable in preview
      }
      return {
        kind: "rename",
        isDestructive: true,
        summary: `~ Rename ${input.symbolKind}: ${input.oldKey} -> ${input.newKey}`,
        ...(blastRadiusWarning ? { blastRadiusWarning } : {}),
      }
    },
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const newKey = input.newKey.trim()
      const diffOptions =
        input.symbolKind === "class"
          ? { classRenames: { [input.oldKey]: newKey } }
          : input.symbolKind === "relation"
            ? { relationRenames: { [input.oldKey]: newKey } }
            : input.symbolKind === "attribute"
              ? { attributeRenames: { [input.oldKey]: newKey } }
              : { moduleRenames: { [input.oldKey]: newKey } }

      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          switch (input.symbolKind) {
            case "class":
              applyClassRenameToSnapshot(draft, input.oldKey, newKey)
              break
            case "relation":
              applyRelationRenameToSnapshot(draft, input.oldKey, newKey)
              break
            case "attribute":
              applyAttributeRenameToSnapshot(draft, input.oldKey, newKey)
              break
            case "module":
              applyModuleRenameToSnapshot(draft, input.oldKey, newKey)
              break
          }
        },
        { db: ctx.db, tx: ctx.tx, diffOptions }
      )
      return {
        symbolKind: input.symbolKind,
        oldKey: input.oldKey,
        newKey,
      }
    },
  })

  const upsert_attribute = defineWriteTool({
    name: "upsert_attribute",
    description: "Create or update an attribute on an ontology class.",
    kind: "update",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      classId: z.string().min(1),
      name: z.string().min(1),
      dataType: z.string().min(1).default("xsd:string"),
      required: z.boolean().optional(),
      description: z.string().optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "update",
      isDestructive: false,
      summary: `~ Attribute: ${input.classId}.${input.name.trim()} (${input.dataType})`,
    }),
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const attrName = input.name.trim()
      const attrId = `${input.classId}.${attrName}`

      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const targetClass = draft.classes.find(
            (c) => c.id === input.classId || c.name === input.classId
          )
          if (!targetClass) {
            throw new Error(`Ontology class "${input.classId}" was not found.`)
          }

          draft.attributes = draft.attributes ?? []
          const existing = draft.attributes.find(
            (a) =>
              a.class_id === targetClass.id &&
              a.name.toLowerCase() === attrName.toLowerCase()
          )

          if (existing) {
            existing.data_type = input.dataType
            if (input.required !== undefined) {
              existing.required = input.required
            }
            if (input.description !== undefined) {
              existing.description = input.description
            }
          } else {
            const created: OntologyAttributeSnapshot = {
              id: `${targetClass.id}.${attrName}`,
              class_id: targetClass.id,
              name: attrName,
              data_type: input.dataType,
              required: input.required ?? false,
              description: input.description ?? "",
            }
            draft.attributes.push(created)
          }
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { attributeId: attrId, classId: input.classId, name: attrName }
    },
  })

  const delete_attribute = defineWriteTool({
    name: "delete_attribute",
    description: "Delete an attribute from an ontology class.",
    kind: "delete",
    isDestructive: true,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      attributeId: z.string().min(1),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "delete",
      isDestructive: true,
      summary: `- Delete Attribute: ${input.attributeId}`,
    }),
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          draft.attributes = (draft.attributes ?? []).filter(
            (a) => a.id !== input.attributeId && a.name !== input.attributeId
          )
          for (const cls of draft.classes) {
            if (cls.attributes) {
              cls.attributes = cls.attributes.filter(
                (a) =>
                  a.id !== input.attributeId && a.name !== input.attributeId
              )
            }
          }
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { attributeId: input.attributeId, deleted: true }
    },
  })

  const create_relation = defineWriteTool({
    name: "create_relation",
    description: "Create a new relation between two ontology classes.",
    kind: "create",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      name: z.string().min(1),
      domainClassId: z.string().min(1),
      rangeClassId: z.string().min(1),
      description: z.string().optional(),
      inverseName: z.string().nullable().optional(),
      cardinality: z.string().nullable().optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "create",
      isDestructive: false,
      summary: `+ Relation: ${input.domainClassId} -[${input.name.trim()}]-> ${input.rangeClassId}`,
    }),
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const relationId = input.name.trim()
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          draft.relations = draft.relations ?? []
          const exists = draft.relations.some(
            (r) => r.name.toLowerCase() === relationId.toLowerCase()
          )
          if (exists) {
            throw new Error(`Relation "${relationId}" already exists.`)
          }
          const rel: OntologyRelationSnapshot = {
            id: relationId,
            name: relationId,
            domain_class_id: input.domainClassId,
            range_class_id: input.rangeClassId,
            description: input.description ?? "",
            inverse_name: input.inverseName ?? null,
            cardinality: input.cardinality ?? null,
            instance_policy: "open",
          }
          draft.relations.push(rel)
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { relationId, name: relationId }
    },
  })

  const update_relation = defineWriteTool({
    name: "update_relation",
    description: "Update an existing ontology relation.",
    kind: "update",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      relationId: z.string().min(1),
      name: z.string().min(1).optional(),
      domainClassId: z.string().min(1).optional(),
      rangeClassId: z.string().min(1).optional(),
      description: z.string().optional(),
      inverseName: z.string().nullable().optional(),
      cardinality: z.string().nullable().optional(),
      instancePolicy: z.string().min(1).optional(),
    }),
    describeOperation: async (ctx, input) => {
      const newName = input.name?.trim()
      const isRename = Boolean(newName && newName !== input.relationId)
      let blastRadiusWarning: string | undefined
      if (isRename) {
        try {
          const report = await deps.getRelationBlastRadius(
            input.ontologyId,
            input.relationId,
            getDbFromContext(ctx)
          )
          blastRadiusWarning = formatBlastRadiusWarning(report)
        } catch {
          // Ignore if relation not found in preview
        }
      }
      return {
        kind: isRename ? "rename" : "update",
        isDestructive: isRename,
        summary: isRename
          ? `~ Rename Relation: ${input.relationId} -> ${newName}`
          : `~ Update Relation: ${input.relationId}`,
        ...(blastRadiusWarning ? { blastRadiusWarning } : {}),
      }
    },
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const newName = input.name?.trim()
      const diffOptions =
        newName && newName !== input.relationId
          ? { relationRenames: { [input.relationId]: newName } }
          : undefined

      let updatedId = input.relationId
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const targetRel = (draft.relations ?? []).find(
            (r) => r.id === input.relationId || r.name === input.relationId
          )
          if (!targetRel) {
            throw new Error(`Relation "${input.relationId}" not found.`)
          }
          if (newName && newName !== targetRel.id) {
            applyRelationRenameToSnapshot(draft, targetRel.id, newName)
            updatedId = newName
          }
          if (input.domainClassId !== undefined) {
            targetRel.domain_class_id = input.domainClassId
          }
          if (input.rangeClassId !== undefined) {
            targetRel.range_class_id = input.rangeClassId
          }
          if (input.description !== undefined) {
            targetRel.description = input.description
          }
          if (input.inverseName !== undefined) {
            targetRel.inverse_name = input.inverseName
          }
          if (input.cardinality !== undefined) {
            targetRel.cardinality = input.cardinality
          }
          if (input.instancePolicy !== undefined) {
            targetRel.instance_policy = input.instancePolicy
          }
        },
        { db: ctx.db, tx: ctx.tx, diffOptions }
      )
      return { relationId: updatedId }
    },
  })

  const delete_relation = defineWriteTool({
    name: "delete_relation",
    description: "Delete an ontology relation by ID.",
    kind: "delete",
    isDestructive: true,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      relationId: z.string().min(1),
    }),
    describeOperation: async (ctx, input) => {
      let blastRadiusWarning: string | undefined
      try {
        const report = await deps.getRelationBlastRadius(
          input.ontologyId,
          input.relationId,
          getDbFromContext(ctx)
        )
        blastRadiusWarning = formatBlastRadiusWarning(report)
      } catch {
        // Ignore if relation not found in preview
      }
      return {
        kind: "delete",
        isDestructive: true,
        summary: `- Delete Relation: ${input.relationId}`,
        ...(blastRadiusWarning ? { blastRadiusWarning } : {}),
      }
    },
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const exists = (draft.relations ?? []).some(
            (r) => r.id === input.relationId || r.name === input.relationId
          )
          if (!exists) {
            throw new Error(`Relation "${input.relationId}" not found.`)
          }
          draft.relations = (draft.relations ?? []).filter(
            (r) => r.id !== input.relationId && r.name !== input.relationId
          )
          draft.relation_attributes = (draft.relation_attributes ?? []).filter(
            (ra) => ra.relation_id !== input.relationId
          )
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { relationId: input.relationId, deleted: true }
    },
  })

  const create_module = defineWriteTool({
    name: "create_module",
    description: "Create a new ontology module.",
    kind: "create",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "create",
      isDestructive: false,
      summary: `+ Module: ${input.name.trim()}`,
    }),
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const moduleName = input.name.trim()
      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          draft.modules = draft.modules ?? []
          const exists = draft.modules.some(
            (m) => m.name.toLowerCase() === moduleName.toLowerCase()
          )
          if (exists) {
            throw new Error(`Module "${moduleName}" already exists.`)
          }
          const newMod: OntologyModuleSnapshot = {
            id: moduleName,
            name: moduleName,
            description: input.description ?? "",
          }
          draft.modules.push(newMod)
        },
        { db: ctx.db, tx: ctx.tx }
      )
      return { moduleId: moduleName, name: moduleName }
    },
  })

  const apply_linkml_patch = defineWriteTool({
    name: "apply_linkml_patch",
    description:
      "Validate a full replacement LinkML YAML document via the LinkML runtime and save it with automatic symbol cascade.",
    kind: "update",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      linkmlYaml: z.string().min(1),
    }),
    describeOperation: async (_ctx, input) => {
      const lineCount = input.linkmlYaml.split(/\r?\n/).length
      return {
        kind: "update",
        isDestructive: false,
        summary: `~ Apply LinkML YAML patch (${lineCount} lines)`,
      }
    },
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)

      let parsedYaml: unknown
      try {
        parsedYaml = YAML.parse(input.linkmlYaml)
      } catch (err) {
        throw new Error(
          `Invalid LinkML YAML syntax: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      if (
        !parsedYaml ||
        typeof parsedYaml !== "object" ||
        Array.isArray(parsedYaml)
      ) {
        throw new Error("Invalid LinkML YAML: root document must be a mapping.")
      }

      const compiled = deps.compileLinkmlOntology(input.linkmlYaml)
      const fatalIssues = compiled.lint_issues.filter(
        (issue) => issue.severity === "FATAL" || issue.severity === "ERROR"
      )
      if (fatalIssues.length > 0) {
        const messages = fatalIssues
          .map((i) => `${i.issue_type}: ${i.message}`)
          .join("; ")
        throw new Error(`LinkML validation failed: ${messages}`)
      }

      await deps.saveCanonicalOntology(
        input.ontologyId,
        (draft) => {
          const nextSnapshot = linkmlYamlToSnapshot(
            input.ontologyId,
            input.linkmlYaml,
            draft.ui_layout
          )
          nextSnapshot.document.id = draft.document.id
          nextSnapshot.document.group_key = draft.document.group_key
          return nextSnapshot
        },
        { db: ctx.db, tx: ctx.tx }
      )

      return {
        ontologyId: input.ontologyId,
        sourceSha256: compiled.source_sha256,
        lintIssueCount: compiled.lint_issues.length,
      }
    },
  })

  const add_ohi_dependency = defineWriteTool({
    name: "add_ohi_dependency",
    description:
      "Register an OHI or external reference vocabulary dependency for alignment and locking.",
    kind: "dependency",
    isDestructive: false,
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      prefix: z.string().min(1),
      name: z.string().min(1).optional(),
      baseIri: z.string().url().optional(),
      sourceRegistry: z.string().min(1).default("ohi"),
      sourceId: z.string().min(1).optional(),
      version: z.string().optional(),
    }),
    describeOperation: async (_ctx, input) => ({
      kind: "dependency",
      isDestructive: false,
      summary: `+ Dependency: ${input.prefix} (${input.sourceRegistry})`,
    }),
    execute: async (ctx, input) => {
      await ensureDocumentAccess(ctx, input.ontologyId)
      const created = await deps.addReferenceOntology({
        prefix: input.prefix,
        name: input.name ?? input.prefix.toUpperCase(),
        baseIri: input.baseIri ?? "",
        sourceRegistry: input.sourceRegistry,
        sourceId: input.sourceId ?? input.prefix,
        version: input.version,
      })
      return { dependency: created }
    },
  })

  return {
    add_cq,
    update_cq,
    delete_cq,
    link_cq_triple,
    create_class,
    update_class,
    delete_class,
    rename_symbol,
    upsert_attribute,
    delete_attribute,
    create_relation,
    update_relation,
    delete_relation,
    create_module,
    apply_linkml_patch,
    add_ohi_dependency,
  }
}

export const WRITE_TOOLS = createWriteTools()

export type WriteToolName = keyof typeof WRITE_TOOLS
