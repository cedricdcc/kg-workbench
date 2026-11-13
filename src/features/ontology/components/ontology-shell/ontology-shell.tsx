"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePathname, useSearchParams } from "next/navigation"

import type {
  OntologyDocument,
  OntologyExample,
  OntologyLanguage,
  OntologyLocalizedText,
  OntologyNote,
  OntologyRelation,
  OntologyRelationAttribute,
} from "@/domain/ontology"
import type {
  ClassPositionsByModule,
  ModuleLayoutMap,
  OntologyClassWithAttributes,
  OntologyCQWithModules,
  OntologyDocumentWithModules,
} from "@/features/ontology/server/queries"
import { ClassBrowser } from "../class-browser/class-browser"
import { ClassDetail } from "../class-detail/class-detail"
import { EmptyState } from "../shared/empty-state"
import { ModuleTabBar } from "../module-tab-bar"
import { OntologyHeader, type OntologyViewMode } from "../ontology-header"
import { RelationBrowser } from "../relation-browser/relation-browser"
import { RelationDetail } from "../relation-detail/relation-detail"
import type { EntityType } from "../entity-type-tabs"
import { ModuleDetail } from "../module-detail/module-detail"
import { OntologyDetailsDialog } from "../ontology-details-dialog/ontology-details-dialog"
import type { OntologyDetailsTab } from "../ontology-details-dialog/types"
import { DetailPanelShell } from "./detail-panel-shell"
import { LeftBrowserPanel } from "./left-browser-panel"
import { CqWorkbench } from "../cq-workbench"
import {
  getDetailEmptyStateDescription,
  getDetailPanelTitle,
  getSelectedClass,
  getSelectedRelation,
} from "./selection"
import { VisualRegion } from "./visual-region"
import {
  filterExamples,
  filterLocalizedTexts,
  filterNotes,
} from "../shared/metadata-target"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getReferenceOntologies } from "@/features/ontology/server/queries/reference-vocabularies"
import { ReferenceBrowser } from "../reference-browser/reference-browser"
import { StandardsBrowser } from "../standards-browser/standards-browser"
import {
  ReferenceTermDetail,
  type SelectedReferenceTerm,
} from "../reference-browser/reference-term-detail"
import { ReasonerBrowser } from "../reasoner-browser/reasoner-browser"
import { ReasonerReportModal } from "../reasoner-modal/reasoner-report-modal"
import { DatasetArchiveBrowser } from "@/features/tabular/components/dataset-archive-browser/dataset-archive-browser"
import { TabularProfilerModal } from "@/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal"
import { DatasetMappingModal } from "@/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal"
import { getDatasetSourcesQuery } from "@/features/tabular/server/queries/get-dataset-sources"
import { deleteDatasetSourceAction } from "@/features/tabular/server/actions/delete-dataset-source"
import { archiveDatasetSourceAction } from "@/features/tabular/server/actions/archive-dataset-source"
import { getLatestReasonerRunQuery } from "@/features/tabular/server/queries/get-latest-reasoner-run"
import { requestOntologyReasoningAction } from "@/features/ontology/server/actions/run-ontology-reasoning"
import { useReasonerJob } from "@/features/ontology/hooks/use-reasoner-job"
import { requestTabularProfilingAction } from "@/features/tabular/server/actions/profile-tabular-dataset"
import type {
  TabularProfileResult,
  ArchivedDatasetSource,
} from "@/features/tabular/types"
import { ReferenceVocabulariesDialog } from "../reference-vocabularies-dialog/reference-vocabularies-dialog"
import { CompilerStudioDialog } from "../compiler-studio-dialog/compiler-studio-dialog"
import {
  runOntologyLinter,
  type OntologyDefect,
} from "@/features/ontology/utils/linter"
import { getDefectSuppressions } from "@/features/ontology/server/queries/defect-suppressions"
import { toggleDefectSuppression } from "@/features/ontology/server/actions/defect-suppressions"
import { updateClass } from "@/features/ontology/server/actions/classes"
import { deleteRelation } from "@/features/ontology/server/actions/relations"
import { runFullOntologyAnalysis } from "@/features/ontology/server/actions/ontology-analysis"
import { getOntologyDiagnosticsAction } from "@/features/ontology/server/actions/ontology-diagnostics"
import { syncOhiLockfileAction } from "@/features/ontology/server/actions/ohi-packages"
import { addReferenceOntology } from "@/features/ontology/server/actions/reference-vocabularies"
import type { RecommendedVocabulary } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"
import { OntologyIssuesSheet } from "../ontology-issues"

