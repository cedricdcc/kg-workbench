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
import { AiGenerateConfigStep } from "./ai-generate-config-step"
import { AiGenerateReviewStep } from "./ai-generate-review-step"
import type { AiGenerateDialogProps, AiGenerateDialogStep } from "./types"

export function AiGenerateOntologyDialog({
  open,
  onOpenChange,
  ontologyId,
  cqCount,
}: AiGenerateDialogProps) {
  const [step, setStep] = useState<AiGenerateDialogStep>("config")
  const [draft, setDraft] = useState<GeneratedOntologyDraft | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const queryClient = useQueryClient()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset state when closing
      setStep("config")
      setDraft(null)
      setIsGenerating(false)
      setIsApplying(false)
    }
    onOpenChange(nextOpen)
  }

  async function handleGenerate(options: AiGenerationOptions) {
    setIsGenerating(true)
    try {
      const generated = await generateOntologyDraft(ontologyId, options)
      setDraft(generated)
      setStep("review")
      toast.success(
        `AI generated ${generated.modules.length} modules, ${generated.classes.length} classes, and ${generated.relations.length} relations.`
      )
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate ontology draft."
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
      // Invalidate queries to refresh ontology state
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
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {step === "config"
              ? "AI-Assisted Ontology Generation"
              : "Review Proposed Ontology Draft"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "config"
              ? "Generate domain modules, classes, and relations based on all competency questions."
              : "Inspect the proposed modules, classes, attributes, relations, and CQ links before applying them."}
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <AiGenerateConfigStep
            cqCount={cqCount}
            isLoading={isGenerating}
            onGenerate={handleGenerate}
            onCancel={() => handleOpenChange(false)}
          />
        )}

        {step === "review" && draft && (
          <AiGenerateReviewStep
            draft={draft}
            isApplying={isApplying}
            onBack={() => setStep("config")}
            onApply={handleApply}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
