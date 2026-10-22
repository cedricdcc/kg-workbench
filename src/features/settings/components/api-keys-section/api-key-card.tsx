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
      toast.error("Please enter an API key.")
      return
    }

    setIsSaving(true)
    try {
      const res = await saveUserApiKey(status.provider, keyInput.trim())
      if (res.ok) {
        toast.success(`${status.displayName} API key saved and encrypted.`)
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
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-normal"
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          Configured ({status.keyHint})
        </Badge>
      )
    }

    if (status.hasEnvFallback) {
      return (
        <Badge
          variant="outline"
          className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400 font-normal"
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
          Server Default
        </Badge>
      )
    }

    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/30 text-muted-foreground font-normal"
      >
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
        Not Configured
      </Badge>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/40">
            {status.provider === "gemini" ? (
              <Sparkles className="h-4 w-4 text-primary" />
            ) : (
              <KeyRound className="h-4 w-4 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-heading font-medium text-sm">
              {status.displayName}
            </h3>
            <p className="text-xs text-muted-foreground">
              Powers AI ontology draft generation from CQs and relation
              reconciliation.
            </p>
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Input */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`api-key-${status.provider}`} className="text-xs">
            {status.isConfigured ? "Update API Key" : "API Key"}
          </Label>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            Get a free Gemini API key
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="relative">
          <Input
            id={`api-key-${status.provider}`}
            type={showPassword ? "text" : "password"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={
              status.isConfigured
                ? "Paste new key to update..."
                : status.hasEnvFallback
                  ? "Leave blank to use server environment key, or paste custom key"
                  : "Enter your Gemini API key (e.g. AIzaSy...)"
            }
            className="pr-10 text-xs font-mono"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{testResult.message}</span>
        </div>
      ) : null}

      {/* Security Note & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
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
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Remove Key
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || (!keyInput && !status.isConfigured && !status.hasEnvFallback)}
            className="text-xs"
          >
            {isTesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
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
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Save Key
          </Button>
        </div>
      </div>
    </div>
  )
}
