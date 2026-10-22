"use client"

import { useState } from "react"
import { AlertCircle, Globe, Loader2, Plus, Search } from "lucide-react"
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

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setIsSearching(true)
    setFailedNotice(null)

    try {
      const enabledProviderIds =
        selectedFilter === "all"
          ? ["ols4", "bartoc", "agroportal", "bioportal", "eu_vocabularies", "lov"]
          : [selectedFilter]

      const data = await searchAllRegistries(trimmed, {
        enabledProviderIds,
        timeoutMs: 4000,
      })

      setResults(data.results)

      if (data.failedProviders.length > 0) {
        const failedNames = data.failedProviders.map((f) => f.providerId.toUpperCase()).join(", ")
        setFailedNotice(`Could not reach ${failedNames}. Showing available results.`)
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2.5 pt-1">
      {/* Registry Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">
          Search In:
        </span>
        {REGISTRY_FILTERS.map((filter) => {
          const isSelected = selectedFilter === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 hover:bg-muted/70 text-muted-foreground border-border/80"
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
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{failedNotice}</span>
        </div>
      )}

      {/* Results ScrollArea */}
      <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
        {results.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
            <Globe className="mb-2 h-8 w-8 opacity-40" />
            <p className="font-medium text-foreground/80">
              Search across multiple public registries (OLS4, BARTOC, AgroPortal, BioPortal, EU Vocabularies).
            </p>
            <p className="text-[11px] opacity-75 mt-1">
              Popular standards: SOSA (sensors & observations), ENVO (environment), QUDT (units), DWC (biodiversity).
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((res) => {
              const isAdded = existingPrefixes.has(res.prefix.toLowerCase())
              const isAdding = addingPrefix === res.prefix

              return (
                <div
                  key={`${res.source}-${res.prefix}`}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {res.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase"
                      >
                        {res.prefix}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-[9px] tracking-wider uppercase font-mono"
                      >
                        {res.source.toUpperCase()}
                      </Badge>
                    </div>
                    {res.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {res.description}
                      </p>
                    )}
                    <div className="truncate font-mono text-[10px] text-muted-foreground/80">
                      {res.baseIri}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isAdded ? "secondary" : "default"}
                    disabled={isAdded || isAdding}
                    onClick={() => handleAdd(res)}
                    className="shrink-0 gap-1 text-xs"
                  >
                    {isAdding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isAdded ? (
                      "Added"
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Add
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
  )
}
