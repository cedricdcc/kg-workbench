"use server"
import { asc, eq, inArray } from "drizzle-orm"
import type { OntologyModule } from "@/domain/ontology"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
  ontologyModules,
} from "@/server/db/schema"
import type { OntologyCqTriple } from "@/domain/ontology"
import type { OntologyCQWithModules } from "./types"

async function withModulesAndTriples(
  cqs: (typeof ontologyCompetencyQuestions.$inferSelect)[]
): Promise<OntologyCQWithModules[]> {
  if (!cqs.length) return []
  const db = getDb()
  const cqIds = cqs.map((cq) => cq.id)

  const [links, triples] = await Promise.all([
    db
      .select({
        cq_id: ontologyCompetencyQuestionModules.cq_id,
        module: { id: ontologyModules.id, name: ontologyModules.name },
      })
      .from(ontologyCompetencyQuestionModules)
      .innerJoin(
        ontologyModules,
        eq(ontologyCompetencyQuestionModules.module_id, ontologyModules.id)
      )
      .where(inArray(ontologyCompetencyQuestionModules.cq_id, cqIds)),
    db
      .select()
      .from(ontologyCqTriples)
      .where(inArray(ontologyCqTriples.cq_id, cqIds))
      .orderBy(asc(ontologyCqTriples.sort_order)),
  ])

  const modulesByCq = new Map<string, Pick<OntologyModule, "id" | "name">[]>()
  for (const link of links) {
    const values = modulesByCq.get(link.cq_id) ?? []
    values.push(link.module)
    modulesByCq.set(link.cq_id, values)
  }

  const triplesByCq = new Map<string, OntologyCqTriple[]>()
  for (const t of triples) {
    const values = triplesByCq.get(t.cq_id) ?? []
    values.push(t)
    triplesByCq.set(t.cq_id, values)
  }

  return cqs.map((cq) => ({
    ...cq,
    modules: modulesByCq.get(cq.id) ?? [],
    triples: triplesByCq.get(cq.id) ?? [],
  }))
}
export async function getOntologyCQs(
  ontologyId: string
): Promise<OntologyCQWithModules[]> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)
  return withModulesAndTriples(
    await db
      .select()
      .from(ontologyCompetencyQuestions)
      .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId))
      .orderBy(asc(ontologyCompetencyQuestions.sort_order))
  )
}
export async function getOntologyCQsByModule(
  moduleId: string
): Promise<OntologyCQWithModules[]> {
  const db = getDb()
  await assertOntologyRecordAccess("ontology_modules", moduleId, db)
  const links = await db
    .select({ cq: ontologyCompetencyQuestions })
    .from(ontologyCompetencyQuestionModules)
    .innerJoin(
      ontologyCompetencyQuestions,
      eq(
        ontologyCompetencyQuestionModules.cq_id,
        ontologyCompetencyQuestions.id
      )
    )
    .where(eq(ontologyCompetencyQuestionModules.module_id, moduleId))
  return withModulesAndTriples(links.map((link) => link.cq))
}
