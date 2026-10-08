"use client"

import { useState } from "react"
import { Check, Cpu, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAvailableGeminiModels } from "@/features/ontology/server/actions/generate-ontology"
import type {
  AiGenerationOptions,
  GeminiModelInfo,
} from "@/features/ontology/server/services/ai-ontology-generator"
import type { ProviderType } from "./types"

interface ConfigStepProps {
  cqCount: number
  isLoading: boolean
  onGenerate: (options: AiGenerationOptions) => void
  onCancel: () => void
}

export function AiGenerateConfigStep({
  cqCount,
  isLoading,
  onGenerate,
  onCancel,
}: ConfigStepProps) {
  const [provider, setProvider] = useState<ProviderType>("gemini")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [geminiModel, setGeminiModel] = useState("gemini-3.8-flash")
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>([])
  const [isCheckingKey, setIsCheckingKey] = useState(false)
  const [keyVerified, setKeyVerified] = useState(false)

  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434")
  const [ollamaModel, setOllamaModel] = useState("qwen2.5")

  async function handleCheckAndFetchModels() {
    setIsCheckingKey(true)
    try {
      const models = await getAvailableGeminiModels(
        geminiApiKey.trim() || undefined
      )
      if (models.length === 0) {
        toast.warning("No generateContent models found for this Gemini key.")
        return
      }
      setAvailableModels(models)
      setKeyVerified(true)
      // Pick current model if present, otherwise default to first available
      const exists = models.some((m) => m.id === geminiModel)
      if (!exists && models[0]) {
        setGeminiModel(models[0].id)
      }
      toast.success(`Key verified! Loaded ${models.length} Gemini models.`)
    } catch (err: unknown) {
      setKeyVerified(false)
      const message =
        err instanceof Error ? err.message : "Failed to verify API key."
      toast.error(message)
    } finally {
      setIsCheckingKey(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (provider === "gemini") {
      onGenerate({
        provider: "gemini",
        apiKey: geminiApiKey.trim() || undefined,
        model: geminiModel.trim() || "gemini-3.8-flash",
      })
    } else {
      onGenerate({
        provider: "ollama",
        baseUrl: ollamaBaseUrl.trim() || "http://localhost:11434",
        model: ollamaModel.trim() || "qwen2.5",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-3.5 text-sm text-muted-foreground">
        <p>
          AI will analyze all <strong className="text-foreground">{cqCount}</strong>{" "}
          competency questions in this ontology to discover functional modules,
          entity classes with attributes, and relation edges.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          AI Provider
        </Label>
        <Tabs
          value={provider}
          onValueChange={(val) => setProvider(val as ProviderType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gemini" className="gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Google Gemini (Free/Cheap)
            </TabsTrigger>
            <TabsTrigger value="ollama" className="gap-2">
              <Cpu className="h-4 w-4 text-sky-500" />
              Local Ollama (Offline)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {provider === "gemini" && (
        <div className="space-y-3.5 rounded-md border p-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="gemini-key" className="text-xs font-medium">
              Gemini API Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="gemini-key"
                type="password"
                placeholder="Leave blank to use server GEMINI_API_KEY, or paste key"
                value={geminiApiKey}
                onChange={(e) => {
                  setGeminiApiKey(e.target.value)
                  setKeyVerified(false)
                }}
                className="text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCheckAndFetchModels}
                disabled={isCheckingKey}
                className="shrink-0 gap-1.5 text-xs"
              >
                {isCheckingKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : keyVerified ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {keyVerified ? "Verified" : "Check & Fetch Models"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Click &quot;Check &amp; Fetch Models&quot; to test your key and load
              available Gemini models.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gemini-model" className="text-xs font-medium">
              Model
              {availableModels.length > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  ({availableModels.length} available)
                </span>
              )}
            </Label>

            {availableModels.length > 0 ? (
              <Select value={geminiModel} onValueChange={setGeminiModel}>
                <SelectTrigger id="gemini-model" className="w-full text-xs">
                  <SelectValue placeholder="Select a Gemini model" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="font-medium">{m.displayName}</span>{" "}
                      <span className="text-muted-foreground">({m.id})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="gemini-model"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="text-xs"
                placeholder="gemini-3.8-flash"
              />
            )}
          </div>
        </div>
      )}

      {provider === "ollama" && (
        <div className="space-y-3.5 rounded-md border p-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="ollama-url" className="text-xs font-medium">
              Ollama Base URL
            </Label>
            <Input
              id="ollama-url"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              className="text-xs"
              placeholder="http://localhost:11434"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ollama-model" className="text-xs font-medium">
              Model Name
            </Label>
            <Input
              id="ollama-model"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="text-xs"
              placeholder="qwen2.5 or llama3"
            />
            <p className="text-[11px] text-muted-foreground">
              Ensure Ollama is running locally and the model is pulled.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing Competency Questions...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyze & Generate Draft
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
