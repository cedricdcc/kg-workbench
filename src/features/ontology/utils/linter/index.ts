import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import type { OntologyRelation } from "@/domain/ontology"
import type {
  OntologyDefect,
  OntologyDefectReport,
} from "./types"
import {
  checkSubclassCycles,
  checkDanglingRelations,
  checkOrphanClasses,
  checkNearDuplicates,
  checkCompetingPatterns,
  checkInverseRelations,
  checkMetadataCompleteness,
} from "./rules"

export * from "./types"
export * from "./rules"

export interface RunOntologyLinterParams {
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  suppressedIds?: Set<string>
}

export function runOntologyLinter({
  classes,
  relations,
  suppressedIds = new Set<string>(),
}: RunOntologyLinterParams): OntologyDefectReport {
  const rawDefects: OntologyDefect[] = [
    ...checkSubclassCycles(classes),
    ...checkDanglingRelations(classes, relations),
    ...checkOrphanClasses(classes, relations),
    ...checkNearDuplicates(classes, relations),
    ...checkCompetingPatterns(classes),
    ...checkInverseRelations(relations),
    ...checkMetadataCompleteness(classes, relations),
  ]

  const activeDefects: OntologyDefect[] = []
  const suppressedDefects: OntologyDefect[] = []
  const defectsByTargetId: Record<string, OntologyDefect[]> = {}

  for (const defect of rawDefects) {
    if (suppressedIds.has(defect.id)) {
      suppressedDefects.push(defect)
      continue
    }

    activeDefects.push(defect)

    if (!defectsByTargetId[defect.targetId]) {
      defectsByTargetId[defect.targetId] = []
    }
    defectsByTargetId[defect.targetId].push(defect)
  }

  const counts = {
    error: 0,
    warning: 0,
    info: 0,
  }

  for (const d of activeDefects) {
    counts[d.severity]++
  }

  return {
    total: activeDefects.length,
    counts,
    defects: activeDefects,
    suppressed: suppressedDefects,
    defectsByTargetId,
    hasErrors: counts.error > 0,
    hasWarnings: counts.warning > 0,
  }
}
