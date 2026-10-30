"use server"

import {
  getClassBlastRadius,
  getRelationBlastRadius,
} from "../blast-radius/queries"
import type { BlastRadiusReport } from "../blast-radius/types"

export async function getClassBlastRadiusAction(
  ontologyId: string,
  classId: string
): Promise<BlastRadiusReport> {
  return await getClassBlastRadius(ontologyId, classId)
}

export async function getRelationBlastRadiusAction(
  ontologyId: string,
  relationId: string
): Promise<BlastRadiusReport> {
  return await getRelationBlastRadius(ontologyId, relationId)
}
