"use client"

import { useState, useRef } from "react"
import {
  Table2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Terminal,
  Loader2,
  Key,
  Layers,
  Bookmark,
  Network,
  Database,
  Upload,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { TabularProfileResult } from "../../types"
import type { RemoteDbConnectionConfig } from "../../server/actions/remote-database"
import {
  formatFileSize,
  resolveEffectiveProfilerResult,
  resolveEffectiveFileFormat,
  resolveEffectiveDatasetId,
} from "./formatters"
import { TabularSchemaTab } from "./schema-tab"
import { TabularPreviewTab } from "./preview-tab"
import { RemoteDatabaseTab } from "./remote-database-tab"

export interface TabularProfilerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  isOffline?: boolean
  offlineMessage?: string
  composeCommand?: string
  result?: TabularProfileResult | null
  errorMessage?: string | null
  datasetId?: string
  onSaveToArchive?: (
    result: TabularProfileResult,
    connectionConfig?: Record<string, unknown> | null,
    fileFormat?: string
  ) => void
  onMapToKg?: (
    result: TabularProfileResult,
    connectionConfig?: Record<string, unknown> | null,
    fileFormat?: string,
    datasetId?: string
  ) => void
  ontologyId?: string
  onFileUpload?: (file: File) => void
  defaultSourceTab?: "upload" | "database"
}

