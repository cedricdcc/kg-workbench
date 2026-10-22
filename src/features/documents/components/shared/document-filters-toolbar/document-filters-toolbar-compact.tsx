"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronLeft, RotateCcw } from "lucide-react"

import { MultiSelectDropdown } from "@/components/shared/multi-select-dropdown"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { getReviewStatusStyles } from "@/lib/colors"
import { cn } from "@/lib/utils"
import { DOCUMENT_FILTER_ALL } from "../../../utils/document-filters"
import {
  findNamedFilterOption,
  toCompletenessFilter,
  toModuleLinkFilter,
  toScopeFilter,
  toSingleSelectValue,
} from "./utils"
import { DocumentFiltersToolbarSelect } from "./document-filters-toolbar-select"
import type { DocumentFilterData } from "./hooks/use-document-filter-data"

function ToolbarField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-[5.5rem] flex-1 flex-col gap-1">
      <span className="px-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

export interface DocumentFiltersToolbarCompactProps {
  filterData: DocumentFilterData
  isExpanded: boolean
  onToggleExpanded: () => void
}

export function DocumentFiltersToolbarCompact({
  filterData,
  isExpanded,
  onToggleExpanded,
}: DocumentFiltersToolbarCompactProps) {
  const {
    filters,
    nodesOnly,
    toggleStatus,
    selectAllStatuses,
    setSection,
    setModule,
    setScope,
    setModuleLink,
    setCompleteness,
    setNodesOnly,
    resetWorkspace,
    statusOptions,
    sectionOptions,
    moduleOptions,
    scopeOptions,
    moduleLinkOptions,
    completenessOptions,
    controlsDisabled,
    showIsolateNodes,
    statusFilterActive,
    sectionFilterActive,
    moduleFilterActive,
    moduleLinkFilterActive,
    scopeFilterActive,
    completenessFilterActive,
    resetDisabled,
    resetLabel,
    compactRowGridClass,
  } = filterData

  return (
    <div className="grid gap-2.5 px-3 py-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
      <div className={compactRowGridClass}>
        <ToolbarField label="Status">
          <MultiSelectDropdown
            label="Status"
            options={statusOptions}
            selectedValues={filters.statuses}
            onToggle={toggleStatus}
            onToggleAll={selectAllStatuses}
            onClear={statusFilterActive ? selectAllStatuses : undefined}
            disabled={controlsDisabled}
            hideLabel
            isActive={statusFilterActive}
            getBadgeClassName={(option) =>
              getReviewStatusStyles(option.value).pillClass
            }
            className="min-h-9 w-full min-w-[5.5rem] justify-between gap-1.5 bg-background/90"
          />
        </ToolbarField>

        <DocumentFiltersToolbarSelect
          label="Chapter"
          options={sectionOptions}
          selectedValue={toSingleSelectValue(filters.section)}
          isActive={sectionFilterActive}
          disabled={controlsDisabled}
          onChange={(value) =>
            setSection(
              value === DOCUMENT_FILTER_ALL
                ? DOCUMENT_FILTER_ALL
                : findNamedFilterOption(value, sectionOptions)
            )
          }
          onClear={() => setSection(DOCUMENT_FILTER_ALL)}
        />

        <DocumentFiltersToolbarSelect
          label="Chapter Scope"
          options={scopeOptions}
          selectedValue={filters.scope}
          isActive={scopeFilterActive}
          disabled={controlsDisabled}
          onChange={(value) => setScope(toScopeFilter(value))}
          onClear={() => setScope(DOCUMENT_FILTER_ALL)}
        />

        <DocumentFiltersToolbarSelect
          label="Module"
          options={moduleOptions}
          selectedValue={toSingleSelectValue(filters.module)}
          isActive={moduleFilterActive}
          disabled={controlsDisabled}
          onChange={(value) =>
            setModule(
              value === DOCUMENT_FILTER_ALL
                ? DOCUMENT_FILTER_ALL
                : findNamedFilterOption(value, moduleOptions)
            )
          }
          onClear={() => setModule(DOCUMENT_FILTER_ALL)}
        />

        <DocumentFiltersToolbarSelect
          label="Module Scope"
          options={moduleLinkOptions}
          selectedValue={filters.moduleLink}
          isActive={moduleLinkFilterActive}
          disabled={controlsDisabled}
          onChange={(value) => setModuleLink(toModuleLinkFilter(value))}
          onClear={() => setModuleLink(DOCUMENT_FILTER_ALL)}
        />

        <DocumentFiltersToolbarSelect
          label="Attributes"
          options={completenessOptions}
          selectedValue={filters.completeness}
          isActive={completenessFilterActive}
          disabled={controlsDisabled}
          onChange={(value) => setCompleteness(toCompletenessFilter(value))}
          onClear={() => setCompleteness(DOCUMENT_FILTER_ALL)}
        />

        {showIsolateNodes ? (
          <ToolbarField label="Node focus">
            <div className="flex min-h-9 items-center gap-3 rounded-md border border-input bg-background px-3">
              <Switch
                checked={nodesOnly}
                onCheckedChange={setNodesOnly}
                disabled={controlsDisabled}
                aria-label="Toggle to show only nodes without relations"
                size="sm"
              />
              <span
                className={cn(
                  "text-sm transition-colors",
                  nodesOnly
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                  controlsDisabled && "opacity-50"
                )}
              >
                Hide relations
              </span>
            </div>
          </ToolbarField>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 2xl:pt-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2 text-primary"
          disabled={resetDisabled}
          onClick={resetWorkspace}
          title={resetLabel}
          aria-label={resetLabel}
        >
          <RotateCcw className="size-4" />
          <span>{resetLabel}</span>
        </Button>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 2xl:mt-0.5"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronLeft className="h-3 w-3 shrink-0" />
          )}
        </button>
      </div>
    </div>
  )
}
