"use client"

import { useState } from "react"
import { Bot, Key, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

      {/* Column mapping cards in responsive multi-column grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
              className={`flex flex-col justify-between rounded-lg border bg-card p-3 shadow-xs transition-colors ${
                col.targetKind === "ignore"
                  ? "border-muted/60 bg-muted/15 opacity-60"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div>
                {/* Header: Column Name, Inferred Type, PK Badge, and Privacy Popover */}
                <div className="flex items-center justify-between gap-1.5 border-b pb-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {isPk && (
                      <Key className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    )}
                    <span
                      title={col.columnName}
                      className="truncate font-mono text-xs font-semibold text-foreground"
                    >
                      {col.columnName}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1.5 py-0 font-mono text-[10px] capitalize"
                    >
                      {col.inferredType}
                    </Badge>
                  </div>
                  <ColumnPrivacyPopover
                    config={privacyConfig}
                    onChange={handlePrivacyConfigChange}
                    sampleValue={sampleValue}
                  />
                </div>

                {/* Sample Value */}
                {sampleValue !== undefined && sampleValue !== null && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="shrink-0 font-medium text-foreground/70">
                      Sample:
                    </span>
                    <span
                      className="max-w-[220px] truncate rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]"
                      title={String(sampleValue)}
                    >
                      {String(sampleValue)}
                    </span>
                  </div>
                )}

                {/* Mapping Controls */}
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">
                        Target Kind
                      </label>
                      <select
                        className="mt-0.5 h-8 w-full rounded border border-input bg-background px-2 text-xs"
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

                    <div>
                      {col.targetKind === "attribute" && (
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">
                            Data Type
                          </label>
                          <select
                            className="mt-0.5 h-8 w-full rounded border border-input bg-background px-1.5 font-mono text-[11px]"
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
                        </div>
                      )}

                      {col.targetKind === "relation" && (
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">
                            Target Class
                          </label>
                          <select
                            className="mt-0.5 h-8 w-full rounded border border-input bg-background px-1.5 text-xs"
                            value={col.targetClassId || ""}
                            onChange={(e) =>
                              updateColumnMapping(idx, {
                                targetClassId: e.target.value,
                              })
                            }
                          >
                            <option value="">-- Class --</option>
                            {existingClasses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {col.targetKind === "ignore" && (
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">
                            Status
                          </label>
                          <div className="mt-0.5 flex h-8 items-center px-1 text-xs text-muted-foreground italic">
                            Ignored
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {col.targetKind !== "ignore" && (
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">
                        {col.targetKind === "relation"
                          ? "Target Relation Name"
                          : "Target Property Name"}
                      </label>
                      <Input
                        className="mt-0.5 h-8 font-mono text-xs"
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
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
