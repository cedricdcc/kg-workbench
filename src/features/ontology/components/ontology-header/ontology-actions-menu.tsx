"use client"

import { type ChangeEvent, type RefObject } from "react"
import {
  BookMarked,
  ChevronDown,
  Download,
  FileJson,
  Import,
  Loader2,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface OntologyActionsMenuProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  isBusy: boolean
  hasCurrentDocument: boolean
  onCreate: () => void
  onImport: () => void
  onOpenImportFormat: () => void
  onExportJson: () => void
  onExportOwl: () => void
  onOpenOntologyDetails: () => void
  onOpenVocabularies: () => void
  onDelete: () => void
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export function OntologyActionsMenu({
  fileInputRef,
  isBusy,
  hasCurrentDocument,
  onCreate,
  onImport,
  onOpenImportFormat,
  onExportJson,
  onExportOwl,
  onOpenOntologyDetails,
  onOpenVocabularies,
  onDelete,
  onFileChange,
}: OntologyActionsMenuProps) {
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="flex shadow-sm">
        <Button
          variant="outline"
          size="sm"
          className="rounded-r-none border-r-0 shadow-none"
          onClick={onCreate}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-l-none px-2 shadow-none"
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {/* Document Group */}
            <DropdownMenuItem onClick={onImport}>
              <Import className="mr-2 h-4 w-4" />
              Import from JSON...
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasCurrentDocument}
              onClick={onExportJson}
            >
              <Download className="mr-2 h-4 w-4" />
              Export as JSON...
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasCurrentDocument}
              onClick={onExportOwl}
            >
              <Download className="mr-2 h-4 w-4" />
              Export as OWL...
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Tools & Metadata Group */}
            <DropdownMenuItem
              disabled={!hasCurrentDocument}
              onClick={onOpenOntologyDetails}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Ontology Details &amp; CQs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenVocabularies}>
              <BookMarked className="mr-2 h-4 w-4" />
              Reference Vocabularies
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-muted-foreground focus:text-foreground"
              onClick={onOpenImportFormat}
            >
              <FileJson className="mr-2 h-4 w-4" />
              JSON Schema Reference
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Danger Zone */}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={!hasCurrentDocument}
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Ontology...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
