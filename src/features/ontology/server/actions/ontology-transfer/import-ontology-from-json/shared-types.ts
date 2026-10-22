import { getDb } from "@/server/database"
export interface ImportIdMaps {
  moduleIdByLegacyId: Map<string, string>
  moduleIdByName: Map<string, string>
  oldAttributeIdToNewId: Map<string, string>
  oldClassIdToNewId: Map<string, string>
  oldClassIdToNewModuleId: Map<string, string | null>
  oldCQIdToNewId: Map<string, string>
  oldRelationAttributeIdToNewId: Map<string, string>
  oldRelationIdToNewId: Map<string, string>
}
export interface PendingCQExampleRef {
  cqId: string
  label: string
  objectExampleId: string | null | undefined
  predicateExampleId: string | null | undefined
  subjectExampleId: string | null | undefined
}
export interface PersistOntologyStructureResult {
  ontologyId: string
  idMaps: ImportIdMaps
}
type DbInstance = ReturnType<typeof getDb>
type TransactionInstance = Parameters<
  Parameters<DbInstance["transaction"]>[0]
>[0]
export type ServerClient = DbInstance | TransactionInstance
