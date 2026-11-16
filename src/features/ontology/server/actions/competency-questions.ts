"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import type { OntologyCompetencyQuestion } from "@/domain/ontology"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
} from "@/server/db/schema"

import type { AnyDbClient } from "../linkml/document-store"
import type { DbTransaction } from "../linkml/symbol-cascade"

export interface CQMutationOptions {
  tx?: DbTransaction
  db?: AnyDbClient
}

type DrizzleDb = ReturnType<typeof getDb>

function resolveExecutor(options?: CQMutationOptions): DrizzleDb {
  return (options?.tx ?? options?.db ?? getDb()) as DrizzleDb
}

function safeRevalidateOntologyRoot() {
  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment (e.g. unit tests or standalone scripts)
  }
}

export interface CQTripleInput {
  subjectClassId?: string | null
  predicateRelationId?: string | null
  objectClassId?: string | null
  subjectExampleId?: string | null
  predicateExampleId?: string | null
  objectExampleId?: string | null
  sortOrder?: number
}

export async function createCQ(
  ontologyId: string,
  data: {
    question?: string
    subjectClassId?: string | null
    predicateRelationId?: string | null
    objectClassId?: string | null
    subjectExampleId?: string | null
    predicateExampleId?: string | null
    objectExampleId?: string | null
    sortOrder?: number
    triples?: CQTripleInput[]
  },
  options?: CQMutationOptions
): Promise<OntologyCompetencyQuestion> {
  const executor = resolveExecutor(options)
  await assertOntologyDocumentAccess(ontologyId, executor)

  const firstTriple = data.triples?.[0]
  const subjectClassId =
    data.subjectClassId ?? firstTriple?.subjectClassId ?? null
  const predicateRelationId =
    data.predicateRelationId ?? firstTriple?.predicateRelationId ?? null
  const objectClassId = data.objectClassId ?? firstTriple?.objectClassId ?? null

  const insertInTx = async (tx: DrizzleDb) => {
    const [inserted] = await tx
      .insert(ontologyCompetencyQuestions)
      .values({
        ontology_id: ontologyId,
        question: data.question ?? "",
        subject_class_id: subjectClassId,
        predicate_relation_id: predicateRelationId,
        object_class_id: objectClassId,
        subject_example_id: data.subjectExampleId ?? null,
        predicate_example_id: data.predicateExampleId ?? null,
        object_example_id: data.objectExampleId ?? null,
        sort_order: data.sortOrder ?? 0,
      })
      .returning()

    if (!inserted) throw new Error("Failed to create competency question.")

    if (data.triples && data.triples.length > 0) {
      await tx.insert(ontologyCqTriples).values(
        data.triples.map((t, idx) => ({
          cq_id: inserted.id,
          sort_order: t.sortOrder ?? idx,
          subject_class_id: t.subjectClassId ?? null,
          predicate_relation_id: t.predicateRelationId ?? null,
          object_class_id: t.objectClassId ?? null,
          subject_example_id: t.subjectExampleId ?? null,
          predicate_example_id: t.predicateExampleId ?? null,
          object_example_id: t.objectExampleId ?? null,
        }))
      )
    }

    return inserted
  }

  const row = options?.tx
    ? await insertInTx(executor)
    : await executor.transaction((tx) => insertInTx(tx as unknown as DrizzleDb))

  safeRevalidateOntologyRoot()
  return row
}

