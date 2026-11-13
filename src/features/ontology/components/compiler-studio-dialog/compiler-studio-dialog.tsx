"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Code2, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCompiledOntologyStudioDataAction } from "@/features/ontology/server/actions/compiler-studio"
import { CompilerFormatTabs } from "./compiler-format-tabs"
import type { CompilerStudioData, CompilerStudioTabId } from "./types"

export interface CompilerStudioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ontologyId: string | null
  ontologyName?: string
  initialTab?: CompilerStudioTabId
}

export function CompilerStudioDialog({
  open,
  onOpenChange,
  ontologyId,
  ontologyName,
  initialTab = "linkml",
}: CompilerStudioDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<CompilerStudioTabId>(initialTab)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["compiler-studio", ontologyId],
    queryFn: () => getCompiledOntologyStudioDataAction(ontologyId!),
    enabled: open && Boolean(ontologyId),
  })

  function handleDataUpdated(updated: CompilerStudioData) {
    queryClient.setQueryData(["compiler-studio", ontologyId], updated)
    router.refresh()
  }

  const issueCount = data?.artifacts.lint_issues.length ?? 0
  const errorIssueCount =
    data?.artifacts.lint_issues.filter(
      (i) => i.severity === "FATAL" || i.severity === "ERROR"
    ).length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-4 overflow-hidden sm:max-w-6xl">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              <DialogTitle>
                LinkML &amp; Code Compiler Studio
                {ontologyName || data?.ontologyName
                  ? ` — ${data?.ontologyName ?? ontologyName}`
                  : ""}
              </DialogTitle>
            </div>

            {data && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  sha256:{data.artifacts.source_sha256.slice(0, 12)}
                </Badge>
                <Badge
                  variant={
                    errorIssueCount > 0
                      ? "destructive"
                      : issueCount > 0
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs"
                >
                  {issueCount} lint {issueCount === 1 ? "note" : "notes"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  <RefreshCw
                    className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                  />
                  Recompile
                </Button>
              </div>
            )}
          </div>
          <DialogDescription>
            Edit canonical LinkML YAML or inspect and export compiled W3C SHACL,
            RDFS, OWL 2, Pydantic v2, JSON Schema, Mermaid ER, and OHI lockfile
            artifacts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {!ontologyId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select an ontology document to open the Compiler Studio.
            </div>
          ) : isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Compiling LinkML artifacts...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-destructive">
                {error instanceof Error
                  ? error.message
                  : "Failed to load Compiler Studio data."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          ) : data ? (
            <CompilerFormatTabs
              data={data}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onDataUpdated={handleDataUpdated}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