export function TabularProfilerModal({
  open,
  onOpenChange,
  isLoading = false,
  isOffline = false,
  offlineMessage,
  composeCommand = "bash deploy/scripts/deploy.sh postgres up --profile tabular",
  result,
  errorMessage,
  datasetId,
  onSaveToArchive,
  onMapToKg,
  ontologyId,
  onFileUpload,
  defaultSourceTab = "upload",
}: TabularProfilerModalProps) {
  const [copied, setCopied] = useState(false)
  const [sourceTab, setSourceTab] = useState<"upload" | "database">(
    defaultSourceTab
  )
  const [internalResult, setInternalResult] =
    useState<TabularProfileResult | null>(null)
  const [connectionConfig, setConnectionConfig] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [internalFileFormat, setInternalFileFormat] = useState<string>("csv")
  const [isSaving, setIsSaving] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [prevResult, setPrevResult] = useState(result)

  // Re-enable showing external result if a new/different result prop is passed
  if (result !== prevResult) {
    setPrevResult(result)
    setIsDismissed(false)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Derived active result: if user clicked "Choose Another Source", dismiss external result
  const effectiveResult = resolveEffectiveProfilerResult(
    result,
    internalResult,
    isDismissed
  )
  const activeResult = effectiveResult ?? null
  const isUsingInternal = isDismissed || Boolean(internalResult)
  const fileFormat = resolveEffectiveFileFormat(
    result,
    internalFileFormat,
    isUsingInternal
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInternalResult(null)
      setConnectionConfig(null)
      setInternalFileFormat("csv")
      setIsDismissed(false)
    }
    onOpenChange(nextOpen)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(composeCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProfileComplete = (
    res: TabularProfileResult,
    config?: RemoteDbConnectionConfig
  ) => {
    setInternalResult(res)
    setIsDismissed(false)
    if (config) {
      setConnectionConfig(config as unknown as Record<string, unknown>)
      setInternalFileFormat(config.dbType)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onFileUpload) {
      onFileUpload(file)
    }
  }

  const handleSave = async () => {
    if (!activeResult) return

    if (onSaveToArchive) {
      onSaveToArchive(activeResult, connectionConfig, fileFormat)
      return
    }

    if (ontologyId) {
      setIsSaving(true)
      try {
        const { archiveDatasetSourceAction } =
          await import("../../server/actions/archive-dataset-source")
        await archiveDatasetSourceAction({
          ontologyId,
          sourceName: activeResult.fileName,
          fileFormat: fileFormat || activeResult.fileType || "csv",
          rowCount: activeResult.rowCount,
          columnCount: activeResult.columnCount,
          profileSummary: {
            rowCount: activeResult.rowCount,
            columnCount: activeResult.columnCount,
            candidateKeys: activeResult.candidateKeys,
            columns: activeResult.columns,
          },
          sampleRows: activeResult.previewRows,
          connectionConfig,
        })
        queryClient.invalidateQueries({
          queryKey: ["dataset-sources", ontologyId],
        })
        toast.success(`Archived "${activeResult.fileName}"`)
      } catch {
        toast.error("Failed to archive dataset")
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleMap = () => {
    if (activeResult && onMapToKg) {
      const effectiveDatasetId = resolveEffectiveDatasetId(
        datasetId,
        isUsingInternal
      )
      onMapToKg(activeResult, connectionConfig, fileFormat, effectiveDatasetId)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Table2 className="h-5 w-5 text-primary" />
              Tabular Dataset Profile & Schema Inspector
            </DialogTitle>
            {!isLoading && !isOffline && activeResult && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="font-mono text-xs">
                  {activeResult.rowCount.toLocaleString()} rows
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {activeResult.columnCount} cols
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatFileSize(activeResult.estimatedSizeBytes)}
                </Badge>
                {connectionConfig && (
                  <Badge variant="default" className="text-[10px] uppercase">
                    {fileFormat}
                  </Badge>
                )}
              </div>
            )}
            {isOffline && (
              <Badge variant="destructive">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Tabular Worker
                  Offline
                </span>
              </Badge>
            )}
          </div>
          <DialogDescription>
            High-performance DuckDB analytical profiling, inferred types, null
            ratios, and candidate unique keys.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span>Running DuckDB analytical dataset profiling...</span>
          </div>
        )}

        {isOffline && (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>
                {offlineMessage || "Tabular worker service is offline"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              To enable high-performance DuckDB dataset profiling and schema
              induction, start the tabular worker:
            </p>
            <div className="flex items-center justify-between rounded bg-muted/60 px-3 py-2 font-mono text-xs text-foreground">
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                {composeCommand}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        {errorMessage && !isLoading && !isOffline && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <XCircle className="h-4 w-4" />
              <span>Dataset Profiling Failed</span>
            </div>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {/* Source Selection Tabs when no active result exists */}
        {!isLoading && !isOffline && !activeResult && (
          <Tabs
            value={sourceTab}
            onValueChange={(v) => setSourceTab(v as "upload" | "database")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-3.5 w-3.5" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                Remote Database
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 pt-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-sm font-medium">
                  Click to select CSV, Parquet, or Excel file
                </div>
                <div className="text-xs text-muted-foreground">
                  Supports .csv, .tsv, .parquet, .pq, .xlsx, .xls
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.parquet,.pq,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </TabsContent>

            <TabsContent value="database" className="pt-3">
              <RemoteDatabaseTab
                ontologyId={ontologyId || ""}
                onProfileComplete={handleProfileComplete}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Profiler Result Tabs */}
        {!isLoading && !isOffline && activeResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-foreground">
                Dataset:{" "}
                <code className="text-primary">{activeResult.fileName}</code>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px]"
                onClick={() => {
                  setInternalResult(null)
                  setConnectionConfig(null)
                  setIsDismissed(true)
                }}
              >
                <ArrowLeft className="h-3 w-3" />
                Choose Another Source
              </Button>
            </div>

            <Tabs defaultValue="schema" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="schema">
                  Schema ({activeResult.columnCount})
                </TabsTrigger>
                <TabsTrigger value="preview">
                  Data Preview ({activeResult.previewRows.length})
                </TabsTrigger>
                <TabsTrigger value="keys">
                  Candidate Keys ({activeResult.candidateKeys.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schema" className="pt-2">
                <TabularSchemaTab columns={activeResult.columns} />
              </TabsContent>

              <TabsContent value="preview" className="pt-2">
                <TabularPreviewTab
                  rows={activeResult.previewRows}
                  columns={activeResult.columns}
                />
              </TabsContent>

              <TabsContent value="keys" className="pt-2">
                <div className="space-y-3 p-2">
                  <div className="text-xs text-muted-foreground">
                    Identified candidate unique keys based on non-null
                    uniqueness across all{" "}
                    {activeResult.rowCount.toLocaleString()} rows:
                  </div>
                  {activeResult.candidateKeys.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeResult.candidateKeys.map((keyGroup, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                        >
                          <Key className="h-3.5 w-3.5" />
                          <span className="font-mono font-semibold">
                            {keyGroup.join(" + ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            (Primary key candidate)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      <span>
                        No single column satisfies unique non-null constraint.
                        Consider composite key identification or surrogate ID
                        induction.
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <div className="text-[11px] text-muted-foreground">
                  Dataset profiled via DuckDB analytical sidecar
                </div>
                <div className="flex items-center gap-2">
                  {(onSaveToArchive || ontologyId) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                      Save to Archive
                    </Button>
                  )}
                  {onMapToKg && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleMap}
                    >
                      <Network className="h-3.5 w-3.5" />
                      Map to KG
                    </Button>
                  )}
                </div>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
