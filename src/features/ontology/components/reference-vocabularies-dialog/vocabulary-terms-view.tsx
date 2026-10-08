"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Search,
  Tag,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  getReferenceOntologyTerms,
  type ReferenceOntologySummary,
  type ReferenceOntologyTermItem,
} from "@/features/ontology/server/queries/reference-vocabularies"

interface VocabularyTermsViewProps {
  vocabulary: ReferenceOntologySummary
  onBack: () => void
}

export function VocabularyTermsView({
  vocabulary,
  onBack,
}: VocabularyTermsViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const { data: terms = [], isLoading } = useQuery<ReferenceOntologyTermItem[]>(
    {
      queryKey: ["reference-ontology-terms", vocabulary.id],
      queryFn: () => getReferenceOntologyTerms(vocabulary.id),
    }
  )

  const filteredTerms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return terms.filter((term) => {
      if (
        typeFilter !== "all" &&
        term.type.toLowerCase() !== typeFilter.toLowerCase()
      ) {
        return false
      }
      if (!q) return true
      return (
        term.label.toLowerCase().includes(q) ||
        term.curie.toLowerCase().includes(q) ||
        term.description.toLowerCase().includes(q)
      )
    })
  }, [terms, searchQuery, typeFilter])

  const classCount = useMemo(
    () => terms.filter((t) => t.type.toLowerCase() === "class").length,
    [terms]
  )
  const propertyCount = useMemo(
    () => terms.filter((t) => t.type.toLowerCase() === "property").length,
    [terms]
  )

  function handleCopy(text: string, key: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`Copied ${label} to clipboard.`)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2.5 overflow-hidden pt-1">
      {/* Header & Back Button */}
      <div className="flex shrink-0 items-center justify-between border-b pb-2.5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-1 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {vocabulary.name}
            </span>
            <Badge
              variant="outline"
              className="font-mono text-[10px] uppercase"
            >
              {vocabulary.prefix}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {terms.length} terms indexed
            </Badge>
          </div>
        </div>

        <a
          href={vocabulary.baseIri}
          target="_blank"
          rel="noopener noreferrer"
          className="flex max-w-xs items-center gap-1 truncate font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
        >
          <span className="truncate">{vocabulary.baseIri}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>

      {/* Search and Filters */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${terms.length} terms in ${vocabulary.prefix.toUpperCase()} (e.g. label, CURIE)...`}
            className="h-8 pr-7 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              typeFilter === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({terms.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("class")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              typeFilter === "class"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Classes ({classCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("property")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              typeFilter === "property"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Properties ({propertyCount})
          </button>
        </div>
      </div>

      {/* Scrollable Term List */}
      <ScrollArea className="min-h-0 flex-1 rounded-md border p-2.5">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <Search className="mb-2 h-7 w-7 opacity-35" />
            <p className="font-medium">No matching terms found.</p>
            {searchQuery && (
              <p className="mt-1 text-[11px] opacity-75">
                Try a different keyword or switch the type filter.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTerms.map((term) => {
              const isClass = term.type.toLowerCase() === "class"
              const curieCopied = copiedKey === `curie-${term.id}`
              const iriCopied = copiedKey === `iri-${term.id}`

              return (
                <div
                  key={term.id}
                  className="group flex flex-col gap-1 rounded-md border p-2.5 transition-colors hover:border-primary/20 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold tracking-tight text-foreground">
                        {term.label}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-4 bg-muted/50 px-1.5 py-0 font-mono text-[10px] font-medium"
                      >
                        {term.curie}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          isClass
                            ? "h-4 border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[9px] font-medium tracking-wide text-sky-600 uppercase dark:text-sky-400"
                            : "h-4 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-medium tracking-wide text-amber-600 uppercase dark:text-amber-400"
                        }
                      >
                        {term.type}
                      </Badge>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          handleCopy(term.curie, `curie-${term.id}`, term.curie)
                        }
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Copy CURIE"
                      >
                        {curieCopied ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          handleCopy(term.iri, `iri-${term.id}`, "IRI")
                        }
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Copy Full IRI"
                      >
                        {iriCopied ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Link2 className="h-3 w-3" />
                        )}
                      </Button>
                      <a
                        href={term.iri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Open external IRI"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {term.description && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {term.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="max-w-md truncate font-mono text-[10px] text-muted-foreground/75">
                      {term.iri}
                    </span>

                    {term.synonyms.length > 0 && (
                      <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/80">
                        <Tag className="h-2.5 w-2.5 opacity-60" />
                        <span>
                          {term.synonyms.slice(0, 3).join(", ")}
                          {term.synonyms.length > 3 &&
                            ` +${term.synonyms.length - 3}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
