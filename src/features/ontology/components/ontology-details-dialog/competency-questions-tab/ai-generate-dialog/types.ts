export type AiGenerateDialogStep = "config" | "review"
export type ProviderType = "gemini" | "ollama"

export interface AiGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ontologyId: string
  cqCount: number
}

export interface ReviewSelections {
  modules: Set<string>
  classes: Set<string>
  relations: Set<string>
  cqMappings: Set<string>
}
