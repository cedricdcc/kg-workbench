"use client"

import { useState } from "react"
import { Check, Copy, Download, Layers, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { addReferenceOntology } from "@/features/ontology/server/actions/reference-vocabularies"
import type { RegistrySearchResult } from "@/features/ontology/server/services/vocabulary-registries"

interface ProbeResultsPanelProps {
  detectedVocabularies: RegistrySearchResult[]
  rawPayload: unknown
  existingPrefixes: Set<string>
  onImported: () => void
  onSaveSnapshot: () => void
  isSavingSnapshot: boolean
}

export function ProbeResultsPanel({
  detectedVocabularies,
  rawPayload,
  existingPrefixes,
  onImported,
  onSaveSnapshot,
  isSavingSnapshot,
}: ProbeResultsPanelProps) {
  const [importingPrefix, setImportingPrefix] = useState<string | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  async function handleImport(item: RegistrySearchResult) {
    setImportingPrefix(item.prefix)
    try {
      await addReferenceOntology({
        prefix: item.prefix,
        name: item.name,
        baseIri: item.baseIri,
        sourceRegistry: item.source,
        sourceId: item.sourceId,
      })
      toast.success(
        `Added "${item.name}" (${item.prefix.toUpperCase()}) to workspace standards.`
      )
      onImported()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import ontology."
      )
    } finally {
      setImportingPrefix(null)
    }
  }

  function handleCopy() {
    const text =
      typeof rawPayload === "string"
        ? rawPayload
        : JSON.stringify(rawPayload, null, 2)
    navigator.clipboard.writeText(text)
    setHasCopied(true)
    toast.success("Payload copied to clipboard.")
    setTimeout(() => setHasCopied(false), 2000)
  }

  const formattedPayload =
    typeof rawPayload === "string"
      ? rawPayload
      : JSON.stringify(rawPayload, null, 2)

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12 min-h-0 flex-1 overflow-hidden">
      {/* Left Column: Detected Vocabularies */}
      <div className="flex flex-col md:col-span-6 min-h-0 rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Detected Vocabularies ({detectedVocabularies.length})</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            1-Click Add to Workspace
          </span>
        </div>

        <ScrollArea className="flex-1 p-2.5">
          {detectedVocabularies.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No specific vocabularies extracted from this payload preview. You can inspect the raw response on the right or save the snapshot.
            </div>
          ) : (
            <div className="space-y-2">
              {detectedVocabularies.map((item) => {
                const isImported = existingPrefixes.has(item.prefix.toLowerCase())
                const isImporting = importingPrefix === item.prefix

                return (
                  <div
                    key={`${item.source}-${item.prefix}-${item.sourceId}`}
                    className="flex items-start justify-between gap-2 rounded-md border p-2.5 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {item.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono px-1 py-0"
                        >
                          {item.prefix}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[9px] uppercase tracking-wide px-1 py-0"
                        >
                          {item.source}
                        </Badge>
                      </div>

                      {item.description && (
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <div className="truncate font-mono text-[9px] text-muted-foreground/80">
                        {item.baseIri}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isImported ? "secondary" : "default"}
                      disabled={isImported || isImporting}
                      onClick={() => handleImport(item)}
                      className="shrink-0 h-7 text-xs gap-1 px-2.5"
                    >
                      {isImporting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isImported ? (
                        <>
                          <Check className="h-3 w-3" />
                          Imported
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          Import
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Column: Raw Response Inspector */}
      <div className="flex flex-col md:col-span-6 min-h-0 rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/40">
          <span className="text-xs font-semibold">Response Payload Inspector</span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-6 text-[11px] gap-1 px-2"
            >
              {hasCopied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Copy
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onSaveSnapshot}
              disabled={isSavingSnapshot || !rawPayload}
              className="h-6 text-[11px] gap-1 px-2"
            >
              {isSavingSnapshot ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              Save Snapshot
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-2.5 bg-muted/10">
          <pre className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground select-text">
            {formattedPayload || "// No payload returned"}
          </pre>
        </ScrollArea>
      </div>
    </div>
  )
}
