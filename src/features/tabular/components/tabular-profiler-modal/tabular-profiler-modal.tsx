"use client"

import { useState } from "react"
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
import type { TabularProfileResult } from "../../types"
import { formatFileSize } from "./formatters"
import { TabularSchemaTab } from "./schema-tab"
import { TabularPreviewTab } from "./preview-tab"

interface TabularProfilerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  isOffline?: boolean
  offlineMessage?: string
  composeCommand?: string
  result?: TabularProfileResult | null
  errorMessage?: string | null
  onSaveToArchive?: (result: TabularProfileResult) => void
  onMapToKg?: (result: TabularProfileResult) => void
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
  onSaveToArchive,
  onMapToKg,
}: TabularProfilerModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(composeCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Table2 className="h-5 w-5 text-primary" />
              Tabular Dataset Profile & Schema Inspector
            </DialogTitle>
            {!isLoading && !isOffline && result && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="font-mono text-xs">
                  {result.rowCount.toLocaleString()} rows
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {result.columnCount} cols
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatFileSize(result.estimatedSizeBytes)}
                </Badge>
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

        {!isLoading && !isOffline && result && (
          <Tabs defaultValue="schema" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schema">
                Schema ({result.columnCount})
              </TabsTrigger>
              <TabsTrigger value="preview">
                Data Preview ({result.previewRows.length})
              </TabsTrigger>
              <TabsTrigger value="keys">
                Candidate Keys ({result.candidateKeys.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schema" className="pt-2">
              <TabularSchemaTab columns={result.columns} />
            </TabsContent>

            <TabsContent value="preview" className="pt-2">
              <TabularPreviewTab
                rows={result.previewRows}
                columns={result.columns}
              />
            </TabsContent>

            <TabsContent value="keys" className="pt-2">
              <div className="space-y-3 p-2">
                <div className="text-xs text-muted-foreground">
                  Identified candidate unique keys based on non-null uniqueness
                  across all {result.rowCount.toLocaleString()} rows:
                </div>
                {result.candidateKeys.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {result.candidateKeys.map((keyGroup, idx) => (
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
                {onSaveToArchive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => onSaveToArchive(result)}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Save to Archive
                  </Button>
                )}
                {onMapToKg && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => onMapToKg(result)}
                  >
                    <Network className="h-3.5 w-3.5" />
                    Map to KG
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
