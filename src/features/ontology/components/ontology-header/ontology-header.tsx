"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { CreateOntologyDialog } from "@/features/ontology/components/dialogs/create-ontology-dialog"
import { ExportOntologyDialog } from "@/features/ontology/components/export-ontology-dialog/export-ontology-dialog"
import { ImportFormatDialog } from "@/features/ontology/components/import-format-dialog/import-format-dialog"
import { ReferenceVocabulariesDialog } from "@/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog"
import { CompilerStudioDialog } from "@/features/ontology/components/compiler-studio-dialog/compiler-studio-dialog"
import { ReasonerReportModal } from "../reasoner-modal/reasoner-report-modal"
import { useReasonerJob } from "../../hooks/use-reasoner-job"
import {
  requestOntologyReasoningAction,
  type ReasonerResultPayload,
} from "../../server/actions/run-ontology-reasoning"
import { TabularProfilerModal } from "@/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal"
import { useTabularJob } from "@/features/tabular/hooks/use-tabular-job"
import { requestTabularProfilingAction } from "@/features/tabular/server/actions/profile-tabular-dataset"
import type { TabularProfileResult } from "@/features/tabular/types"
import type { ExportOntologyMode } from "@/features/ontology/components/export-ontology-dialog/types"
import { deleteOntologyDocument } from "@/features/ontology/server/actions/ontology-documents"
import {
  importOntologyFromJson,
  importOntologyFromTurtle,
} from "@/features/ontology/server/actions/ontology-transfer"
import { routes } from "@/lib/routes"
import type {
  OntologyDocument,
  OntologyLanguage,
  OntologyLocalizedText,
  OntologyRelation,
} from "@/domain/ontology"
import type {
  OntologyClassWithAttributes,
  OntologyDocumentWithModules,
} from "@/features/ontology/server/queries"

import { DocumentSelector } from "./document-selector"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { OntologyActionsMenu } from "./ontology-actions-menu"
import {
  OntologyViewToggle,
  type OntologyViewMode,
} from "./ontology-view-toggle"
export type { OntologyViewMode }
import { OntologyIssuesPill } from "./ontology-issues-pill"
import type { OntologyDefectReport } from "@/features/ontology/utils/linter"
import type { IssuesCounts } from "@/features/ontology/utils/issues-summary"

export interface OntologyHeaderProps {
  documents: OntologyDocument[]
  currentDocument: OntologyDocumentWithModules | null
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  languages: OntologyLanguage[]
  localizedTexts: OntologyLocalizedText[]
  isVisual: boolean
  onVisualToggle?: (checked: boolean) => void
  viewMode?: OntologyViewMode
  onViewModeChange?: (mode: OntologyViewMode) => void
  cqCount?: number
  onOpenOntologyDetails?: () => void
  onOpenVocabularies?: () => void
  onOpenCompilerStudio?: () => void
  issuesCounts?: IssuesCounts
  onOpenIssuesSheet?: () => void
  defectsReport?: OntologyDefectReport
  onOpenDefectsSheet?: () => void
}

