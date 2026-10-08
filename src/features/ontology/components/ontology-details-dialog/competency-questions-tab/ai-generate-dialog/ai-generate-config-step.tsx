"use client"

import { useState } from "react"
import { Bot, Cpu, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AiGenerationOptions } from "@/features/ontology/server/services/ai-ontology-generator"
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
  const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash")
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434")
  const [ollamaModel, setOllamaModel] = useState("qwen2.5")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (provider === "gemini") {
      onGenerate({
        provider: "gemini",
        apiKey: geminiApiKey.trim() || undefined,
        model: geminiModel.trim() || "gemini-2.0-flash",
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
              Gemini API Key (Optional override)
            </Label>
            <Input
              id="gemini-key"
              type="password"
              placeholder="Defaults to server GEMINI_API_KEY if configured"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Uses the Google AI Studio free tier (up to 15 RPM, 1,500
              requests/day).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gemini-model" className="text-xs font-medium">
              Model
            </Label>
            <Input
              id="gemini-model"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="text-xs"
              placeholder="gemini-2.0-flash"
            />
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
