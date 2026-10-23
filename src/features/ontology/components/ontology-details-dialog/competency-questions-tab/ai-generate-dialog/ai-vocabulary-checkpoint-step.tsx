"use client"

import { useEffect, useState } from "react"
import { Check, Database, Globe, Loader2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getRegistryDiscoveryCandidates } from "@/features/ontology/server/actions/generate-ontology"
import type { DiscoveredVocabularyItem } from "@/features/ontology/server/services/vocabulary-registries"

interface AiVocabularyCheckpointStepProps {
  ontologyId: string
  isLoading: boolean
  onConfirm: (selectedVocabs: DiscoveredVocabularyItem[]) => void
  onBack: () => void
}

export function AiVocabularyCheckpointStep({
  ontologyId,
  isLoading,
  onConfirm,
  onBack,
}: AiVocabularyCheckpointStepProps) {
  const [isScanning, setIsScanning] = useState(true)
  const [activeVocabs, setActiveVocabs] = useState<DiscoveredVocabularyItem[]>(
    []
  )
  const [recommendedVocabs, setRecommendedVocabs] = useState<
    DiscoveredVocabularyItem[]
  >([])
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(
    new Set()
  )

  useEffect(() => {
    let mounted = true
    getRegistryDiscoveryCandidates(ontologyId)
      .then((data) => {
        if (!mounted) return
        setActiveVocabs(data.activeVocabularies)
        setRecommendedVocabs(data.recommendedVocabularies)
        // Select top recommended vocabularies by default
        const initial = new Set<string>()
        for (const r of data.recommendedVocabularies.slice(0, 3)) {
          initial.add(r.prefix.toLowerCase())
        }
        setSelectedPrefixes(initial)
      })
      .catch((err) => {
        console.error("Failed to discover registry candidates:", err)
      })
      .finally(() => {
        if (mounted) setIsScanning(false)
      })

    return () => {
      mounted = false
    }
  }, [ontologyId])

  function togglePrefix(prefix: string) {
    const key = prefix.toLowerCase()
    const next = new Set(selectedPrefixes)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedPrefixes(next)
  }

  function handleProceed() {
    const selected = recommendedVocabs.filter((v) =>
      selectedPrefixes.has(v.prefix.toLowerCase())
    )
    onConfirm(selected)
  }

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Globe className="h-3.5 w-3.5 text-primary" />
          Standard Vocabularies & Registry Discovery
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Grounding your schema in existing standard ontologies (e.g. SOSA,
          QUDT, GeoSPARQL) ensures your Knowledge Graph produces compliant OWL
          entities and avoids redundant concept duplication.
        </p>
      </div>

      {isScanning ? (
        <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Searching standard registries (OLS4, LOV, BARTOC)...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Already Active in Workspace */}
          {activeVocabs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <Database className="h-3 w-3 text-muted-foreground" />
                Already Active in Your Workspace ({activeVocabs.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeVocabs.map((v) => (
                  <Badge
                    key={v.prefix}
                    variant="outline"
                    className="gap-1 border-primary/30 bg-primary/5 py-1 text-xs"
                  >
                    <Check className="h-3 w-3 text-primary" />
                    <span className="font-mono font-semibold uppercase">
                      {v.prefix}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({v.name})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Discovered Candidates */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span>
                Discovered Standards Matching Your Domain (
                {recommendedVocabs.length})
              </span>
              <span className="text-[10px] font-normal text-muted-foreground lowercase">
                Select which ontologies to import
              </span>
            </div>

            {recommendedVocabs.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No new external ontologies found. Schema synthesis will proceed
                with existing local standards.
              </div>
            ) : (
              <ScrollArea className="h-[210px] rounded-md border p-2">
                <div className="space-y-2">
                  {recommendedVocabs.map((v) => {
                    const isChecked = selectedPrefixes.has(
                      v.prefix.toLowerCase()
                    )
                    return (
                      <div
                        key={v.prefix}
                        onClick={() => togglePrefix(v.prefix)}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors ${
                          isChecked
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/60 hover:bg-muted/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePrefix(v.prefix)}
                          className="mt-0.5 h-4 w-4 rounded border-border"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground uppercase">
                              {v.prefix}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {v.sourceRegistry.toUpperCase()}
                            </Badge>
                            {v.matchedKeywords.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Matches:{" "}
                                {v.matchedKeywords.slice(0, 3).join(", ")}
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {v.description || v.name}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onConfirm([])}
            disabled={isLoading || isScanning}
          >
            Skip Standards
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleProceed}
            disabled={isLoading || isScanning}
            className="gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Synthesize Schema & Triples →
          </Button>
        </div>
      </div>
    </div>
  )
}
