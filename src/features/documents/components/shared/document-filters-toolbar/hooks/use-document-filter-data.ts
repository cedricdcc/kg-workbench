"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { EFFECTIVE_STATUS_LABELS, EFFECTIVE_STATUSES } from "@/lib/types"
import { useDocumentsWorkspace } from "../../../../hooks/documents-workspace-state"
import {
  fetchDocumentEntities,
  fetchDocumentFacts,
  fetchDocumentWithSections,
  fetchOntologyForDocument,
} from "../../../../server/queries"
import {
  areDocumentFiltersAtDefaults,
  DOCUMENT_COMPLETENESS_FILTER_LABELS,
  DOCUMENT_FILTER_ALL,
  DOCUMENT_MODULE_LINK_FILTER_LABELS,
  DOCUMENT_SCOPE_FILTER_LABELS,
  isAllDocumentFilterValue,
  NO_MODULE_FILTER_ID,
  type DocumentEntityFilter,
  type DocumentSingleFilterValue,
} from "../../../../utils/document-filters"
import { hasAllEffectiveStatuses } from "../../../../utils/fact-status"
import type { DocumentFiltersToolbarGroupedOption } from "../types"
import {
  buildEntityOptionData,
  buildExtractedRelationOptionData,
  buildRoleEntityOptionData,
  toNamedOption,
  withSelectedGroupedOption,
  withSelectedOption,
} from "../utils"

export type FilterRole = typeof DOCUMENT_FILTER_ALL | "subject" | "object"

function toSelectedClassOption(
  value: DocumentSingleFilterValue,
  groupId: string,
  groupLabel: string
): DocumentFiltersToolbarGroupedOption | null {
  if (isAllDocumentFilterValue(value)) {
    return null
  }

  return {
    value: value.id,
    label: value.name,
    groupId,
    groupLabel,
  }
}

