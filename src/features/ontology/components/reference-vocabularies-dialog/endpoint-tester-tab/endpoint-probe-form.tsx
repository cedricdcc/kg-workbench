"use client"

import { useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2, Play, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveRegistryApiKey } from "@/features/ontology/server/actions/reference-vocabularies"

interface EndpointProbeFormProps {
  providerId: string
  endpointUrl: string
  onEndpointUrlChange: (url: string) => void
  apiKey: string
  onApiKeyChange: (key: string) => void
  query: string
  onQueryChange: (query: string) => void
  requiresApiKey?: boolean
  isProbing: boolean
  onProbe: () => void
}

export function EndpointProbeForm({
  providerId,
  endpointUrl,
  onEndpointUrlChange,
  apiKey,
  onApiKeyChange,
  query,
  onQueryChange,
  requiresApiKey,
  isProbing,
  onProbe,
}: EndpointProbeFormProps) {
  const [showKey, setShowKey] = useState(false)
  const [isSavingKey, setIsSavingKey] = useState(false)

  async function handleSaveKey() {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      toast.error("Please enter an API key to save.")
      return
    }

    setIsSavingKey(true)
    try {
      await saveRegistryApiKey(providerId, trimmed)
      toast.success(`API key for ${providerId.toUpperCase()} saved securely.`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save API key."
      )
    } finally {
      setIsSavingKey(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onProbe()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
        <div className="sm:col-span-6 space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Endpoint URL
          </Label>
          <Input
            value={endpointUrl}
            onChange={(e) => onEndpointUrlChange(e.target.value)}
            placeholder="https://..."
            className="text-xs font-mono h-8"
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Test Query
          </Label>
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="e.g. sensor, sosa, crop"
            className="text-xs h-8"
          />
        </div>

        <div className="sm:col-span-3 flex items-end">
          <Button
            type="submit"
            size="sm"
            disabled={isProbing || !endpointUrl.trim()}
            className="w-full h-8 gap-1.5 text-xs font-medium"
          >
            {isProbing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            Test Probe
          </Button>
        </div>
      </div>

      {(requiresApiKey || providerId === "custom") && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/60">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={`Optional API Key / Token for ${providerId.toUpperCase()}`}
              className="text-xs font-mono pr-8 h-7"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
            >
              {showKey ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveKey}
            disabled={isSavingKey || !apiKey.trim()}
            className="h-7 text-xs gap-1 shrink-0"
          >
            {isSavingKey ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save Key
          </Button>
        </div>
      )}
    </form>
  )
}
