"use client"

import { useState } from "react"
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Server,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteUserApiKey } from "@/features/settings/server/actions/delete-api-key"
import { saveUserApiKey } from "@/features/settings/server/actions/save-api-key"
import { testUserApiKey } from "@/features/settings/server/actions/test-api-key"
import type { ApiKeyCardProps } from "./types"

export function ApiKeyCard({ status, onStatusChange }: ApiKeyCardProps) {
  const [keyInput, setKeyInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await testUserApiKey(
        status.provider,
        keyInput.trim() || undefined
      )
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connection successful (${res.latencyMs ?? 0}ms)`,
        })
        toast.success(`Connected to ${status.displayName} successfully!`)
      } else {
        setTestResult({
          ok: false,
          message: res.error || "Connection failed.",
        })
        toast.error(`Connection failed: ${res.error}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test request failed."
      setTestResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!keyInput.trim()) {
      toast.error(
        status.provider === "vllm"
          ? "Please enter an endpoint URL or API key."
          : "Please enter an API key."
      )
      return
    }

    setIsSaving(true)
    try {
      const res = await saveUserApiKey(status.provider, keyInput.trim())
      if (res.ok) {
        toast.success(
          status.provider === "vllm"
            ? `${status.displayName} configuration saved and encrypted.`
            : `${status.displayName} API key saved and encrypted.`
        )
        setKeyInput("")
        setTestResult(null)
        onStatusChange?.({
          ...status,
          isConfigured: true,
          keyHint: res.keyHint,
          updatedAt: new Date().toISOString(),
        })
      } else {
        toast.error(res.error || "Failed to save API key.")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteUserApiKey(status.provider)
      if (res.ok) {
        toast.success(`Custom key removed. Reverted to default settings.`)
        setTestResult(null)
        onStatusChange?.({
          ...status,
          isConfigured: false,
          keyHint: undefined,
          updatedAt: undefined,
        })
      } else {
        toast.error(res.error || "Failed to remove key.")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove key.")
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusBadge = () => {
    if (status.isConfigured) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-400"
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Configured ({status.keyHint})
        </Badge>
      )
    }

    if (status.hasEnvFallback) {
      return (
        <Badge
          variant="outline"
          className="border-sky-500/30 bg-sky-500/10 font-normal text-sky-700 dark:text-sky-400"
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
          Server Default
        </Badge>
      )
    }

    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/30 font-normal text-muted-foreground"
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Not Configured
      </Badge>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/40">
            {status.provider === "gemini" ? (
              <Sparkles className="h-4 w-4 text-primary" />
            ) : status.provider === "vllm" ? (
              <Server className="h-4 w-4 text-primary" />
            ) : (
              <KeyRound className="h-4 w-4 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-heading text-sm font-medium">
              {status.displayName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {status.provider === "vllm"
                ? "Powers local OpenAI-compatible LLM inference via vLLM server."
                : "Powers AI ontology draft generation from CQs and relation reconciliation."}
            </p>
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Input */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`api-key-${status.provider}`} className="text-xs">
            {status.provider === "vllm"
              ? status.isConfigured
                ? "Update Endpoint URL / API Key"
                : "Endpoint URL / API Key"
              : status.isConfigured
                ? "Update API Key"
                : "API Key"}
          </Label>
          {status.provider === "vllm" ? (
            <a
              href="https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              vLLM Documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Get a free Gemini API key
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="relative">
          <Input
            id={`api-key-${status.provider}`}
            type={showPassword ? "text" : "password"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={
              status.provider === "vllm"
                ? status.isConfigured
                  ? "Paste new URL or key..."
                  : status.hasEnvFallback
                    ? "Using server environment VLLM_BASE_URL, or paste custom endpoint"
                    : "Enter vLLM endpoint (e.g. http://localhost:8000/v1)"
                : status.isConfigured
                  ? "Paste new key to update..."
                  : status.hasEnvFallback
                    ? "Leave blank to use server environment key, or paste custom key"
                    : "Enter your Gemini API key (e.g. AIzaSy...)"
            }
            className="pr-10 font-mono text-xs"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide API key" : "Show API key"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Test feedback */}
      {testResult ? (
        <div
          className={`flex items-start gap-2 rounded-md p-2.5 text-xs ${
            testResult.ok
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="leading-relaxed">{testResult.message}</span>
        </div>
      ) : null}

      {/* Security Note & Action Controls */}
      <div className="flex flex-col justify-between gap-3 border-t border-border/50 pt-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>Encrypted at rest with AES-256-GCM. Never shared.</span>
        </div>

        <div className="flex items-center gap-2">
          {status.isConfigured ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              {status.provider === "vllm" ? "Remove Config" : "Remove Key"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={
              isTesting ||
              (status.provider !== "vllm" &&
                !keyInput &&
                !status.isConfigured &&
                !status.hasEnvFallback)
            }
            className="text-xs"
          >
            {isTesting ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Test Connection
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !keyInput.trim()}
            className="text-xs"
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {status.provider === "vllm" ? "Save Config" : "Save Key"}
          </Button>
        </div>
      </div>
    </div>
  )
}