export async function updateCQ(
  id: string,
  data: {
    question?: string
    subjectClassId?: string | null
    predicateRelationId?: string | null
    objectClassId?: string | null
    subjectExampleId?: string | null
    predicateExampleId?: string | null
    objectExampleId?: string | null
    sortOrder?: number
  },
  options?: CQMutationOptions
): Promise<OntologyCompetencyQuestion> {
  const executor = resolveExecutor(options)
  await assertOntologyRecordAccess(
    "ontology_competency_questions",
    id,
    executor
  )
  const [row] = await executor
    .update(ontologyCompetencyQuestions)
    .set({
      ...(data.question !== undefined && { question: data.question }),
      ...(data.subjectClassId !== undefined && {
        subject_class_id: data.subjectClassId,
      }),
      ...(data.predicateRelationId !== undefined && {
        predicate_relation_id: data.predicateRelationId,
      }),
      ...(data.objectClassId !== undefined && {
        object_class_id: data.objectClassId,
      }),
      ...(data.subjectExampleId !== undefined && {
        subject_example_id: data.subjectExampleId,
      }),
      ...(data.predicateExampleId !== undefined && {
        predicate_example_id: data.predicateExampleId,
      }),
      ...(data.objectExampleId !== undefined && {
        object_example_id: data.objectExampleId,
      }),
      ...(data.sortOrder !== undefined && { sort_order: data.sortOrder }),
    })
    .where(eq(ontologyCompetencyQuestions.id, id))
    .returning()
  if (!row) throw new Error("Competency question was not found.")
  safeRevalidateOntologyRoot()
  return row
}

export async function deleteCQ(
  id: string,
  options?: CQMutationOptions
): Promise<void> {
  const executor = resolveExecutor(options)
  await assertOntologyRecordAccess(
    "ontology_competency_questions",
    id,
    executor
  )
  await executor
    .delete(ontologyCompetencyQuestions)
    .where(eq(ontologyCompetencyQuestions.id, id))
  safeRevalidateOntologyRoot()
}

export async function setCQModules(
  cqId: string,
  moduleIds: string[],
  options?: CQMutationOptions
): Promise<void> {
  const executor = resolveExecutor(options)
  await assertOntologyRecordAccess(
    "ontology_competency_questions",
    cqId,
    executor
  )
  await Promise.all(
    moduleIds.map((moduleId) =>
      assertOntologyRecordAccess("ontology_modules", moduleId, executor)
    )
  )
  await executor
    .delete(ontologyCompetencyQuestionModules)
    .where(eq(ontologyCompetencyQuestionModules.cq_id, cqId))

  if (moduleIds.length > 0) {
    await executor
      .insert(ontologyCompetencyQuestionModules)
      .values(
        moduleIds.map((moduleId) => ({ cq_id: cqId, module_id: moduleId }))
      )
  }
  safeRevalidateOntologyRoot()
}

export async function updateCQTriples(
  cqId: string,
  triples: CQTripleInput[],
  options?: CQMutationOptions
): Promise<void> {
  const executor = resolveExecutor(options)
  await assertOntologyRecordAccess(
    "ontology_competency_questions",
    cqId,
    executor
  )

  const updateInTx = async (tx: DrizzleDb) => {
    // 1. Delete previous triples for this CQ
    await tx.delete(ontologyCqTriples).where(eq(ontologyCqTriples.cq_id, cqId))

    // 2. Insert new triples if provided
    if (triples.length > 0) {
      await tx.insert(ontologyCqTriples).values(
        triples.map((t, idx) => ({
          cq_id: cqId,
          sort_order: t.sortOrder ?? idx,
          subject_class_id: t.subjectClassId ?? null,
          predicate_relation_id: t.predicateRelationId ?? null,
          object_class_id: t.objectClassId ?? null,
          subject_example_id: t.subjectExampleId ?? null,
          predicate_example_id: t.predicateExampleId ?? null,
          object_example_id: t.objectExampleId ?? null,
        }))
      )
    }

    // 3. Keep legacy single-triple columns in sync with the first hop
    const first = triples[0]
    await tx
      .update(ontologyCompetencyQuestions)
      .set({
        subject_class_id: first?.subjectClassId ?? null,
        predicate_relation_id: first?.predicateRelationId ?? null,
        object_class_id: first?.objectClassId ?? null,
        subject_example_id: first?.subjectExampleId ?? null,
        predicate_example_id: first?.predicateExampleId ?? null,
        object_example_id: first?.objectExampleId ?? null,
      })
      .where(eq(ontologyCompetencyQuestions.id, cqId))
  }

  if (options?.tx) {
    await updateInTx(executor)
  } else {
    await executor.transaction((tx) => updateInTx(tx as unknown as DrizzleDb))
  }

  safeRevalidateOntologyRoot()
}
