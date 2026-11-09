import type {
  ArchivedDatasetSource,
  DatasetColumnMapping,
  DatasetMappingSpec,
  TabularColumnProfile,
} from "@/features/tabular/types"
import {
  autoDetectPii,
  type ColumnPrivacyConfig,
} from "@/features/tabular/server/services/pii-masker"

export type WizardStep = "entity" | "attributes" | "review"

export interface MappingValidationResult {
  isValid: boolean
  error?: string
}

export function validateMappingSpecBeforeCommit(
  spec: Partial<DatasetMappingSpec>
): MappingValidationResult {
  if (!spec.targetClassName || !spec.targetClassName.trim()) {
    return {
      isValid: false,
      error: "Target class name is required.",
    }
  }

  if (!spec.primaryKeyColumn || !spec.primaryKeyColumn.trim()) {
    return {
      isValid: false,
      error: "Primary key column is required for entity IRI generation.",
    }
  }

  return { isValid: true }
}

export interface DatasetMappingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ontologyId: string
  dataset: ArchivedDatasetSource | null
  existingClasses: Array<{
    id: string
    name: string
    description?: string | null
    attributes: Array<{ name: string; dataType: string }>
  }>
  existingRelations: Array<{
    id: string
    name: string
    domainClassName?: string
    rangeClassName?: string
  }>
  onMappingCommitted: () => void
}

export interface WizardState {
  targetClassId?: string
  targetClassName: string
  targetModuleId?: string
  primaryKeyColumn: string
  columnMappings: DatasetColumnMapping[]
  synthesizedElements: NonNullable<DatasetMappingSpec["synthesizedElements"]>
  privacyConfigs: ColumnPrivacyConfig[]
}

export function getDatasetCompositeKey(
  dataset: ArchivedDatasetSource | null
): string {
  if (!dataset) return ""
  const idPart = dataset.id?.trim() ? dataset.id : "ephemeral"
  const namePart = dataset.sourceName?.trim() || "untitled"
  return `${idPart}:${namePart}`
}

export function initializeWizardState(
  dataset: ArchivedDatasetSource | null
): WizardState {
  if (!dataset) {
    return {
      targetClassName: "",
      primaryKeyColumn: "",
      columnMappings: [],
      synthesizedElements: { classes: [], attributes: [], relations: [] },
      privacyConfigs: [],
    }
  }

  const rawColumns = dataset.profileSummary?.columns || []
  const sampleRows = dataset.sampleRows || []
  const privacyConfigs = autoDetectPii(
    rawColumns.map((c) => ({
      name: c.name,
      sampleValues: c.sampleValues,
    })),
    sampleRows
  )

  const existingSpec = dataset.mappingSpec
  if (existingSpec) {
    return {
      targetClassId: existingSpec.targetClassId,
      targetClassName: existingSpec.targetClassName,
      targetModuleId: existingSpec.targetModuleId,
      primaryKeyColumn: existingSpec.primaryKeyColumn,
      columnMappings: [...existingSpec.columnMappings],
      synthesizedElements: existingSpec.synthesizedElements || {
        classes: [],
        attributes: [],
        relations: [],
      },
      privacyConfigs,
    }
  }

  // Auto-seed from profile summary
  const candidateKey =
    dataset.profileSummary?.candidateKeys?.[0]?.[0] ||
    dataset.profileSummary?.columns?.find(
      (c: TabularColumnProfile) => c.isUniqueCandidate
    )?.name ||
    dataset.profileSummary?.columns?.[0]?.name ||
    ""

  const defaultClassName = dataset.sourceName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("")

  const columnMappings: DatasetColumnMapping[] = (
    dataset.profileSummary?.columns || []
  ).map((c: TabularColumnProfile) => ({
    columnName: c.name,
    inferredType: c.inferredKgType,
    targetKind: "attribute",
    targetAttributeName: c.name
      .replace(/[^a-zA-Z0-9]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w, idx) =>
        idx === 0
          ? w.toLowerCase()
          : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      )
      .join(""),
    targetDataType:
      c.inferredKgType === "number"
        ? "xsd:decimal"
        : c.inferredKgType === "boolean"
          ? "xsd:boolean"
          : c.inferredKgType === "date"
            ? "xsd:dateTime"
            : "xsd:string",
    isPrimaryKey: c.name === candidateKey,
  }))

  return {
    targetClassName: defaultClassName || "Entity",
    primaryKeyColumn: candidateKey,
    columnMappings,
    synthesizedElements: {
      classes: [],
      attributes: [],
      relations: [],
    },
    privacyConfigs,
  }
}
