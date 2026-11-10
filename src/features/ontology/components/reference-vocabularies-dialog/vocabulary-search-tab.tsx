"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { addReferenceOntology } from "@/features/ontology/server/actions/reference-vocabularies"
import {
  searchAllRegistries,
  type RegistrySearchResult,
} from "@/features/ontology/server/services/vocabulary-registries"

interface VocabularySearchTabProps {
  existingPrefixes: Set<string>
  onAdded: () => void
}

const REGISTRY_FILTERS = [
  { id: "all", label: "All Registries" },
  { id: "ols4", label: "OLS4" },
  { id: "bartoc", label: "BARTOC" },
  { id: "agroportal", label: "AgroPortal" },
  { id: "bioportal", label: "BioPortal" },
  { id: "eu_vocabularies", label: "EU Vocabularies" },
]

export function VocabularySearchTab({
  existingPrefixes,
  onAdded,
}: VocabularySearchTabProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RegistrySearchResult[]>([])
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [isSearching, setIsSearching] = useState(false)
  const [addingPrefix, setAddingPrefix] = useState<string | null>(null)
  const [failedNotice, setFailedNotice] = useState<string | null>(null)
  const [selectedResultKey, setSelectedResultKey] = useState<string | null>(
    null
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const selectedResult = useMemo(() => {
    if (selectedResultKey) {
      const found = results.find(
        (r) => `${r.source}-${r.prefix}` === selectedResultKey
      )
      if (found) return found
    }
    return results[0] ?? null
  }, [results, selectedResultKey])

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setIsSearching(true)
    setFailedNotice(null)

    try {
      const enabledProviderIds =
        selectedFilter === "all"
          ? [
              "ols4",
              "bartoc",
              "agroportal",
              "bioportal",
              "eu_vocabularies",
              "lov",
            ]
          : [selectedFilter]

      const data = await searchAllRegistries(trimmed, {
        enabledProviderIds,
        timeoutMs: 4000,
      })

      setResults(data.results)
      if (data.results.length > 0) {
        setSelectedResultKey(
          `${data.results[0].source}-${data.results[0].prefix}`
        )
      } else {
        setSelectedResultKey(null)
      }

      if (data.failedProviders.length > 0) {
        const failedNames = data.failedProviders
          .map((f) => f.providerId.toUpperCase())
          .join(", ")
        setFailedNotice(
          `Could not reach ${failedNames}. Showing available results.`
        )
      }

      if (data.results.length === 0) {
        toast.info("No matching ontologies found in selected registries.")
      }
    } catch {
      toast.error("Failed to query public ontology registries.")
    } finally {
      setIsSearching(false)
    }
  }

  async function handleAdd(item: RegistrySearchResult) {
    setAddingPrefix(item.prefix)
    try {
      await addReferenceOntology({
        prefix: item.prefix,
        name: item.name,
        baseIri: item.baseIri,
        sourceRegistry: item.source,
        sourceId: item.sourceId,
      })
      toast.success(
        `Added "${item.name}" (${item.prefix.toUpperCase()}) to workspace. Indexing terms in background.`
      )
      onAdded()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add ontology."
      )
    } finally {
      setAddingPrefix(null)
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success("Copied to clipboard.")
    setTimeout(() => setCopiedKey(null), 1800)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2.5 overflow-hidden pt-1">
      {/* Registry Filter Pills */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-1">
        <span className="mr-1 text-[11px] font-medium text-muted-foreground">
          Search In:
        </span>
        {REGISTRY_FILTERS.map((filter) => {
          const isSelected = selectedFilter === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSelectedFilter(filter.id)}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/80 bg-muted/30 text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {/* Search Input Form */}
      <form onSubmit={handleSearch} className="flex shrink-0 gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search standard ontologies (e.g. sosa, envo, dwc, qudt, dc, crop)..."
            className="pl-9 text-xs"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isSearching || !query.trim()}
          className="gap-1.5 text-xs font-medium"
        >
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Search
        </Button>
      </form>

      {/* Resilient warning notice if a registry is down */}
      {failedNotice && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{failedNotice}</span>
        </div>
      )}

      {/* Master-Detail 2-Pane Split (35% Left List / 65% Right Detail) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-1 md:flex-row">
        {/* Left Pane (35%): Search Results List */}
        <div className="flex min-h-0 w-full shrink-0 flex-col border-b pb-3 md:w-[35%] md:border-r md:border-b-0 md:pr-3 md:pb-0">
          <ScrollArea className="min-h-0 flex-1 rounded-md border p-2">
            {results.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <Globe className="mb-2 h-7 w-7 opacity-40" />
                <p className="font-medium text-foreground/80">
                  Search across public registries (OLS4, BARTOC, AgroPortal,
                  BioPortal, EU Vocabularies).
                </p>
                <p className="mt-1 text-[11px] opacity-75">
                  Popular standards: SOSA, ENVO, QUDT, DWC.
                </p>
              </div>
            ) : (
              <div
                data-slot="registry-results-list"
                className="space-y-1.5 pr-1"
              >
                {results.map((res) => {
                  const key = `${res.source}-${res.prefix}`
                  const isSelected = selectedResultKey === key
                  const isAdded = existingPrefixes.has(res.prefix.toLowerCase())

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedResultKey(key)}
                      className={`w-full cursor-pointer rounded-md border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                          : "border-border/60 hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {res.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono text-[9px] tracking-wider uppercase"
                        >
                          {res.source.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] uppercase"
                        >
                          {res.prefix}
                        </Badge>
                        {isAdded && (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Added
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Pane (65%): Registry Term / Vocabulary Metadata */}
        <div
          data-slot="registry-detail-pane"
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pr-1 pl-1 md:w-[65%]"
        >
          {selectedResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {selectedResult.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase"
                      >
                        {selectedResult.prefix}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] uppercase"
                      >
                        {selectedResult.source.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Source ID: {selectedResult.sourceId}
                    </p>
                  </div>

                  <div>
                    {existingPrefixes.has(
                      selectedResult.prefix.toLowerCase()
                    ) ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 py-1 text-emerald-600 dark:text-emerald-400"
                      >
                        <Check className="h-3.5 w-3.5" /> Added to Workspace
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={addingPrefix === selectedResult.prefix}
                        onClick={() => handleAdd(selectedResult)}
                        className="gap-1.5 text-xs font-medium"
                      >
                        {addingPrefix === selectedResult.prefix ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Add to Workspace
                      </Button>
                    )}
                  </div>
                </div>

                {/* Base IRI */}
                <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate font-mono text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Base IRI:
                    </span>
                    <span className="truncate">{selectedResult.baseIri}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleCopy(
                          selectedResult.baseIri,
                          `iri-${selectedResult.prefix}`
                        )
                      }
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      title="Copy Base IRI"
                    >
                      {copiedKey === `iri-${selectedResult.prefix}` ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <a
                      href={selectedResult.baseIri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Open Base IRI"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Description */}
                <div className="mt-4 border-t pt-3">
                  <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Description & Scope
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">
                    {selectedResult.description || (
                      <span className="text-muted-foreground italic">
                        No description provided by registry.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <Globe className="mb-2 h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">
                No ontology selected
              </p>
              <p className="mt-1 text-[11px]">
                Search public registries and select an ontology to inspect its
                scope, metadata, and base IRI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
