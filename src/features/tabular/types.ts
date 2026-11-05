export interface TabularColumnProfile {
  name: string
  duckdbType: string
  inferredKgType: "string" | "number" | "boolean" | "date"
  nullCount: number
  nullPercentage: number
  distinctCount: number
  isUniqueCandidate: boolean
  minValue?: string | number | null
  maxValue?: string | number | null
  sampleValues: Array<string | number | boolean>
}

export interface TabularProfileResult {
  fileName: string
  fileType: string
  rowCount: number
  columnCount: number
  estimatedSizeBytes: number
  columns: TabularColumnProfile[]
  candidateKeys: string[][]
  previewRows: Record<string, unknown>[]
  processedBy?: string
}

export type TabularActionResponse =
  | {
      status: "completed"
      jobId: string
      result: TabularProfileResult
    }
  | {
      status: "pending"
      jobId: string
    }
  | {
      status: "failed"
      jobId: string
      error: string
    }
  | {
      status: "offline"
      message: string
      composeCommand: string
    }

export interface DatasetColumnMapping {
  columnName: string
  inferredType: "string" | "number" | "boolean" | "date"
  targetKind: "attribute" | "relation" | "ignore"
  targetAttributeName?: string
  targetDataType?: string
  targetRelationName?: string
  targetClassId?: string
  isPrimaryKey?: boolean
}

export interface DatasetMappingSpec {
  targetClassId?: string
  targetClassName: string
  targetModuleId?: string
  primaryKeyColumn: string
  columnMappings: DatasetColumnMapping[]
  synthesizedElements?: {
    classes?: Array<{ name: string; description?: string; moduleId?: string }>
    attributes?: Array<{ className: string; name: string; dataType: string }>
    relations?: Array<{
      name: string
      sourceClass: string
      targetClass: string
    }>
  }
}

export interface ArchivedDatasetSource {
  id: string
  ontologyId: string
  groupKey: string
  sourceName: string
  fileFormat: "csv" | "parquet" | "excel"
  rowCount: number
  columnCount: number
  profileSummary: {
    rowCount: number
    columnCount: number
    candidateKeys: string[][]
    columns: TabularColumnProfile[]
  }
  sampleRows: Record<string, unknown>[]
  mappingSpec: DatasetMappingSpec | null
  createdAt: string
  updatedAt: string
}