export interface OntologyShellProps {
  documents: OntologyDocument[]
  currentDocument: OntologyDocumentWithModules
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  savedPositions: ClassPositionsByModule
  savedModuleLayouts: ModuleLayoutMap
  languages: OntologyLanguage[]
  cqs: OntologyCQWithModules[]
  ontologyLocalizedTexts: OntologyLocalizedText[]
  allLocalizedTexts: OntologyLocalizedText[]
  notes: OntologyNote[]
  examples: OntologyExample[]
  relationAttributesByRelation: Record<string, OntologyRelationAttribute[]>
}

export function OntologyShell({
  documents,
  currentDocument,
  classes,
  relations,
  savedPositions,
  savedModuleLayouts,
  languages,
  cqs,
  ontologyLocalizedTexts,
  allLocalizedTexts,
  notes,
  examples,
  relationAttributesByRelation,
}: OntologyShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawView = searchParams.get("view")
  const urlViewMode: OntologyViewMode =
    rawView === "questions" || rawView === "visual" || rawView === "schema"
      ? rawView
      : "schema"

  const [activeViewMode, setActiveViewMode] =
    useState<OntologyViewMode>(urlViewMode)
  const [prevUrlView, setPrevUrlView] = useState(urlViewMode)

  if (prevUrlView !== urlViewMode) {
    setPrevUrlView(urlViewMode)
    setActiveViewMode(urlViewMode)
  }

  const viewMode = activeViewMode
  const isVisual = viewMode === "visual"

  function handleViewModeChange(mode: OntologyViewMode) {
    setActiveViewMode(mode)
    const params = new URLSearchParams(searchParams.toString())
    if (mode === "schema") {
      params.delete("view")
    } else {
      params.set("view", mode)
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [activeEntityType, setActiveEntityType] =
    useState<EntityType>("classes")
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedEntityKind, setSelectedEntityKind] = useState<
    "class" | "relation" | null
  >(null)
  const [selectedModuleDetailId, setSelectedModuleDetailId] = useState<
    string | null
  >(null)
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsTab, setDetailsTab] = useState<OntologyDetailsTab>("overview")
  const [cqCreateModuleId, setCqCreateModuleId] = useState<string | null>(null)
  const [cqCreateRequestId, setCqCreateRequestId] = useState(0)
  const [cqFilterModuleId, setCqFilterModuleId] = useState<string | null>(null)
  const [cqFilterRequestId, setCqFilterRequestId] = useState(0)
  const [selectedReferenceTerm, setSelectedReferenceTerm] =
    useState<SelectedReferenceTerm | null>(null)
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false)
  const [compilerStudioOpen, setCompilerStudioOpen] = useState(false)

  const { data: referenceVocabularies = [] } = useQuery({
    queryKey: ["reference-ontologies"],
    queryFn: () => getReferenceOntologies(),
  })

  const { data: suppressions = [] } = useQuery({
    queryKey: ["ontology-defect-suppressions", currentDocument.id],
    queryFn: () => getDefectSuppressions(currentDocument.id),
    enabled: Boolean(currentDocument.id),
  })

  // Reasoner and Dataset Archive State
  const queryClient = useQueryClient()
  const [reasonerActiveJobId, setReasonerActiveJobId] = useState<string | null>(
    null
  )
  const [reasonerReportModalOpen, setReasonerReportModalOpen] = useState(false)
  const [selectedDatasetForMapping, setSelectedDatasetForMapping] =
    useState<ArchivedDatasetSource | null>(null)
  const [profilerModalOpen, setProfilerModalOpen] = useState(false)
  const [profiledDatasetResult, setProfiledDatasetResult] =
    useState<TabularProfileResult | null>(null)
  const [inspectedDatasetId, setInspectedDatasetId] = useState<string | null>(
    null
  )
  const [isProfilingDataset, setIsProfilingDataset] = useState(false)

  const { data: archivedDatasets = [] } = useQuery({
    queryKey: ["dataset-sources", currentDocument.id],
    queryFn: () => getDatasetSourcesQuery(currentDocument.id),
    enabled: Boolean(currentDocument.id),
  })

  const { data: latestReasonerRun } = useQuery({
    queryKey: ["latest-reasoner-run", currentDocument.id],
    queryFn: () => getLatestReasonerRunQuery(currentDocument.id),
    enabled: Boolean(currentDocument.id),
  })

  const { data: polledReasonerJob } = useReasonerJob(reasonerActiveJobId)
  const prevJobStatusRef = useRef<string | undefined>(undefined)

  const isReasonerLoading =
    reasonerActiveJobId !== null &&
    (!polledReasonerJob ||
      polledReasonerJob.status === "pending" ||
      polledReasonerJob.status === "claimed")

  useEffect(() => {
    if (prevJobStatusRef.current !== polledReasonerJob?.status) {
      prevJobStatusRef.current = polledReasonerJob?.status
      if (polledReasonerJob?.status === "completed") {
        queryClient.invalidateQueries({
          queryKey: ["latest-reasoner-run", currentDocument.id],
        })
      } else if (polledReasonerJob?.status === "failed") {
        toast.error(
          polledReasonerJob.errorDetails || "Reasoner validation failed"
        )
      }
    }
  }, [
    polledReasonerJob?.status,
    polledReasonerJob?.errorDetails,
    currentDocument.id,
    queryClient,
  ])

  async function handleRunReasonerFromSidebar() {
    try {
      const resp = await requestOntologyReasoningAction(currentDocument.id)
      if (resp.status === "completed") {
        queryClient.invalidateQueries({
          queryKey: ["latest-reasoner-run", currentDocument.id],
        })
        toast.success("Ontology validated successfully")
      } else if (resp.status === "pending") {
        setReasonerActiveJobId(resp.jobId)
      } else {
        toast.error("Reasoner is currently offline")
      }
    } catch {
      toast.error("Failed to trigger reasoner")
    }
  }

  async function handleDeleteDataset(id: string) {
    const res = await deleteDatasetSourceAction(id)
    if (res.success) {
      queryClient.invalidateQueries({
        queryKey: ["dataset-sources", currentDocument.id],
      })
      toast.success("Dataset removed from archive")
    } else {
      toast.error("Failed to delete dataset")
    }
  }

  async function handleSaveProfileToArchive(
    res: TabularProfileResult,
    connectionConfig?: Record<string, unknown> | null,
    fileFormat?: string
  ) {
    try {
      await archiveDatasetSourceAction({
        ontologyId: currentDocument.id,
        sourceName: res.fileName,
        fileFormat: fileFormat || res.fileType,
        rowCount: res.rowCount,
        columnCount: res.columnCount,
        profileSummary: {
          rowCount: res.rowCount,
          columnCount: res.columnCount,
          candidateKeys: res.candidateKeys,
          columns: res.columns,
        },
        sampleRows: res.previewRows,
        connectionConfig: connectionConfig || null,
      })
      queryClient.invalidateQueries({
        queryKey: ["dataset-sources", currentDocument.id],
      })
      toast.success(`Archived "${res.fileName}"`)
    } catch {
      toast.error("Failed to archive dataset")
    }
  }

  async function handleSidebarFileUpload(
    eOrFile: React.ChangeEvent<HTMLInputElement> | File
  ) {
    const file = eOrFile instanceof File ? eOrFile : eOrFile.target.files?.[0]
    if (!file) return
    if (!(eOrFile instanceof File)) {
      eOrFile.target.value = ""
    }

    setIsProfilingDataset(true)
    const loadingToast = toast.loading(`Profiling ${file.name}...`)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ontologyId", currentDocument.id)

      const resp = await requestTabularProfilingAction(formData)
      toast.dismiss(loadingToast)

      if (resp.status === "completed") {
        setInspectedDatasetId(null)
        setProfiledDatasetResult(resp.result)
        setProfilerModalOpen(true)
      } else {
        toast.error("Profiling failed or worker is offline")
      }
    } catch {
      toast.dismiss(loadingToast)
      toast.error("Failed to profile file")
    } finally {
      setIsProfilingDataset(false)
    }
  }

  const [issuesSheetOpen, setIssuesSheetOpen] = useState(false)
  const [importingPrefix, setImportingPrefix] = useState<string | null>(null)

  const {
    data: analysisData,
    isLoading: isLoadingAnalysis,
    error: analysisError,
  } = useQuery({
    queryKey: ["ontology-analysis", currentDocument.id],
    queryFn: () => runFullOntologyAnalysis(currentDocument.id),
    enabled: issuesSheetOpen && Boolean(currentDocument.id),
  })

  const { data: diagnosticsData } = useQuery({
    queryKey: ["ontology-diagnostics", currentDocument.id],
    queryFn: () => getOntologyDiagnosticsAction(currentDocument.id),
    enabled: Boolean(currentDocument.id),
  })

  const suppressedSet = useMemo(() => new Set(suppressions), [suppressions])
  const defectsReport = useMemo(() => {
    return runOntologyLinter({
      classes,
      relations,
      suppressedIds: suppressedSet,
      linkmlLintIssues: diagnosticsData?.lintIssues,
      ohiLockVerification: diagnosticsData?.lockVerification,
    })
  }, [
    classes,
    relations,
    suppressedSet,
    diagnosticsData?.lintIssues,
    diagnosticsData?.lockVerification,
  ])

  const issuesCounts = useMemo(
    () => ({
      error: defectsReport.counts.error,
      warning: defectsReport.counts.warning,
      suggestion: analysisData?.redundancyClusters.length ?? 0,
      info: defectsReport.counts.info,
    }),
    [defectsReport.counts, analysisData?.redundancyClusters.length]
  )

  async function handleSuppressDefect(defectId: string) {
    try {
      await toggleDefectSuppression(currentDocument.id, defectId, true)
      toast.success("Defect muted")
      queryClient.invalidateQueries({
        queryKey: ["ontology-defect-suppressions", currentDocument.id],
      })
    } catch {
      toast.error("Failed to mute defect")
    }
  }

  async function handleRestoreDefect(defectId: string) {
    try {
      await toggleDefectSuppression(currentDocument.id, defectId, false)
      toast.success("Defect restored")
      queryClient.invalidateQueries({
        queryKey: ["ontology-defect-suppressions", currentDocument.id],
      })
    } catch {
      toast.error("Failed to restore defect")
    }
  }

  async function handleQuickFix(defect: OntologyDefect) {
    try {
      if (defect.quickFixType === "clear_parent") {
        await updateClass(
          defect.targetId,
          { parentClassId: null },
          currentDocument.id
        )
        toast.success(`Cleared parent link on "${defect.targetName}"`)
        router.refresh()
        queryClient.invalidateQueries({
          queryKey: ["ontology-analysis", currentDocument.id],
        })
        queryClient.invalidateQueries({
          queryKey: ["ontology-defect-suppressions", currentDocument.id],
        })
      } else if (defect.quickFixType === "delete_relation") {
        await deleteRelation(defect.targetId, currentDocument.id)
        if (selectedEntityId === defect.targetId) {
          setSelectedEntityId(null)
          setSelectedEntityKind(null)
        }
        toast.success(`Deleted dangling relation "${defect.targetName}"`)
        router.refresh()
        queryClient.invalidateQueries({
          queryKey: ["ontology-analysis", currentDocument.id],
        })
        queryClient.invalidateQueries({
          queryKey: ["ontology-defect-suppressions", currentDocument.id],
        })
      } else if (defect.quickFixType === "ohi_sync") {
        await syncOhiLockfileAction(currentDocument.id)
        toast.success("Synchronized ohi.lock.json lockfile")
        router.refresh()
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["ontology-diagnostics", currentDocument.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["ohi-packages", currentDocument.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["ohi-package-state", currentDocument.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["reference-ontologies"],
          }),
        ])
      }
    } catch {
      toast.error("Failed to apply quick fix")
    }
  }

  async function handleImportVocabulary(vocab: RecommendedVocabulary) {
    setImportingPrefix(vocab.prefix)
    try {
      await addReferenceOntology({
        prefix: vocab.prefix,
        name: vocab.name,
        baseIri: vocab.baseIri,
        sourceRegistry: vocab.suggestedSource,
        sourceId: vocab.prefix,
      })
      toast.success(
        `Imported "${vocab.name}" (${vocab.prefix.toUpperCase()}). Indexing terms.`
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reference-ontologies"] }),
        queryClient.invalidateQueries({ queryKey: ["reference-terms"] }),
        queryClient.invalidateQueries({
          queryKey: ["ontology-analysis", currentDocument.id],
        }),
      ])
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import vocabulary."
      )
    } finally {
      setImportingPrefix(null)
    }
  }

  const currentModuleIds = useMemo(
    () =>
      new Set(
        currentDocument.modules.map((ontologyModule) => ontologyModule.id)
      ),
    [currentDocument.modules]
  )
  const resolvedActiveModuleId =
    activeModuleId && currentModuleIds.has(activeModuleId)
      ? activeModuleId
      : null

  const filteredClasses = useMemo(
    () =>
      resolvedActiveModuleId
        ? classes.filter((c) => c.module_id === resolvedActiveModuleId)
        : classes,
    [classes, resolvedActiveModuleId]
  )

  const filteredRelations = useMemo(() => {
    if (!resolvedActiveModuleId) return relations
    const moduleClassIds = new Set(
      classes
        .filter((c) => c.module_id === resolvedActiveModuleId)
        .map((c) => c.id)
    )
    return relations.filter(
      (r) =>
        moduleClassIds.has(r.domain_class_id) ||
        moduleClassIds.has(r.range_class_id)
    )
  }, [relations, classes, resolvedActiveModuleId])

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  )
  const classNotes = useMemo(
    () => notes.filter((note) => note.target_class_id !== null),
    [notes]
  )
  const relationNotes = useMemo(
    () => notes.filter((note) => note.target_relation_id !== null),
    [notes]
  )
  const classExamples = useMemo(
    () => examples.filter((example) => example.target_class_id !== null),
    [examples]
  )
  const relationExamples = useMemo(
    () => examples.filter((example) => example.target_relation_id !== null),
    [examples]
  )
  const resolvedSelectedEntityId = useMemo(() => {
    if (!selectedEntityId || !selectedEntityKind) return null

    if (selectedEntityKind === "class") {
      return classMap.has(selectedEntityId) ? selectedEntityId : null
    }

    return relations.some((relation) => relation.id === selectedEntityId)
      ? selectedEntityId
      : null
  }, [classMap, relations, selectedEntityId, selectedEntityKind])
  const resolvedSelectedEntityKind = resolvedSelectedEntityId
    ? selectedEntityKind
    : null

  const selectedClass = getSelectedClass(
    resolvedSelectedEntityKind,
    resolvedSelectedEntityId,
    classMap
  )
  const selectedRelation = getSelectedRelation(
    resolvedSelectedEntityKind,
    resolvedSelectedEntityId,
    relations
  )
  const selectedModule = selectedModuleDetailId
    ? (currentDocument.modules.find(
        (ontologyModule) => ontologyModule.id === selectedModuleDetailId
      ) ?? null)
    : null
  const detailPanelTitle = selectedReferenceTerm
    ? `${selectedReferenceTerm.label} (${selectedReferenceTerm.curie})`
    : getDetailPanelTitle({
        selectedClass,
        selectedRelation,
        selectedModule,
      })

  function handleSelectClass(id: string) {
    setSelectedReferenceTerm(null)
    setSelectedModuleDetailId(null)
    setSelectedEntityKind("class")
    setSelectedEntityId(id)
    setIsDetailCollapsed(false)
  }

  function handleSelectRelation(id: string) {
    setSelectedReferenceTerm(null)
    setSelectedModuleDetailId(null)
    setSelectedEntityKind("relation")
    setSelectedEntityId(id)
    setIsDetailCollapsed(false)
  }

  function handleSelectModuleOverview(moduleId: string) {
    setSelectedReferenceTerm(null)
    if (!currentModuleIds.has(moduleId)) return
    setSelectedEntityKind(null)
    setSelectedEntityId(null)
    setSelectedModuleDetailId(moduleId)
    setIsDetailCollapsed(false)
  }

  function handleNavigateToRelation(relationId: string) {
    setSelectedReferenceTerm(null)
    if (isVisual) {
      handleSelectRelation(relationId)
    } else {
      setActiveEntityType("relations")
      handleSelectRelation(relationId)
    }
  }

  function handleModuleCreated(moduleId: string) {
    setActiveModuleId(moduleId)
  }

  function handleClassCreated(classId: string) {
    setSelectedReferenceTerm(null)
    if (!isVisual) setActiveEntityType("classes")
    handleSelectClass(classId)
  }

  function handleRelationCreated(relationId: string) {
    setSelectedReferenceTerm(null)
    if (!isVisual) setActiveEntityType("relations")
    handleSelectRelation(relationId)
  }

  function handleTypeChange(type: EntityType) {
    setActiveEntityType(type)
    setSelectedEntityId(null)
    setSelectedEntityKind(null)
    setSelectedModuleDetailId(null)
    setSelectedReferenceTerm(null)
  }

  function openOntologyDetails(tab: OntologyDetailsTab = "overview") {
    setDetailsTab(tab)
    setCqCreateModuleId(null)
    setCqFilterModuleId(null)
    setCqFilterRequestId((requestId) => requestId + 1)
    setDetailsOpen(true)
  }

  function openCQEditorForModule(moduleId: string) {
    setDetailsTab("competency-questions")
    setCqCreateModuleId(moduleId)
    setCqCreateRequestId((requestId) => requestId + 1)
    setCqFilterModuleId(null)
    setDetailsOpen(true)
  }

  function openCQManagerForModule(moduleId: string) {
    setDetailsTab("competency-questions")
    setCqCreateModuleId(null)
    setCqFilterModuleId(moduleId)
    setCqFilterRequestId((requestId) => requestId + 1)
    setDetailsOpen(true)
  }

  const classTarget = selectedClass
    ? ({ type: "class", id: selectedClass.id } as const)
    : null
  const relationTarget = selectedRelation
    ? ({ type: "relation", id: selectedRelation.id } as const)
    : null

  const detailContent = selectedReferenceTerm ? (
    <ReferenceTermDetail
      term={selectedReferenceTerm}
      ontologyId={currentDocument.id}
      modules={currentDocument.modules}
      activeModuleId={resolvedActiveModuleId}
      onClassCreated={handleClassCreated}
    />
  ) : selectedClass && classTarget ? (
    <ClassDetail
      cls={selectedClass}
      modules={currentDocument.modules}
      allClasses={classes}
      relations={relations}
      onNavigateToRelation={handleNavigateToRelation}
      ontologyId={currentDocument.id}
      languages={languages}
      defaultLanguage={currentDocument.default_language}
      localizedTexts={filterLocalizedTexts(allLocalizedTexts, classTarget)}
      notes={filterNotes(notes, classTarget)}
      examples={filterExamples(examples, classTarget)}
      attributeMetadata={{
        localizedTexts: allLocalizedTexts,
        notes,
        examples,
        languages,
        defaultLanguage: currentDocument.default_language,
      }}
      activeDefects={
        selectedClass
          ? (defectsReport.defectsByTargetId[selectedClass.id] ?? [])
          : []
      }
      onQuickFix={handleQuickFix}
    />
  ) : selectedRelation && relationTarget ? (
    <RelationDetail
      relation={selectedRelation}
      allClasses={classes}
      modules={currentDocument.modules}
      currentModuleId={resolvedActiveModuleId}
      ontologyId={currentDocument.id}
      languages={languages}
      defaultLanguage={currentDocument.default_language}
      localizedTexts={filterLocalizedTexts(allLocalizedTexts, relationTarget)}
      notes={filterNotes(notes, relationTarget)}
      examples={filterExamples(examples, relationTarget)}
      relationAttributes={
        relationAttributesByRelation[selectedRelation.id] ?? []
      }
      attributeMetadata={{
        localizedTexts: allLocalizedTexts,
        notes,
        examples,
        languages,
        defaultLanguage: currentDocument.default_language,
      }}
      activeDefects={
        selectedRelation
          ? (defectsReport.defectsByTargetId[selectedRelation.id] ?? [])
          : []
      }
      onQuickFix={handleQuickFix}
    />
  ) : selectedModule ? (
    <ModuleDetail
      module={selectedModule}
      ontologyId={currentDocument.id}
      defaultLanguage={currentDocument.default_language}
      languages={languages}
      localizedTexts={allLocalizedTexts}
      notes={notes}
      cqs={cqs}
      classes={classes}
      relations={relations}
      examples={examples}
      onAddCQ={openCQEditorForModule}
      onManageCQs={openCQManagerForModule}
    />
  ) : (
    <EmptyState
      title="No item selected"
      description={getDetailEmptyStateDescription(isVisual)}
    />
  )

  return (
    <div className="flex h-screen flex-col">
      <OntologyHeader
        documents={documents}
        currentDocument={currentDocument}
        classes={classes}
        relations={relations}
        languages={languages}
        localizedTexts={allLocalizedTexts}
        isVisual={isVisual}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        cqCount={cqs.length}
        onOpenOntologyDetails={() => openOntologyDetails("overview")}
        onOpenVocabularies={() => setReferenceDialogOpen(true)}
        onOpenCompilerStudio={() => setCompilerStudioOpen(true)}
        issuesCounts={issuesCounts}
        onOpenIssuesSheet={() => setIssuesSheetOpen(true)}
      />
      <ModuleTabBar
        modules={currentDocument.modules}
        classes={classes}
        relations={relations}
        languages={languages}
        defaultLanguage={currentDocument.default_language}
        activeModuleId={resolvedActiveModuleId}
        onModuleChange={setActiveModuleId}
        onModuleOverview={handleSelectModuleOverview}
        ontologyId={currentDocument.id}
        onModuleCreated={handleModuleCreated}
      />

      <div className="flex min-h-0 flex-1">
        {viewMode === "questions" ? (
          <CqWorkbench
            ontologyId={currentDocument.id}
            cqs={cqs}
            classes={classes}
            relations={relations}
            modules={currentDocument.modules}
            currentModuleId={resolvedActiveModuleId}
          />
        ) : (
          <>
            {!isVisual && (
              <LeftBrowserPanel
                activeType={activeEntityType}
                onTypeChange={handleTypeChange}
                classCount={filteredClasses.length}
                relationCount={filteredRelations.length}
                referenceCount={referenceVocabularies.length}
                datasetCount={archivedDatasets.length}
                classBrowser={
                  <ClassBrowser
                    classes={filteredClasses}
                    relations={filteredRelations}
                    modules={currentDocument.modules}
                    notes={classNotes}
                    examples={classExamples}
                    ontologyId={currentDocument.id}
                    languages={languages}
                    defaultLanguage={currentDocument.default_language}
                    activeModuleId={resolvedActiveModuleId}
                    selectedId={resolvedSelectedEntityId}
                    onSelect={handleSelectClass}
                    onCreated={handleClassCreated}
                  />
                }
                relationBrowser={
                  <RelationBrowser
                    relations={filteredRelations}
                    relationAttributesByRelation={relationAttributesByRelation}
                    classMap={classMap}
                    notes={relationNotes}
                    examples={relationExamples}
                    ontologyId={currentDocument.id}
                    allClasses={classes}
                    modules={currentDocument.modules}
                    languages={languages}
                    defaultLanguage={currentDocument.default_language}
                    currentModuleId={resolvedActiveModuleId}
                    selectedId={resolvedSelectedEntityId}
                    onSelect={handleSelectRelation}
                    onCreated={handleRelationCreated}
                  />
                }
                referenceBrowser={
                  <ReferenceBrowser
                    onOpenManage={() => setReferenceDialogOpen(true)}
                    selectedTermId={selectedReferenceTerm?.curie}
                    onSelectTerm={(term) => {
                      setSelectedEntityKind(null)
                      setSelectedEntityId(null)
                      setSelectedModuleDetailId(null)
                      setSelectedReferenceTerm(term)
                      setIsDetailCollapsed(false)
                    }}
                  />
                }
                standardsBrowser={
                  <StandardsBrowser
                    ontologyId={currentDocument.id}
                    onOpenManage={() => setReferenceDialogOpen(true)}
                  />
                }
                reasonerBrowser={
                  <ReasonerBrowser
                    ontologyId={currentDocument.id}
                    latestRun={
                      polledReasonerJob?.status === "completed" &&
                      polledReasonerJob.result
                        ? {
                            status: "completed",
                            createdAt: new Date().toISOString(),
                            result: polledReasonerJob.result,
                          }
                        : latestReasonerRun || null
                    }
                    isLoading={isReasonerLoading}
                    onRunReasoner={handleRunReasonerFromSidebar}
                    onOpenFullReport={() => setReasonerReportModalOpen(true)}
                    onSelectClass={handleSelectClass}
                  />
                }
                datasetBrowser={
                  <DatasetArchiveBrowser
                    ontologyId={currentDocument.id}
                    datasets={archivedDatasets}
                    onOpenUpload={() => {
                      setProfiledDatasetResult(null)
                      setInspectedDatasetId(null)
                      setProfilerModalOpen(true)
                    }}
                    onInspectProfile={(dataset) => {
                      setInspectedDatasetId(dataset.id)
                      setProfiledDatasetResult({
                        fileName: dataset.sourceName,
                        fileType: dataset.fileFormat,
                        rowCount: dataset.rowCount,
                        columnCount: dataset.columnCount,
                        estimatedSizeBytes: 0,
                        columns: dataset.profileSummary?.columns || [],
                        candidateKeys:
                          dataset.profileSummary?.candidateKeys || [],
                        previewRows: dataset.sampleRows || [],
                      })
                      setProfilerModalOpen(true)
                    }}
                    onOpenMappingWizard={(dataset) => {
                      setSelectedDatasetForMapping(dataset)
                    }}
                    onDeleteDataset={handleDeleteDataset}
                  />
                }
              />
            )}

            {isVisual && (
              <VisualRegion
                ontologyId={currentDocument.id}
                classes={classes}
                relations={relations}
                examples={examples}
                notes={notes}
                modules={currentDocument.modules}
                languages={languages}
                defaultLanguage={currentDocument.default_language}
                activeModuleId={resolvedActiveModuleId}
                selectedEntityId={resolvedSelectedEntityId}
                savedPositions={savedPositions}
                savedModuleLayouts={savedModuleLayouts}
                defectsByTargetId={defectsReport.defectsByTargetId}
                onSelectClass={handleSelectClass}
                onSelectRelation={handleSelectRelation}
                onSelectModule={handleSelectModuleOverview}
                onClassCreated={handleClassCreated}
                onRelationCreated={handleRelationCreated}
              />
            )}

            <DetailPanelShell
              title={detailPanelTitle}
              isVisual={isVisual}
              isCollapsed={isVisual && isDetailCollapsed}
              onCollapse={() => setIsDetailCollapsed(true)}
              onExpand={() => setIsDetailCollapsed(false)}
            >
              {detailContent}
            </DetailPanelShell>
          </>
        )}
      </div>

      <OntologyDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        activeTab={detailsTab}
        onActiveTabChange={setDetailsTab}
        ontology={currentDocument}
        classes={classes}
        relations={relations}
        languages={languages}
        cqs={cqs}
        examples={examples}
        ontologyLocalizedTexts={ontologyLocalizedTexts}
        ontologyNotes={filterNotes(notes, {
          type: "ontology",
          id: currentDocument.id,
        })}
        cqCreateModuleId={cqCreateModuleId}
        cqCreateRequestId={cqCreateRequestId}
        cqFilterModuleId={cqFilterModuleId}
        cqFilterRequestId={cqFilterRequestId}
      />

      <ReferenceVocabulariesDialog
        open={referenceDialogOpen}
        onOpenChange={setReferenceDialogOpen}
      />

      <CompilerStudioDialog
        open={compilerStudioOpen}
        onOpenChange={setCompilerStudioOpen}
        ontologyId={currentDocument.id}
        ontologyName={currentDocument.name}
      />

      <OntologyIssuesSheet
        open={issuesSheetOpen}
        onOpenChange={setIssuesSheetOpen}
        report={defectsReport}
        redundancyClusters={analysisData?.redundancyClusters}
        recommendedVocabularies={analysisData?.recommendedVocabularies}
        isLoadingAnalysis={isLoadingAnalysis}
        analysisError={analysisError}
        onSelectEntity={(id, kind) => {
          if (kind === "class") {
            handleSelectClass(id)
          } else if (kind === "relation") {
            handleSelectRelation(id)
          }
        }}
        onSuppress={handleSuppressDefect}
        onRestore={handleRestoreDefect}
        onQuickFix={handleQuickFix}
        onImportVocabulary={handleImportVocabulary}
        importingPrefix={importingPrefix}
        onOpenVocabularies={() => setReferenceDialogOpen(true)}
        onSelectClassForRefactor={handleSelectClass}
      />

      <ReasonerReportModal
        open={reasonerReportModalOpen}
        onOpenChange={setReasonerReportModalOpen}
        isLoading={isReasonerLoading}
        result={
          polledReasonerJob?.status === "completed" && polledReasonerJob.result
            ? polledReasonerJob.result
            : latestReasonerRun?.result || null
        }
      />

      <TabularProfilerModal
        open={profilerModalOpen}
        onOpenChange={(open) => {
          setProfilerModalOpen(open)
          if (!open) {
            setProfiledDatasetResult(null)
            setInspectedDatasetId(null)
          }
        }}
        datasetId={inspectedDatasetId ?? undefined}
        result={profiledDatasetResult}
        ontologyId={currentDocument.id}
        isLoading={isProfilingDataset}
        onFileUpload={handleSidebarFileUpload}
        onSaveToArchive={handleSaveProfileToArchive}
        onMapToKg={(res, connConfig, format, mappedDatasetId) => {
          const effectiveDatasetId = mappedDatasetId || inspectedDatasetId || ""
          const matchedArchive = effectiveDatasetId
            ? archivedDatasets.find((d) => d.id === effectiveDatasetId)
            : null
          setSelectedDatasetForMapping({
            id: effectiveDatasetId,
            ontologyId: currentDocument.id,
            groupKey: matchedArchive?.groupKey || "shared",
            sourceName: res.fileName,
            fileFormat:
              (format as "csv" | "parquet" | "excel" | "postgres" | "mysql") ||
              (res.fileType.toLowerCase() as
                "csv" | "parquet" | "excel" | "postgres" | "mysql") ||
              "csv",
            rowCount: res.rowCount,
            columnCount: res.columnCount,
            profileSummary: {
              rowCount: res.rowCount,
              columnCount: res.columnCount,
              candidateKeys: res.candidateKeys,
              columns: res.columns,
            },
            sampleRows: res.previewRows,
            mappingSpec: matchedArchive?.mappingSpec ?? null,
            connectionConfig:
              connConfig ?? matchedArchive?.connectionConfig ?? null,
            createdAt: matchedArchive?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          setProfilerModalOpen(false)
          setInspectedDatasetId(null)
          setProfiledDatasetResult(null)
        }}
      />

      {selectedDatasetForMapping && (
        <DatasetMappingModal
          key={`${selectedDatasetForMapping.id || "ephemeral"}:${selectedDatasetForMapping.sourceName}`}
          open={Boolean(selectedDatasetForMapping)}
          onOpenChange={(open) => {
            if (!open) setSelectedDatasetForMapping(null)
          }}
          ontologyId={currentDocument.id}
          dataset={selectedDatasetForMapping}
          existingClasses={classes.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            attributes: c.attributes.map((a) => ({
              name: a.name,
              dataType: a.data_type,
            })),
          }))}
          existingRelations={relations.map((r) => {
            const dom = classes.find((c) => c.id === r.domain_class_id)
            const ran = classes.find((c) => c.id === r.range_class_id)
            return {
              id: r.id,
              name: r.name,
              domainClassName: dom?.name,
              rangeClassName: ran?.name,
            }
          })}
          onMappingCommitted={() => {
            queryClient.invalidateQueries({
              queryKey: ["dataset-sources", currentDocument.id],
            })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
