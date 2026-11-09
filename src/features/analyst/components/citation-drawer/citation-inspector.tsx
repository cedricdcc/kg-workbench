"use client"

import { BookOpen, FileText, Hash, Table as TableIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { AnalystCitation } from "../../types"

export interface CitationInspectorContentProps {
  citation: AnalystCitation | null
  className?: string
  onClose?: () => void
}

export function CitationInspectorContent({
  citation,
  className,
}: CitationInspectorContentProps) {
  if (!citation) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
        No citation selected.
      </div>
    )
  }

  const isTable = citation.sourceType === "table"
  const extendedCitation = citation as AnalystCitation & {
    contextText?: string
    contextPreview?: string
  }
  const context =
    extendedCitation.contextText || extendedCitation.contextPreview

  return (
    <div className={cn("space-y-5 text-xs", className)}>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="gap-1 px-2 py-0.5 text-[11px] font-medium capitalize"
        >
          {isTable ? (
            <TableIcon className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          <span>{isTable ? "Tabular Dataset" : "Document"}</span>
        </Badge>
      </div>

      {/* Source Name / Title */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {isTable ? "Table Name" : "Document Title"}
        </span>
        <div className="text-sm font-semibold break-words text-foreground">
          {citation.sourceName}
        </div>
      </div>

      {/* Source Coordinates */}
      <div className="grid grid-cols-2 gap-2">
        {citation.paragraphIndex !== undefined && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="text-[10px] font-medium text-muted-foreground">
              Paragraph
            </span>
            <div className="font-mono text-xs font-semibold text-foreground">
              §{citation.paragraphIndex}
            </div>
          </div>
        )}

        {(citation.pageFrom !== undefined || citation.pageTo !== undefined) && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <BookOpen className="h-3 w-3" /> Page
            </span>
            <div className="font-mono text-xs font-semibold text-foreground">
              {citation.pageFrom !== undefined ? citation.pageFrom : ""}
              {citation.pageTo !== undefined &&
              citation.pageTo !== citation.pageFrom
                ? ` - ${citation.pageTo}`
                : ""}
            </div>
          </div>
        )}

        {citation.tableRowKey && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Hash className="h-3 w-3" /> Row Key
            </span>
            <div className="truncate font-mono text-xs font-semibold text-foreground">
              {citation.tableRowKey}
            </div>
          </div>
        )}
      </div>

      {/* Verifiable Evidence Quote */}
      {citation.quoteText && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Verifiable Evidence Quote
          </span>
          <div
            className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-foreground italic shadow-xs"
            data-testid="citation-quote"
          >
            &ldquo;{citation.quoteText}&rdquo;
          </div>
        </div>
      )}

      {/* Context Preview */}
      {context && (
        <div className="space-y-1.5" data-testid="citation-context">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Context Preview
          </span>
          <div className="rounded-md border bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
            {context}
          </div>
        </div>
      )}
    </div>
  )
}

export interface CitationInspectorProps {
  citation: AnalystCitation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  inline?: boolean
  className?: string
  "data-testid"?: string
}

export function CitationInspector({
  citation,
  open,
  onOpenChange,
  inline = false,
  className,
  "data-testid": dataTestId = "analyst-citation-drawer",
}: CitationInspectorProps) {
  if (inline) {
    if (!open) return null
    return (
      <div
        className={cn(
          "w-full max-w-md rounded-lg border bg-card p-6 shadow-md",
          className
        )}
        data-testid={dataTestId}
      >
        <div className="mb-4 border-b pb-3">
          <h3 className="text-sm font-semibold">Citation Source</h3>
          <p className="text-xs text-muted-foreground">
            {citation?.sourceType === "table"
              ? "Tabular record verification"
              : "Unstructured document paragraph verification"}
          </p>
        </div>
        <CitationInspectorContent
          citation={citation}
          onClose={() => onOpenChange(false)}
        />
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("w-full overflow-y-auto sm:max-w-md", className)}
        data-testid={dataTestId}
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            {citation?.sourceType === "table" ? (
              <TableIcon className="h-4 w-4 text-primary" />
            ) : (
              <FileText className="h-4 w-4 text-primary" />
            )}
            <SheetTitle className="text-sm">Citation Source</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {citation?.sourceType === "table"
              ? "Tabular record verification"
              : "Unstructured document paragraph verification"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <CitationInspectorContent
            citation={citation}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
