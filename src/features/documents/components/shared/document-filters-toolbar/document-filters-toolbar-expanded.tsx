"use client"

import { Archive, GitBranch } from "lucide-react"

import {
  DOCUMENT_FILTER_ALL,
  isAllDocumentFilterValue,
} from "../../../utils/document-filters"
import {
  findNamedFilterOption,
  toEntitySelectValue,
  toExtractedRelationSelectValue,
  toSingleSelectValue,
} from "./utils"
import { DocumentFiltersToolbarFilterGroup } from "./document-filters-toolbar-filter-group"
import { DocumentFiltersToolbarGroupedSelect } from "./document-filters-toolbar-grouped-select"
import { DocumentFiltersToolbarNestedSelect } from "./document-filters-toolbar-nested-select"
import { DocumentFiltersToolbarRoleFilterStack } from "./document-filters-toolbar-role-filter-stack"
import type { DocumentFilterData } from "./hooks/use-document-filter-data"

export interface DocumentFiltersToolbarExpandedProps {
  filterData: DocumentFilterData
}

export function DocumentFiltersToolbarExpanded({
  filterData,
}: DocumentFiltersToolbarExpandedProps) {
  const {
    filters,
    setRelation,
    setExtractedRelation,
    relationOptions,
    classOptions,
    controlsDisabled,
    relationFilterActive,
    classFilterActive,
    subjectClassFilterActive,
    objectClassFilterActive,
    entityFilterActive,
    subjectEntityFilterActive,
    objectEntityFilterActive,
    extractedRelationFilterActive,
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
  } = filterData

  return (
    <div className="border-t px-3 py-3">
      <div className="grid gap-2.5 2xl:grid-cols-2">
        <DocumentFiltersToolbarFilterGroup
          title="Ontology"
          icon={GitBranch}
        >
          <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.25fr)]">
            <DocumentFiltersToolbarGroupedSelect
              label="Relation"
              searchPlaceholder="Search ontology relations..."
              options={relationOptions}
              selectedValue={toSingleSelectValue(filters.relation)}
              selectedLabel={
                isAllDocumentFilterValue(filters.relation)
                  ? undefined
                  : filters.relation.name
              }
              isActive={relationFilterActive}
              emptyLabel="No ontology relations found."
              disabled={controlsDisabled}
              onChange={(value) =>
                setRelation(
                  value === DOCUMENT_FILTER_ALL
                    ? DOCUMENT_FILTER_ALL
                    : findNamedFilterOption(value, relationOptions)
                )
              }
              onClear={() => setRelation(DOCUMENT_FILTER_ALL)}
            />

            <DocumentFiltersToolbarRoleFilterStack
              label="Class"
              disabled={controlsDisabled}
              allActive={classFilterActive}
              subjectActive={subjectClassFilterActive}
              objectActive={objectClassFilterActive}
              onMoveSelection={moveRoleClassFilter}
              onClearRole={clearRoleClassFilter}
              renderValueControl={(role) => {
                const roleFilter = getRoleClassFilter(role)

                return (
                  <DocumentFiltersToolbarGroupedSelect
                    label="Class"
                    searchPlaceholder={
                      role === DOCUMENT_FILTER_ALL
                        ? "Search classes..."
                        : `Search ${role} classes...`
                    }
                    options={classOptions}
                    selectedValue={toSingleSelectValue(roleFilter)}
                    selectedLabel={
                      isAllDocumentFilterValue(roleFilter)
                        ? undefined
                        : roleFilter.name
                    }
                    isActive={!isAllDocumentFilterValue(roleFilter)}
                    hideFieldLabel
                    emptyLabel="No classes found."
                    disabled={controlsDisabled}
                    onChange={(value) =>
                      setRoleClassFilter(
                        role,
                        value === DOCUMENT_FILTER_ALL
                          ? DOCUMENT_FILTER_ALL
                          : findNamedFilterOption(value, classOptions)
                      )
                    }
                    onClear={() => clearRoleClassFilter(role)}
                  />
                )
              }}
            />
          </div>
        </DocumentFiltersToolbarFilterGroup>

        <DocumentFiltersToolbarFilterGroup
          title="Extracted Instances"
          icon={Archive}
        >
          <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
            <DocumentFiltersToolbarNestedSelect
              label="Relation"
              searchPlaceholder="Search extracted relations..."
              options={extractedRelationOptionData.options}
              selectedValue={toExtractedRelationSelectValue(
                filters.extractedRelation
              )}
              selectedLabel={
                isAllDocumentFilterValue(filters.extractedRelation)
                  ? undefined
                  : filters.extractedRelation.label
              }
              selectedBreadcrumb={
                extractedRelationOptionData.selectedBreadcrumb
              }
              isActive={extractedRelationFilterActive}
              emptyLabel="No extracted relations found."
              disabled={controlsDisabled}
              onChange={(value) =>
                setExtractedRelation(
                  value === DOCUMENT_FILTER_ALL
                    ? DOCUMENT_FILTER_ALL
                    : (extractedRelationFilterByValue.get(value) ??
                        DOCUMENT_FILTER_ALL)
                )
              }
              onClear={() => setExtractedRelation(DOCUMENT_FILTER_ALL)}
            />

            <DocumentFiltersToolbarRoleFilterStack
              label="Entity"
              disabled={controlsDisabled}
              allActive={entityFilterActive}
              subjectActive={subjectEntityFilterActive}
              objectActive={objectEntityFilterActive}
              onMoveSelection={moveRoleEntityFilter}
              onClearRole={clearRoleEntityFilter}
              renderValueControl={(role) => {
                const roleFilter = getRoleEntityFilter(role)
                const optionData =
                  role === DOCUMENT_FILTER_ALL
                    ? anyEntityOptionData
                    : role === "subject"
                      ? subjectEntityOptionData
                      : objectEntityOptionData
                const filterByValue =
                  role === DOCUMENT_FILTER_ALL
                    ? entityFilterByValue
                    : role === "subject"
                      ? subjectEntityFilterByValue
                      : objectEntityFilterByValue

                return (
                  <DocumentFiltersToolbarNestedSelect
                    label="Entity"
                    searchPlaceholder={
                      role === DOCUMENT_FILTER_ALL
                        ? "Search entities..."
                        : `Search ${role} entities...`
                    }
                    options={optionData.options}
                    selectedValue={toEntitySelectValue(roleFilter)}
                    selectedLabel={
                      isAllDocumentFilterValue(roleFilter)
                        ? undefined
                        : roleFilter.label
                    }
                    selectedBreadcrumb={optionData.selectedBreadcrumb}
                    isActive={!isAllDocumentFilterValue(roleFilter)}
                    hideFieldLabel
                    emptyLabel={
                      role === DOCUMENT_FILTER_ALL
                        ? "No entities found."
                        : `No ${role} entities found.`
                    }
                    disabled={controlsDisabled}
                    onChange={(value) =>
                      setRoleEntityFilter(
                        role,
                        value === DOCUMENT_FILTER_ALL
                          ? DOCUMENT_FILTER_ALL
                          : (filterByValue.get(value) ??
                              DOCUMENT_FILTER_ALL)
                      )
                    }
                    onClear={() => clearRoleEntityFilter(role)}
                  />
                )
              }}
            />
          </div>
        </DocumentFiltersToolbarFilterGroup>
      </div>
    </div>
  )
}
