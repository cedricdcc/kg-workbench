"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2, PackageCheck } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { exportKnowledgeGraphBundleAction } from "../../server/actions/export-kg-bundle"
import { BundleArtifactSelector } from "./bundle-artifact-selector"
import { ProvoLineagePreview } from "./provo-lineage-preview"
import { PydanticUsageSnippet } from "./pydantic-usage-snippet"
import type { ExportKgBundleDialogProps } from "./types"

export function ExportKgBundleDialog({
  documentId,
  open,
  onOpenChange,
}: ExportKgBundleDialogProps) {
  const {
    data: bundle,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["kg-export-bundle", documentId],
    queryFn: () => exportKnowledgeGraphBundleAction(documentId!),
    enabled: open && Boolean(documentId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(92vw,960px)] max-w-none flex-col gap-4 overflow-hidden sm:max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-4" />
            <span>Export Knowledge Graph Bundle</span>
          </DialogTitle>
          <DialogDescription>
            Self-contained W3C PROV-O, RDFS, SHACL, Pydantic v2, and OHI
            lockfile bundle for{" "}
            <span className="font-medium text-foreground">
              {bundle?.documentTitle ?? "the selected document"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Assembling Knowledge Graph bundle…</span>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            {error instanceof Error
              ? error.message
              : "Failed to export Knowledge Graph bundle."}
          </div>
        ) : bundle ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <ProvoLineagePreview bundle={bundle} />
            <BundleArtifactSelector bundle={bundle} />
            <PydanticUsageSnippet />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