export function OntologyHeader({
  documents,
  currentDocument,
  classes,
  relations,
  languages,
  localizedTexts,
  isVisual,
  onVisualToggle,
  viewMode,
  onViewModeChange,
  cqCount = 0,
  onOpenOntologyDetails,
  onOpenVocabularies,
  onOpenCompilerStudio,
  issuesCounts,
  onOpenIssuesSheet,
  defectsReport,
  onOpenDefectsSheet,
}: OntologyHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const turtleFileInputRef = useRef<HTMLInputElement>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importFormatOpen, setImportFormatOpen] = useState(false)
  const [vocabulariesOpen, setVocabulariesOpen] = useState(false)
  const [compilerStudioOpen, setCompilerStudioOpen] = useState(false)
  const [exportMode, setExportMode] = useState<ExportOntologyMode>("json")
  const [isDeleting, setIsDeleting] = useState(false)
  const [reasonerModalOpen, setReasonerModalOpen] = useState(false)
  const [reasonerLoading, setReasonerLoading] = useState(false)
  const [reasonerOffline, setReasonerOffline] = useState(false)
  const [reasonerOfflineMsg, setReasonerOfflineMsg] = useState("")
  const [reasonerComposeCmd, setReasonerComposeCmd] = useState("")
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [reasonerResult, setReasonerResult] = useState<ReasonerResultPayload | null>(null)

  const { data: polledJob } = useReasonerJob(activeJobId)

  useEffect(() => {
    if (polledJob?.status === "failed") {
      toast.error(polledJob.errorDetails || "Reasoner job failed")
    }
  }, [polledJob?.status, polledJob?.errorDetails])

  const displayedReasonerResult =
    polledJob?.status === "completed" && polledJob.result
      ? polledJob.result
      : reasonerResult

  const isPolledLoading =
    reasonerLoading ||
    (activeJobId !== null &&
      (!polledJob || polledJob.status === "pending" || polledJob.status === "claimed"))

  const reasonerErrorMessage =
    polledJob?.status === "failed"
      ? polledJob.errorDetails || "Reasoner validation failed"
      : null

  function handleCloseReasonerModal(open: boolean) {
    setReasonerModalOpen(open)
    if (!open) {
      setActiveJobId(null)
      setReasonerLoading(false)
    }
  }

  const tabularFileRef = useRef<HTMLInputElement | null>(null)
  const [tabularModalOpen, setTabularModalOpen] = useState(false)
  const [tabularLoading, setTabularLoading] = useState(false)
  const [tabularOffline, setTabularOffline] = useState(false)
  const [tabularOfflineMsg, setTabularOfflineMsg] = useState("")
  const [tabularComposeCmd, setTabularComposeCmd] = useState("")
  const [activeTabularJobId, setActiveTabularJobId] = useState<string | null>(null)
  const [tabularResult, setTabularResult] = useState<TabularProfileResult | null>(null)

  const { data: polledTabularJob } = useTabularJob(activeTabularJobId)

  useEffect(() => {
    if (polledTabularJob?.status === "failed") {
      toast.error(polledTabularJob.errorDetails || "Tabular profiling failed")
    }
  }, [polledTabularJob?.status, polledTabularJob?.errorDetails])

  const displayedTabularResult =
    polledTabularJob?.status === "completed" && polledTabularJob.result
      ? polledTabularJob.result
      : tabularResult

  const isTabularPolledLoading =
    tabularLoading ||
    (activeTabularJobId !== null &&
      (!polledTabularJob ||
        polledTabularJob.status === "pending" ||
        polledTabularJob.status === "claimed"))

  const tabularErrorMessage =
    polledTabularJob?.status === "failed"
      ? polledTabularJob.errorDetails || "Tabular profiling failed"
      : null

  function handleCloseTabularModal(open: boolean) {
    setTabularModalOpen(open)
    if (!open) {
      setActiveTabularJobId(null)
      setTabularLoading(false)
    }
  }

  function handleOpenTabularPicker() {
    tabularFileRef.current?.click()
  }

  async function handleTabularFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setTabularLoading(true)
    setTabularOffline(false)
    setTabularResult(null)
    setActiveTabularJobId(null)
    setTabularModalOpen(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const resp = await requestTabularProfilingAction(formData)
      if (resp.status === "offline") {
        setTabularOffline(true)
        setTabularOfflineMsg(resp.message)
        setTabularComposeCmd(resp.composeCommand)
        setTabularLoading(false)
        return
      }
      if (resp.status === "completed") {
        setTabularResult(resp.result)
        setTabularLoading(false)
        return
      }
      if (resp.status === "failed") {
        setTabularLoading(false)
        toast.error(resp.error || "Tabular profiling failed")
        return
      }
      if (resp.status === "pending") {
        setActiveTabularJobId(resp.jobId)
        setTabularLoading(false)
      }
    } catch (err) {
      setTabularLoading(false)
      toast.error(err instanceof Error ? err.message : "Failed to run tabular profiling")
    } finally {
      if (tabularFileRef.current) {
        tabularFileRef.current.value = ""
      }
    }
  }

  async function handleRunReasoner() {
    if (!currentDocument) return
    setReasonerLoading(true)
    setReasonerOffline(false)
    setReasonerResult(null)
    setActiveJobId(null)
    setReasonerModalOpen(true)

    try {
      const resp = await requestOntologyReasoningAction(currentDocument.id)
      if (resp.status === "offline") {
        setReasonerOffline(true)
        setReasonerOfflineMsg(resp.message)
        setReasonerComposeCmd(resp.composeCommand)
        setReasonerLoading(false)
        return
      }
      if (resp.status === "completed") {
        setReasonerResult(resp.result)
        setReasonerLoading(false)
        return
      }
      if (resp.status === "failed") {
        setReasonerLoading(false)
        toast.error(resp.error || "Reasoner validation failed")
        return
      }
      if (resp.status === "pending") {
        setActiveJobId(resp.jobId)
        setReasonerLoading(false)
      }
    } catch (err) {
      setReasonerLoading(false)
      toast.error(err instanceof Error ? err.message : "Failed to run reasoning")
    }
  }

  const hasCurrentDocument = currentDocument !== null

  function handleDocumentChange(docId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("doc", docId)
    router.push(`${routes.ontology.root}?${params.toString()}`)
  }

  function openExport(mode: ExportOntologyMode) {
    if (!currentDocument) return
    setExportMode(mode)
    setExportOpen(true)
  }

  async function handleDelete() {
    if (!currentDocument) return

    setIsDeleting(true)
    try {
      await deleteOntologyDocument(currentDocument.id)
      const remaining = documents.filter(
        (document) => document.id !== currentDocument.id
      )
      if (remaining.length > 0) {
        const params = new URLSearchParams()
        params.set("doc", remaining[0].id)
        router.push(`${routes.ontology.root}?${params.toString()}`)
      } else {
        router.push(routes.ontology.root)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.")
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected if needed.
    e.target.value = ""

    setIsImporting(true)
    try {
      const { ontologyId, warnings } = await importOntologyFromJson(file)
      if (warnings.length > 0) {
        toast.warning("Imported with visual warnings.", {
          description: warnings.slice(0, 3).join(" "),
        })
      }
      const params = new URLSearchParams()
      params.set("doc", ontologyId)
      router.push(`${routes.ontology.root}?${params.toString()}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.")
    } finally {
      setIsImporting(false)
    }
  }

  async function handleTurtleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setIsImporting(true)
    try {
      const { ontologyId, warnings } = await importOntologyFromTurtle(file)
      if (warnings.length > 0) {
        toast.warning("Imported with visual warnings.", {
          description: warnings.slice(0, 3).join(" "),
        })
      } else {
        toast.success("Ontology imported from Turtle successfully.")
      }
      const params = new URLSearchParams()
      params.set("doc", ontologyId)
      router.push(`${routes.ontology.root}?${params.toString()}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Turtle import failed.")
    } finally {
      setIsImporting(false)
    }
  }

  function handleOpenVocabularies() {
    if (onOpenVocabularies) {
      onOpenVocabularies()
    } else {
      setVocabulariesOpen(true)
    }
  }

  function handleOpenCompilerStudio() {
    if (onOpenCompilerStudio) {
      onOpenCompilerStudio()
    } else {
      setCompilerStudioOpen(true)
    }
  }

  const activeCounts =
    issuesCounts ??
    (defectsReport
      ? defectsReport.counts
      : { error: 0, warning: 0, suggestion: 0, info: 0 })

  const handleOpenIssues = onOpenIssuesSheet ?? onOpenDefectsSheet

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2">
      <h1 className="font-heading text-lg font-semibold">Ontology</h1>

      {/* Landmark 1: Document Selector */}
      <DocumentSelector
        documents={documents}
        currentDocumentId={currentDocument?.id ?? null}
        disabled={!hasCurrentDocument}
        placeholder={
          hasCurrentDocument ? "Select ontology" : "No ontology selected"
        }
        onDocumentChange={handleDocumentChange}
      />

      {/* Landmark 2: Consolidated Actions Menu */}
      <OntologyActionsMenu
        fileInputRef={fileInputRef}
        turtleFileInputRef={turtleFileInputRef}
        isBusy={isImporting}
        hasCurrentDocument={hasCurrentDocument}
        onCreate={() => setCreateOpen(true)}
        onImport={() => fileInputRef.current?.click()}
        onImportTurtle={() => turtleFileInputRef.current?.click()}
        onOpenImportFormat={() => setImportFormatOpen(true)}
        onExportJson={() => openExport("json")}
        onExportOwl={() => openExport("owl")}
        onExportShacl={() => openExport("shacl")}
        onRunReasoner={handleRunReasoner}
        onProfileTabular={handleOpenTabularPicker}
        onOpenOntologyDetails={() => onOpenOntologyDetails?.()}
        onOpenVocabularies={handleOpenVocabularies}
        onOpenCompilerStudio={handleOpenCompilerStudio}
        onDelete={() => setDeleteOpen(true)}
        onFileChange={handleFileChange}
        onTurtleFileChange={handleTurtleFileChange}
      />

      <div className="flex-1" />

      {/* Landmark 3: Unified Issue Info Pill */}
      {hasCurrentDocument && (
        <OntologyIssuesPill
          counts={activeCounts}
          onClick={handleOpenIssues}
          disabled={!hasCurrentDocument}
        />
      )}

      {/* Landmark 4: View Mode Switch (Schema | Questions | Visual) */}
      <OntologyViewToggle
        viewMode={viewMode ?? (isVisual ? "visual" : "schema")}
        disabled={!hasCurrentDocument}
        cqCount={cqCount}
        onViewModeChange={(mode) => {
          if (onViewModeChange) {
            onViewModeChange(mode)
          } else {
            onVisualToggle?.(mode === "visual")
          }
        }}
      />

      {/* Dialogs spawned from actions */}
      <CreateOntologyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(docId) => {
          const params = new URLSearchParams()
          params.set("doc", docId)
          router.push(`${routes.ontology.root}?${params.toString()}`)
        }}
      />

      <ImportFormatDialog
        open={importFormatOpen}
        onOpenChange={setImportFormatOpen}
      />

      {currentDocument && (
        <ExportOntologyDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          mode={exportMode}
          ontologyId={currentDocument.id}
          ontologyName={currentDocument.name}
          defaultLanguage={currentDocument.default_language}
          localizedTexts={localizedTexts}
          languages={languages}
          modules={currentDocument.modules}
          ontologyUsecase={currentDocument.usecase}
          classes={classes}
          relations={relations}
        />
      )}

      {currentDocument && (
        <DeleteConfirmationDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          documentName={currentDocument.name}
        />
      )}

      <ReasonerReportModal
        open={reasonerModalOpen}
        onOpenChange={handleCloseReasonerModal}
        isLoading={isPolledLoading}
        isOffline={reasonerOffline}
        offlineMessage={reasonerOfflineMsg}
        composeCommand={reasonerComposeCmd}
        result={displayedReasonerResult}
        errorMessage={reasonerErrorMessage}
      />

      <input
        ref={tabularFileRef}
        type="file"
        accept=".csv,.tsv,.parquet,.pq,.xlsx,.xls"
        className="hidden"
        onChange={handleTabularFileChange}
      />

      <TabularProfilerModal
        open={tabularModalOpen}
        onOpenChange={handleCloseTabularModal}
        isLoading={isTabularPolledLoading}
        isOffline={tabularOffline}
        offlineMessage={tabularOfflineMsg}
        composeCommand={tabularComposeCmd}
        result={displayedTabularResult}
        errorMessage={tabularErrorMessage}
      />

      <ReferenceVocabulariesDialog
        open={vocabulariesOpen}
        onOpenChange={setVocabulariesOpen}
      />

      <CompilerStudioDialog
        open={compilerStudioOpen}
        onOpenChange={setCompilerStudioOpen}
        ontologyId={currentDocument?.id ?? null}
        ontologyName={currentDocument?.name}
      />
    </div>
  )
}
