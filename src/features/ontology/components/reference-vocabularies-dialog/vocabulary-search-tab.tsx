"use client"

import { useState } from "react"
import { Globe, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  addReferenceOntology,
  searchExternalRegistries,
} from "@/features/ontology/server/actions/reference-vocabularies"
import type { RegistrySearchResult } from "@/features/ontology/server/services/vocabulary-registries"

interface VocabularySearchTabProps {
  existingPrefixes: Set<string>
  onAdded: () => void
}

export function VocabularySearchTab({
  existingPrefixes,
  onAdded,
}: VocabularySearchTabProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RegistrySearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingPrefix, setAddingPrefix] = useState<string | null>(null)

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setIsSearching(true)
    try {
      const data = await searchExternalRegistries(trimmed)
      setResults(data)
      if (data.length === 0) {
        toast.info("No matching ontologies found in OLS4 or LOV.")
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
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-3 pt-1">
      <form onSubmit={handleSearch} className="flex shrink-0 gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search standard ontologies (e.g. sosa, envo, dwc, qudt, dc)..."
            className="pl-9 text-xs"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isSearching || !query.trim()}
          className="gap-1.5 text-xs"
        >
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Search
        </Button>
      </form>

      <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
        {results.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
            <Globe className="mb-2 h-8 w-8 opacity-40" />
            <p>
              Search public registries (EBI OLS4 and Linked Open Vocabularies).
            </p>
            <p className="text-[11px] opacity-75">
              Popular standards: SOSA (sensors & observations), ENVO
              (environment), QUDT (units), DWC (biodiversity).
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
                        className="text-[9px] tracking-wider uppercase"
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
