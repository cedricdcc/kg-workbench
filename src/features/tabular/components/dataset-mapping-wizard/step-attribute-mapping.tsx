"use client"

import { useState } from "react"
import { Bot, Key, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { synthesizeOntologyMappingsAction } from "@/features/tabular/server/actions/synthesize-mappings"
import type { ColumnPrivacyConfig } from "@/features/tabular/server/services/pii-masker"
import type { ArchivedDatasetSource } from "@/features/tabular/types"
import { toast } from "sonner"
import { ColumnPrivacyPopover } from "./column-privacy-popover"
import type { WizardState } from "./types"

interface StepAttributeMappingProps {
  ontologyId: string
  dataset: ArchivedDatasetSource
  wizardState: WizardState
  onChange: (updates: Partial<WizardState>) => void
  existingClasses: Array<{ id: string; name: string }>
}

export function StepAttributeMapping({
  ontologyId,
  dataset,
  wizardState,
  onChange,
  existingClasses,
}: StepAttributeMappingProps) {
  const [isAiLoading, setIsAiLoading] = useState(false)

  const handleAiAutoSuggest = async () => {
    setIsAiLoading(true)
    try {
      const resp = await synthesizeOntologyMappingsAction({
        ontologyId,
        sourceName: dataset.sourceName,
        profile: {
          rowCount: dataset.rowCount,
          columnCount: dataset.columnCount,
          candidateKeys: dataset.profileSummary?.candidateKeys || [],
          columns: dataset.profileSummary?.columns || [],
        },
        sampleRows: dataset.sampleRows || [],
        privacyConfigs: wizardState.privacyConfigs,
      })

      if (resp.success) {
        const spec = resp.mappingSpec
        onChange({
          targetClassName: spec.targetClassName || wizardState.targetClassName,
          primaryKeyColumn:
            spec.primaryKeyColumn || wizardState.primaryKeyColumn,
          columnMappings: spec.columnMappings,
          synthesizedElements: spec.synthesizedElements || {
            classes: [],
            attributes: [],
            relations: [],
          },
        })
        toast.success("AI generated schema mapping suggestions!")
      } else {
        toast.error(resp.error)
      }
    } catch (err) {
      toast.error(
        `Failed to run AI suggestion: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsAiLoading(false)
    }
  }

  const updateColumnMapping = (
    index: number,
    patch: Partial<WizardState["columnMappings"][number]>
  ) => {
    const updated = [...wizardState.columnMappings]
    updated[index] = { ...updated[index], ...patch }
    onChange({ columnMappings: updated })
  }

  const handlePrivacyConfigChange = (updated: ColumnPrivacyConfig) => {
    const current = wizardState.privacyConfigs || []
    const existingIndex = current.findIndex(
      (c) => c.columnName === updated.columnName
    )
    let next: ColumnPrivacyConfig[]
    if (existingIndex >= 0) {
      next = [...current]
      next[existingIndex] = updated
    } else {
      next = [...current, updated]
    }
    onChange({ privacyConfigs: next })
  }

  return (
    <div className="space-y-3 py-2 text-xs">
      {/* Top Banner & AI Suggest Button */}
      <div className="flex items-center justify-between rounded-md border bg-muted/20 p-2.5">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Step 2: Map Columns to Properties</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Configure how each column maps to class attributes or foreign key
            relations.
          </div>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="h-8 gap-1.5 text-xs font-medium"
          onClick={handleAiAutoSuggest}
          disabled={isAiLoading}
        >
          {isAiLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Synthesizing...
            </>
          ) : (
            <>
              <Bot className="h-3.5 w-3.5 text-blue-500" />
              Auto-Suggest with AI
            </>
          )}
        </Button>
      </div>

      {/* Column mapping table */}
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-12 gap-2 border-b bg-muted/50 p-2 text-[11px] font-semibold text-muted-foreground">
          <div className="col-span-3">Dataset Column</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Target Kind</div>
          <div className="col-span-3">Target Property Name</div>
          <div className="col-span-2">Target Data Type / Class</div>
        </div>

        <ScrollArea className="h-64">
          <div className="divide-y">
            {wizardState.columnMappings.map((col, idx) => {
              const isPk = col.columnName === wizardState.primaryKeyColumn
              const privacyConfig = wizardState.privacyConfigs?.find(
                (c) => c.columnName === col.columnName
              ) || {
                columnName: col.columnName,
                isMasked: false,
                maskingStrategy: "none" as const,
              }
              const sampleValue =
                dataset.sampleRows?.[0]?.[col.columnName] ??
                dataset.profileSummary?.columns?.find(
                  (c) => c.name === col.columnName
                )?.sampleValues?.[0]

              return (
                <div
                  key={col.columnName}
                  className={`grid grid-cols-12 items-center gap-2 p-2 text-xs ${
                    col.targetKind === "ignore" ? "bg-muted/10 opacity-50" : ""
                  }`}
                >
                  {/* Column Name & Privacy Pill */}
                  <div className="col-span-3 flex items-center justify-between gap-1 pr-1">
                    <div className="flex items-center gap-1 truncate font-mono font-medium">
                      {isPk && (
                        <Key className="h-3 w-3 shrink-0 text-emerald-500" />
                      )}
                      <span title={col.columnName} className="truncate">
                        {col.columnName}
                      </span>
                    </div>
                    <ColumnPrivacyPopover
                      config={privacyConfig}
                      onChange={handlePrivacyConfigChange}
                      sampleValue={sampleValue}
                    />
                  </div>

                  {/* Inferred Type */}
                  <div className="col-span-2 text-[11px] text-muted-foreground capitalize">
                    {col.inferredType}
                  </div>

                  {/* Target Kind */}
                  <div className="col-span-2">
                    <select
                      className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                      value={col.targetKind}
                      onChange={(e) =>
                        updateColumnMapping(idx, {
                          targetKind: e.target.value as
                            "attribute" | "relation" | "ignore",
                        })
                      }
                    >
                      <option value="attribute">Attribute</option>
                      <option value="relation">Relation</option>
                      <option value="ignore">Ignore</option>
                    </select>
                  </div>

                  {/* Property Name */}
                  <div className="col-span-3">
                    {col.targetKind !== "ignore" && (
                      <Input
                        className="h-7 font-mono text-xs"
                        value={
                          col.targetKind === "relation"
                            ? col.targetRelationName || ""
                            : col.targetAttributeName || ""
                        }
                        onChange={(e) =>
                          updateColumnMapping(
                            idx,
                            col.targetKind === "relation"
                              ? { targetRelationName: e.target.value }
                              : { targetAttributeName: e.target.value }
                          )
                        }
                        placeholder={
                          col.targetKind === "relation"
                            ? "hasRelation"
                            : "attributeName"
                        }
                      />
                    )}
                  </div>

                  {/* Target Data Type / Class */}
                  <div className="col-span-2">
                    {col.targetKind === "attribute" && (
                      <select
                        className="h-7 w-full rounded border border-input bg-background px-1 font-mono text-[11px]"
                        value={col.targetDataType || "xsd:string"}
                        onChange={(e) =>
                          updateColumnMapping(idx, {
                            targetDataType: e.target.value,
                          })
                        }
                      >
                        <option value="xsd:string">xsd:string</option>
                        <option value="xsd:integer">xsd:integer</option>
                        <option value="xsd:decimal">xsd:decimal</option>
                        <option value="xsd:boolean">xsd:boolean</option>
                        <option value="xsd:dateTime">xsd:dateTime</option>
                      </select>
                    )}

                    {col.targetKind === "relation" && (
                      <select
                        className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]"
                        value={col.targetClassId || ""}
                        onChange={(e) =>
                          updateColumnMapping(idx, {
                            targetClassId: e.target.value,
                          })
                        }
                      >
                        <option value="">-- Target Class --</option>
                        {existingClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
