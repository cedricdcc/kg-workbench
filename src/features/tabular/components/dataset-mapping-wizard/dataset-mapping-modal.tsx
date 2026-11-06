"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { commitDatasetMappingAction } from "@/features/tabular/server/actions/commit-dataset-mapping"
import { toast } from "sonner"
import { autoDetectPii } from "@/features/tabular/server/services/pii-masker"
import { PrivacyShieldBadge } from "./privacy-shield-badge"
import { StepEntitySelection } from "./step-entity-selection"
import { StepAttributeMapping } from "./step-attribute-mapping"
import { StepAiSynthesisReview } from "./step-ai-synthesis-review"
import {
  type DatasetMappingModalProps,
  type WizardState,
  type WizardStep,
  initializeWizardState,
  validateMappingSpecBeforeCommit,
} from "./types"

export function DatasetMappingModal({
  open,
  onOpenChange,
  ontologyId,
  dataset,
  existingClasses,
  onMappingCommitted,
}: DatasetMappingModalProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("entity")
  const [isCommitting, setIsCommitting] = useState(false)
  const [wizardState, setWizardState] = useState<WizardState>(() =>
    initializeWizardState(dataset)
  )

  // Re-sync wizardState when dataset changes
  const [lastDatasetId, setLastDatasetId] = useState<string | null>(null)
  if (dataset && dataset.id !== lastDatasetId) {
    setLastDatasetId(dataset.id)
    setWizardState(initializeWizardState(dataset))
    setCurrentStep("entity")
  }

  const handleUpdate = (updates: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }))
  }

  const maskedColumnCount = (wizardState.privacyConfigs || []).filter(
    (c) => c.isMasked
  ).length

  const handleResetPrivacy = () => {
    if (!dataset) return
    const rawColumns = dataset.profileSummary?.columns || []
    const sampleRows = dataset.sampleRows || []
    const resetConfigs = autoDetectPii(
      rawColumns.map((c) => ({
        name: c.name,
        sampleValues: c.sampleValues,
      })),
      sampleRows
    )
    handleUpdate({ privacyConfigs: resetConfigs })
    toast.info("Reset column privacy settings to auto-detected defaults")
  }

  const handleNext = () => {
    if (currentStep === "entity") {
      const val = validateMappingSpecBeforeCommit(wizardState)
      if (!val.isValid) {
        toast.error(val.error)
        return
      }
      setCurrentStep("attributes")
    } else if (currentStep === "attributes") {
      setCurrentStep("review")
    }
  }

  const handleBack = () => {
    if (currentStep === "review") {
      setCurrentStep("attributes")
    } else if (currentStep === "attributes") {
      setCurrentStep("entity")
    }
  }

  const handleCommit = async () => {
    const val = validateMappingSpecBeforeCommit(wizardState)
    if (!val.isValid) {
      toast.error(val.error)
      return
    }

    setIsCommitting(true)
    try {
      const resp = await commitDatasetMappingAction({
        ontologyId,
        datasetSourceId: dataset?.id,
        mappingSpec: {
          targetClassId: wizardState.targetClassId,
          targetClassName: wizardState.targetClassName,
          targetModuleId: wizardState.targetModuleId,
          primaryKeyColumn: wizardState.primaryKeyColumn,
          columnMappings: wizardState.columnMappings,
          synthesizedElements: wizardState.synthesizedElements,
        },
      })

      if (resp.ok) {
        toast.success(
          `Mapping committed! (${resp.createdClassesCount} classes, ${resp.createdAttributesCount} attributes created)`
        )
        onMappingCommitted()
        onOpenChange(false)
      }
    } catch (err) {
      toast.error(
        `Failed to commit mapping: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsCommitting(false)
    }
  }

  if (!dataset) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <DialogTitle>Map Dataset to Knowledge Graph</DialogTitle>
            </div>
            <PrivacyShieldBadge
              count={maskedColumnCount}
              onReset={handleResetPrivacy}
            />
          </div>
          <DialogDescription>
            Configure entity alignment and property mappings for{" "}
            <strong>{dataset.sourceName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Step progress pills */}
        <div className="grid grid-cols-3 gap-2 border-b pb-3 text-xs font-medium">
          <div
            className={`flex items-center gap-2 rounded-md p-2 ${
              currentStep === "entity"
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]">
              1
            </span>
            <span>Entity & ID</span>
          </div>

          <div
            className={`flex items-center gap-2 rounded-md p-2 ${
              currentStep === "attributes"
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]">
              2
            </span>
            <span>Columns & Relations</span>
          </div>

          <div
            className={`flex items-center gap-2 rounded-md p-2 ${
              currentStep === "review"
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]">
              3
            </span>
            <span>Review & Apply</span>
          </div>
        </div>

        {/* Wizard Step Content */}
        <div className="min-h-[300px]">
          {currentStep === "entity" && (
            <StepEntitySelection
              dataset={dataset}
              wizardState={wizardState}
              onChange={handleUpdate}
              existingClasses={existingClasses}
            />
          )}

          {currentStep === "attributes" && (
            <StepAttributeMapping
              ontologyId={ontologyId}
              dataset={dataset}
              wizardState={wizardState}
              onChange={handleUpdate}
              existingClasses={existingClasses}
            />
          )}

          {currentStep === "review" && (
            <StepAiSynthesisReview wizardState={wizardState} />
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCommitting}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {currentStep !== "entity" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={isCommitting}
                className="gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}

            {currentStep !== "review" ? (
              <Button size="sm" onClick={handleNext} className="gap-1">
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={isCommitting}
                className="gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Committing to Ontology...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Commit & Apply Mappings
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