export function useDocumentFilterData() {
  const workspace = useDocumentsWorkspace()
  const {
    selectedDocumentId: documentId,
    sharedFilters: filters,
    nodesOnly,
    toggleStatus,
    selectAllStatuses,
    setSection,
    setModule,
    setClass,
    setSubjectClass,
    setObjectClass,
    setRelation,
    setEntity,
    setSubjectEntity,
    setObjectEntity,
    setExtractedRelation,
    setScope,
    setModuleLink,
    setCompleteness,
    setNodesOnly,
    viewMode,
    resetWorkspace,
  } = workspace

  const { data: document } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDocumentWithSections(documentId!),
    enabled: !!documentId,
  })
  const { data: facts = [] } = useQuery({
    queryKey: ["document-facts", documentId],
    queryFn: () => fetchDocumentFacts(documentId!),
    enabled: !!documentId,
  })
  const { data: entities = [] } = useQuery({
    queryKey: ["document-entities", documentId],
    queryFn: () => fetchDocumentEntities(documentId!),
    enabled: !!documentId,
  })
  const { data: ontology } = useQuery({
    queryKey: ["document-ontology", documentId],
    queryFn: () => fetchOntologyForDocument(documentId!),
    enabled: !!documentId,
  })

  const statusOptions = EFFECTIVE_STATUSES.map((status) => ({
    value: status,
    label: EFFECTIVE_STATUS_LABELS[status],
  }))
  const sectionOptions = withSelectedOption(
    (document?.sections ?? []).map((section) => ({
      value: section.id,
      label: section.title || "Untitled chapter",
    })),
    isAllDocumentFilterValue(filters.section)
      ? null
      : { value: filters.section.id, label: filters.section.name }
  )
  const moduleOptions = withSelectedOption(
    (ontology?.modules ?? []).map((module) => ({
      value: module.id,
      label: module.name,
    })),
    toNamedOption(filters.module)
  )

  const moduleLabelById = useMemo(
    () =>
      new Map(
        (ontology?.modules ?? []).map((module) => [module.id, module.name])
      ),
    [ontology]
  )
  const classModuleById = useMemo(
    () =>
      new Map(
        (ontology?.classes ?? []).map((cls) => [
          cls.id,
          cls.module_id ?? NO_MODULE_FILTER_ID,
        ])
      ),
    [ontology]
  )

  const orderedClasses = [
    ...(ontology?.modules ?? []).flatMap((module) =>
      (ontology?.classes ?? []).filter((cls) => cls.module_id === module.id)
    ),
    ...(ontology?.classes ?? []).filter((cls) => !cls.module_id),
  ]
  const baseClassOptions: DocumentFiltersToolbarGroupedOption[] =
    orderedClasses.map((cls) => ({
      value: cls.id,
      label: cls.name,
      groupId: cls.module_id,
      groupLabel: cls.module_id
        ? (moduleLabelById.get(cls.module_id) ?? "Unknown module")
        : "No module",
    }))
  const classOptions = withSelectedGroupedOption(
    withSelectedGroupedOption(
      withSelectedGroupedOption(
        baseClassOptions,
        toSelectedClassOption(
          filters.subjectClass,
          "__selected_subject_class__",
          "Current subject selection"
        )
      ),
      toSelectedClassOption(
        filters.objectClass,
        "__selected_object_class__",
        "Current object selection"
      )
    ),
    toSelectedClassOption(
      filters.class,
      "__selected_class__",
      "Current broad selection"
    )
  )

  const orderedRelations = [
    ...(ontology?.modules ?? []).flatMap((module) =>
      (ontology?.relations ?? []).filter(
        (relation) =>
          classModuleById.get(relation.domain_class_id) === module.id
      )
    ),
    ...(ontology?.relations ?? []).filter(
      (relation) =>
        (classModuleById.get(relation.domain_class_id) ??
          NO_MODULE_FILTER_ID) === NO_MODULE_FILTER_ID
    ),
  ]
  const relationOptions: DocumentFiltersToolbarGroupedOption[] =
    withSelectedGroupedOption(
      orderedRelations.map((relation) => {
        const moduleId = classModuleById.get(relation.domain_class_id) ?? null

        return {
          value: relation.id,
          label: relation.name,
          groupId: moduleId,
          groupLabel:
            moduleId && moduleId !== NO_MODULE_FILTER_ID
              ? (moduleLabelById.get(moduleId) ?? "Unknown module")
              : "No module",
        }
      }),
      isAllDocumentFilterValue(filters.relation)
        ? null
        : {
            value: filters.relation.id,
            label: filters.relation.name,
            groupId: "__selected_relation__",
            groupLabel: "Current selection",
          }
    )

  const extractedRelationOptionData = useMemo(
    () =>
      buildExtractedRelationOptionData({
        facts,
        entities,
        ontology,
        filters,
      }),
    [entities, facts, filters, ontology]
  )
  const anyEntityOptionData = useMemo(
    () =>
      buildEntityOptionData({
        facts,
        entities,
        ontology,
        filters,
      }),
    [entities, facts, filters, ontology]
  )
  const entityFilterByValue = useMemo(
    () =>
      new Map(
        anyEntityOptionData.leaves.map((option) => [
          option.value,
          option.filter,
        ])
      ),
    [anyEntityOptionData.leaves]
  )
  const extractedRelationFilterByValue = useMemo(
    () =>
      new Map(
        extractedRelationOptionData.leaves.map((option) => [
          option.value,
          option.filter,
        ])
      ),
    [extractedRelationOptionData.leaves]
  )

  const subjectEntityOptionData = useMemo(
    () =>
      buildRoleEntityOptionData({
        facts,
        entities,
        ontology,
        filters,
        role: "subject",
      }),
    [entities, facts, filters, ontology]
  )
  const objectEntityOptionData = useMemo(
    () =>
      buildRoleEntityOptionData({
        facts,
        entities,
        ontology,
        filters,
        role: "object",
      }),
    [entities, facts, filters, ontology]
  )

  const subjectEntityFilterByValue = useMemo(
    () =>
      new Map(
        subjectEntityOptionData.leaves.map((option) => [
          option.value,
          option.filter,
        ])
      ),
    [subjectEntityOptionData.leaves]
  )
  const objectEntityFilterByValue = useMemo(
    () =>
      new Map(
        objectEntityOptionData.leaves.map((option) => [
          option.value,
          option.filter,
        ])
      ),
    [objectEntityOptionData.leaves]
  )

  const scopeOptions: Array<{ value: string; label: string }> = Object.entries(
    DOCUMENT_SCOPE_FILTER_LABELS
  )
    .filter(([value]) => value !== DOCUMENT_FILTER_ALL)
    .map(([value, label]) => ({
      value,
      label,
    }))
  const moduleLinkOptions: Array<{ value: string; label: string }> =
    Object.entries(DOCUMENT_MODULE_LINK_FILTER_LABELS)
      .filter(([value]) => value !== DOCUMENT_FILTER_ALL)
      .map(([value, label]) => ({
        value,
        label,
      }))
  const completenessOptions: Array<{ value: string; label: string }> =
    Object.entries(DOCUMENT_COMPLETENESS_FILTER_LABELS)
      .filter(([value]) => value !== DOCUMENT_FILTER_ALL)
      .map(([value, label]) => ({
        value,
        label,
      }))
  const controlsDisabled = !documentId
  const showIsolateNodes = viewMode === "graph"
  const statusFilterActive = !hasAllEffectiveStatuses(filters.statuses)
  const sectionFilterActive = !isAllDocumentFilterValue(filters.section)
  const moduleFilterActive = !isAllDocumentFilterValue(filters.module)
  const classFilterActive = !isAllDocumentFilterValue(filters.class)
  const relationFilterActive = !isAllDocumentFilterValue(filters.relation)
  const entityFilterActive = !isAllDocumentFilterValue(filters.entity)
  const extractedRelationFilterActive = !isAllDocumentFilterValue(
    filters.extractedRelation
  )
  const moduleLinkFilterActive = filters.moduleLink !== DOCUMENT_FILTER_ALL
  const scopeFilterActive = filters.scope !== DOCUMENT_FILTER_ALL
  const completenessFilterActive = filters.completeness !== DOCUMENT_FILTER_ALL
  const subjectEntityFilterActive = !isAllDocumentFilterValue(
    filters.subjectEntity
  )
  const subjectClassFilterActive = !isAllDocumentFilterValue(
    filters.subjectClass
  )
  const objectEntityFilterActive = !isAllDocumentFilterValue(
    filters.objectEntity
  )
  const objectClassFilterActive = !isAllDocumentFilterValue(filters.objectClass)
  const isolateNodesActive = showIsolateNodes && nodesOnly
  const resetDisabled =
    controlsDisabled || (areDocumentFiltersAtDefaults(filters) && !nodesOnly)

  const activeFilterCount = [
    statusFilterActive,
    sectionFilterActive,
    moduleLinkFilterActive,
    scopeFilterActive,
    completenessFilterActive,
    moduleFilterActive,
    classFilterActive,
    subjectClassFilterActive,
    objectClassFilterActive,
    relationFilterActive,
    entityFilterActive,
    subjectEntityFilterActive,
    objectEntityFilterActive,
    extractedRelationFilterActive,
    isolateNodesActive,
  ].filter(Boolean).length
  const resetLabel = `Reset ${activeFilterCount} ${
    activeFilterCount === 1 ? "filter" : "filters"
  }`
  const compactRowGridClass = showIsolateNodes
    ? "grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.72fr)_minmax(0,1.1fr)_minmax(0,0.72fr)_minmax(0,0.72fr)_minmax(0,0.95fr)]"
    : "grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.72fr)_minmax(0,1.1fr)_minmax(0,0.72fr)_minmax(0,0.72fr)]"

  const expandableFilterState = [
    relationFilterActive,
    classFilterActive,
    subjectClassFilterActive,
    objectClassFilterActive,
    entityFilterActive,
    subjectEntityFilterActive,
    objectEntityFilterActive,
    extractedRelationFilterActive,
  ] as const

  function clearBroadClassFilter() {
    if (!isAllDocumentFilterValue(filters.class)) {
      setClass(DOCUMENT_FILTER_ALL)
    }
  }

  function clearBroadEntityFilter() {
    if (!isAllDocumentFilterValue(filters.entity)) {
      setEntity(DOCUMENT_FILTER_ALL)
    }
  }

  function getRoleClassFilter(role: FilterRole) {
    if (role === DOCUMENT_FILTER_ALL) {
      return filters.class
    }

    return role === "subject" ? filters.subjectClass : filters.objectClass
  }

  function getRoleEntityFilter(role: FilterRole) {
    if (role === DOCUMENT_FILTER_ALL) {
      return filters.entity
    }

    return role === "subject" ? filters.subjectEntity : filters.objectEntity
  }

  function setRoleClassFilter(
    role: FilterRole,
    value: DocumentSingleFilterValue
  ) {
    if (role === DOCUMENT_FILTER_ALL) {
      setSubjectClass(DOCUMENT_FILTER_ALL)
      setObjectClass(DOCUMENT_FILTER_ALL)
      setClass(value)
      return
    }

    clearBroadClassFilter()
    if (role === "subject") {
      setSubjectClass(value)
      return
    }

    setObjectClass(value)
  }

  function clearRoleClassFilter(role: FilterRole) {
    setRoleClassFilter(role, DOCUMENT_FILTER_ALL)
  }

  function moveRoleClassFilter(fromRole: FilterRole, toRole: FilterRole) {
    const nextValue = getRoleClassFilter(fromRole)
    if (fromRole === toRole) {
      return
    }

    if (toRole === DOCUMENT_FILTER_ALL) {
      setSubjectClass(DOCUMENT_FILTER_ALL)
      setObjectClass(DOCUMENT_FILTER_ALL)
      setClass(nextValue)
      return
    }

    if (fromRole === DOCUMENT_FILTER_ALL) {
      setClass(DOCUMENT_FILTER_ALL)
      setRoleClassFilter(toRole, nextValue)
      return
    }

    clearBroadClassFilter()
    clearRoleClassFilter(fromRole)
    setRoleClassFilter(toRole, nextValue)
  }

  function setRoleEntityFilter(
    role: FilterRole,
    value: typeof DOCUMENT_FILTER_ALL | DocumentEntityFilter
  ) {
    if (role === DOCUMENT_FILTER_ALL) {
      setSubjectEntity(DOCUMENT_FILTER_ALL)
      setObjectEntity(DOCUMENT_FILTER_ALL)
      setEntity(value)
      return
    }

    clearBroadEntityFilter()
    if (role === "subject") {
      setSubjectEntity(value)
      return
    }

    setObjectEntity(value)
  }

  function clearRoleEntityFilter(role: FilterRole) {
    setRoleEntityFilter(role, DOCUMENT_FILTER_ALL)
  }

  function moveRoleEntityFilter(fromRole: FilterRole, toRole: FilterRole) {
    const nextValue = getRoleEntityFilter(fromRole)
    if (fromRole === toRole) {
      return
    }

    if (toRole === DOCUMENT_FILTER_ALL) {
      setSubjectEntity(DOCUMENT_FILTER_ALL)
      setObjectEntity(DOCUMENT_FILTER_ALL)
      setEntity(nextValue)
      return
    }

    if (fromRole === DOCUMENT_FILTER_ALL) {
      setEntity(DOCUMENT_FILTER_ALL)
      setRoleEntityFilter(toRole, nextValue)
      return
    }

    clearBroadEntityFilter()
    clearRoleEntityFilter(fromRole)
    setRoleEntityFilter(toRole, nextValue)
  }

  return {
    filters,
    nodesOnly,
    toggleStatus,
    selectAllStatuses,
    setSection,
    setModule,
    setRelation,
    setExtractedRelation,
    setScope,
    setModuleLink,
    setCompleteness,
    setNodesOnly,
    resetWorkspace,
    statusOptions,
    sectionOptions,
    moduleOptions,
    relationOptions,
    classOptions,
    scopeOptions,
    moduleLinkOptions,
    completenessOptions,
    controlsDisabled,
    showIsolateNodes,
    statusFilterActive,
    sectionFilterActive,
    moduleFilterActive,
    relationFilterActive,
    classFilterActive,
    subjectClassFilterActive,
    objectClassFilterActive,
    entityFilterActive,
    subjectEntityFilterActive,
    objectEntityFilterActive,
    extractedRelationFilterActive,
    moduleLinkFilterActive,
    scopeFilterActive,
    completenessFilterActive,
    resetDisabled,
    resetLabel,
    compactRowGridClass,
    expandableFilterState,
    extractedRelationOptionData,
    extractedRelationFilterByValue,
    anyEntityOptionData,
    subjectEntityOptionData,
    objectEntityOptionData,
    entityFilterByValue,
    subjectEntityFilterByValue,
    objectEntityFilterByValue,
    getRoleClassFilter,
    setRoleClassFilter,
    clearRoleClassFilter,
    moveRoleClassFilter,
    getRoleEntityFilter,
    setRoleEntityFilter,
    clearRoleEntityFilter,
    moveRoleEntityFilter,
  }
}

export type DocumentFilterData = ReturnType<typeof useDocumentFilterData>
