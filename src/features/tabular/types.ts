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

