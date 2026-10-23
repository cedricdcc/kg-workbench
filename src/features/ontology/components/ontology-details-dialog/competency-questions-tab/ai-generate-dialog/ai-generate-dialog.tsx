"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { GeneratedOntologyDraft } from "@/features/ontology/schemas/ai-generation"
import {
  applyOntologyDraft,
  generateOntologyDraft,
} from "@/features/ontology/server/actions/generate-ontology"
import type { AiGenerationOptions } from "@/features/ontology/server/services/ai-ontology-generator"
import type { DiscoveredVocabularyItem } from "@/features/ontology/server/services/vocabulary-registries"
import { AiGenerateConfigStep } from "./ai-generate-config-step"
import { AiVocabularyCheckpointStep } from "./ai-vocabulary-checkpoint-step"
import { AiGenerateReviewStep } from "./ai-generate-review-step"
import type { AiGenerateDialogProps, AiGenerateDialogStep } from "./types"

export function AiGenerateOntologyDialog({
  open,
  onOpenChange,
  ontologyId,
  cqCount,
}: AiGenerateDialogProps) {
  const [step, setStep] = useState<AiGenerateDialogStep>("config")
  const [configOptions, setConfigOptions] =
    useState<AiGenerationOptions | null>(null)
  const [draft, setDraft] = useState<GeneratedOntologyDraft | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const queryClient = useQueryClient()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep("config")
      setConfigOptions(null)
      setDraft(null)
      setIsGenerating(false)
      setIsApplying(false)
    }
    onOpenChange(nextOpen)
  }

  function handleConfigSubmit(options: AiGenerationOptions) {
    setConfigOptions(options)
    setStep("standards")
  }

  async function handleStandardsConfirm(
    selectedVocabs: DiscoveredVocabularyItem[]
  ) {
    if (!configOptions) return
    const optionsWithVocabs: AiGenerationOptions = {
      ...configOptions,
      vocabulariesToImport: selectedVocabs.map((v) => ({
        prefix: v.prefix,
        name: v.name,
        baseIri: v.baseIri,
        sourceRegistry: v.sourceRegistry,
        sourceId: v.sourceId,
      })),
    }
    await handleGenerate(optionsWithVocabs)
  }

  async function handleGenerate(options: AiGenerationOptions) {
    setIsGenerating(true)
    try {
      const generated = await generateOntologyDraft(ontologyId, options)
      setDraft(generated)
      setStep("review")
      toast.success(
        `AI synthesized ${generated.modules.length} modules, ${generated.classes.length} classes, ${generated.relations.length} relations, and ${generated.cqMappings.length} CQ graph patterns.`
      )
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate ontology draft."
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleApply(finalizedDraft: GeneratedOntologyDraft) {
    setIsApplying(true)
    try {
      const result = await applyOntologyDraft(ontologyId, finalizedDraft)
      toast.success(
        `Ontology updated: ${result.createdModules} modules, ${result.createdClasses} classes, ${result.createdRelations} relations created, and ${result.updatedCQs} CQs linked.`
      )
      await queryClient.invalidateQueries()
      handleOpenChange(false)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to apply ontology draft."
      toast.error(message)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] font-medium text-muted-foreground">
            <span
              className={step === "config" ? "font-semibold text-primary" : ""}
            >
              1. Provider & Model
            </span>
            <span>→</span>
            <span
              className={
                step === "standards" ? "font-semibold text-primary" : ""
              }
            >
              2. Standards Checkpoint
            </span>
            <span>→</span>
            <span
              className={step === "review" ? "font-semibold text-primary" : ""}
            >
              3. Schema & OWL Review
            </span>
          </div>

          <DialogTitle className="flex items-center gap-2 pt-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {step === "config" && "AI-Assisted Schema Synthesis from CQs"}
            {step === "standards" &&
              "Standard Vocabularies & Registry Discovery"}
            {step === "review" &&
              "Review Proposed OWL Schema & Multi-Triple CQs"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "config" &&
              "Configure your AI model. The pipeline deconstructs your Competency Questions into multi-hop graph patterns to build a formal OWL data model."}
            {step === "standards" &&
              "Verify active standards and choose newly discovered external ontologies to import before generating schema classes and relationships."}
            {step === "review" &&
              "Inspect proposed modules, classes, relations, and multi-triple CQ graph patterns before applying to the database."}
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <AiGenerateConfigStep
            cqCount={cqCount}
            isLoading={isGenerating}
            onGenerate={handleConfigSubmit}
            onCancel={() => handleOpenChange(false)}
          />
        )}

        {step === "standards" && (
          <AiVocabularyCheckpointStep
            ontologyId={ontologyId}
            isLoading={isGenerating}
            onConfirm={handleStandardsConfirm}
            onBack={() => setStep("config")}
          />
        )}

        {step === "review" && draft && (
          <AiGenerateReviewStep
            draft={draft}
            isApplying={isApplying}
            onBack={() => setStep("standards")}
            onApply={handleApply}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
