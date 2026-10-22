"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getEndpointSnapshots,
  saveEndpointSnapshot,
  testRegistryEndpoint,
  type SnapshotSummary,
} from "@/features/ontology/server/actions/reference-vocabularies"
import type { EndpointTestResult } from "@/features/ontology/server/services/vocabulary-registries"
import {
  REGISTRY_PRESETS,
  RegistryPresetSelector,
  type RegistryPreset,
} from "./registry-preset-selector"
import { EndpointProbeForm } from "./endpoint-probe-form"
import { ProbeMetricsBar } from "./probe-metrics-bar"
import { ProbeResultsPanel } from "./probe-results-panel"
import { SavedSnapshotsDrawer } from "./saved-snapshots-drawer"

interface EndpointTesterTabProps {
  existingPrefixes: Set<string>
  onImported: () => void
}

export function EndpointTesterTab({
  existingPrefixes,
  onImported,
}: EndpointTesterTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<RegistryPreset>(
    REGISTRY_PRESETS[0]
  )
  const [endpointUrl, setEndpointUrl] = useState(REGISTRY_PRESETS[0].endpoint)
  const [apiKey, setApiKey] = useState("")
  const [query, setQuery] = useState(REGISTRY_PRESETS[0].defaultQuery)
  const [isProbing, setIsProbing] = useState(false)
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null)
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false)

  const queryClient = useQueryClient()

  const {
    data: snapshots = [],
    isLoading: isLoadingSnapshots,
    refetch: refetchSnapshots,
  } = useQuery<SnapshotSummary[]>({
    queryKey: ["endpoint-snapshots", selectedPreset.id],
    queryFn: () => getEndpointSnapshots(selectedPreset.id === "custom" ? undefined : selectedPreset.id),
  })

  function handleSelectPreset(preset: RegistryPreset) {
    setSelectedPreset(preset)
    setEndpointUrl(preset.endpoint)
    setQuery(preset.defaultQuery)
    setTestResult(null)
  }

  async function handleProbe() {
    setIsProbing(true)
    try {
      const res = await testRegistryEndpoint({
        providerId: selectedPreset.id,
        endpointUrl: endpointUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        testQuery: query.trim() || undefined,
      })
      setTestResult(res)
      if (res.ok) {
        toast.success(
          `Probe succeeded in ${res.latencyMs}ms. Found ${res.detectedVocabularies.length} vocabularies.`
        )
      } else {
        toast.error(res.error || `Probe failed with status ${res.statusCode}`)
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to execute endpoint probe."
      )
    } finally {
      setIsProbing(false)
    }
  }

  async function handleSaveSnapshot() {
    if (!testResult) return

    setIsSavingSnapshot(true)
    try {
      const payloadStr =
        typeof testResult.payloadPreview === "string"
          ? testResult.payloadPreview
          : JSON.stringify(testResult.payloadPreview, null, 2)

      await saveEndpointSnapshot({
        providerId: selectedPreset.id,
        endpointUrl: endpointUrl.trim(),
        statusCode: testResult.statusCode,
        latencyMs: testResult.latencyMs,
        queryParams: query ? `?search=${encodeURIComponent(query)}` : undefined,
        responsePayload: payloadStr,
        detectedVocabCount: testResult.detectedVocabularies.length,
      })
      toast.success("Endpoint response snapshot saved to database.")
      queryClient.invalidateQueries({ queryKey: ["endpoint-snapshots"] })
      refetchSnapshots()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save snapshot."
      )
    } finally {
      setIsSavingSnapshot(false)
    }
  }

  function handleSelectPastSnapshot(snap: SnapshotSummary) {
    let parsedPayload: unknown = snap.responsePayload
    try {
      parsedPayload = JSON.parse(snap.responsePayload)
    } catch {
      parsedPayload = snap.responsePayload
    }

    setTestResult({
      ok: snap.statusCode >= 200 && snap.statusCode < 300,
      statusCode: snap.statusCode,
      latencyMs: snap.latencyMs,
      endpointUrl: snap.endpointUrl,
      payloadPreview: parsedPayload,
      detectedVocabularies: [],
    })
    toast.info(`Loaded snapshot from ${new Date(snap.createdAt).toLocaleTimeString()}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2.5 pt-1 overflow-hidden">
      {/* Top Presets Selector */}
      <RegistryPresetSelector
        selectedId={selectedPreset.id}
        onSelect={handleSelectPreset}
      />

      {/* Endpoint & Query Probe Form */}
      <EndpointProbeForm
        providerId={selectedPreset.id}
        endpointUrl={endpointUrl}
        onEndpointUrlChange={setEndpointUrl}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        query={query}
        onQueryChange={setQuery}
        requiresApiKey={selectedPreset.requiresApiKey}
        isProbing={isProbing}
        onProbe={handleProbe}
      />

      {/* Metrics Bar if result available */}
      {testResult && (
        <ProbeMetricsBar
          ok={testResult.ok}
          statusCode={testResult.statusCode}
          latencyMs={testResult.latencyMs}
          detectedCount={testResult.detectedVocabularies.length}
          endpointUrl={testResult.endpointUrl}
        />
      )}

      {/* Results Panel: Detected Vocabularies & Inspector */}
      {testResult ? (
        <ProbeResultsPanel
          detectedVocabularies={testResult.detectedVocabularies}
          rawPayload={testResult.payloadPreview}
          existingPrefixes={existingPrefixes}
          onImported={onImported}
          onSaveSnapshot={handleSaveSnapshot}
          isSavingSnapshot={isSavingSnapshot}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
          Select a preset or custom URL above and click "Test Probe" to inspect endpoints, verify response latency, and import ontologies into workspace standards.
        </div>
      )}

      {/* Saved Snapshots History Drawer */}
      <SavedSnapshotsDrawer
        snapshots={snapshots}
        isLoading={isLoadingSnapshots}
        onRefresh={refetchSnapshots}
        onSelectSnapshot={handleSelectPastSnapshot}
      />
    </div>
  )
}
