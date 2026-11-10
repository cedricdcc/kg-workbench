"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Layers,
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
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
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

  const selectedTerm = useMemo(() => {
    if (selectedTermId) {
      const found = filteredTerms.find((t) => t.id === selectedTermId)
      if (found) return found
    }
    return filteredTerms[0] ?? null
  }, [filteredTerms, selectedTermId])

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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden pt-1">
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

      {/* Master-Detail 2-Pane Split Layout (35% Left / 65% Right) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-3 md:flex-row">
        {/* Left Pane (35%): Search, Filters, and Term List */}
        <div className="flex min-h-0 w-full shrink-0 flex-col border-b pb-3 md:w-[35%] md:border-r md:border-b-0 md:pr-3 md:pb-0">
          {/* Search Input */}
          <div className="relative mb-2 shrink-0">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${terms.length} terms...`}
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

          {/* Filter Pills */}
          <div className="mb-2 flex shrink-0 items-center gap-1 rounded-lg border bg-muted/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
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
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
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
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                typeFilter === "property"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Props ({propertyCount})
            </button>
          </div>

          {/* Scrollable Term List */}
          <ScrollArea className="min-h-0 flex-1 rounded-md border p-1.5">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTerms.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground">
                <Search className="mb-2 h-6 w-6 opacity-35" />
                <p className="font-medium">No matching terms.</p>
                {searchQuery && (
                  <p className="mt-1 text-[11px] opacity-75">
                    Try different keywords.
                  </p>
                )}
              </div>
            ) : (
              <div
                data-slot="vocabulary-term-list"
                className="space-y-1.5 pr-1"
              >
                {filteredTerms.map((term) => {
                  const isSelected = selectedTerm?.id === term.id
                  const isClass = term.type.toLowerCase() === "class"

                  return (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => setSelectedTermId(term.id)}
                      className={`w-full cursor-pointer rounded-md border p-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                          : "border-border/60 hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {term.label}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            isClass
                              ? "h-4 border-sky-500/30 bg-sky-500/10 px-1 py-0 text-[9px] font-medium text-sky-600 uppercase dark:text-sky-400"
                              : "h-4 border-amber-500/30 bg-amber-500/10 px-1 py-0 text-[9px] font-medium text-amber-600 uppercase dark:text-amber-400"
                          }
                        >
                          {term.type}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {term.curie}
                        </span>
                        {term.parentIris && term.parentIris.length > 0 && (
                          <span className="text-[9px] text-muted-foreground">
                            {term.parentIris.length} parent
                            {term.parentIris.length > 1 ? "s" : ""}
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

        {/* Right Pane (65%): Metadata, Description, Parent IRIs, and Actions */}
        <div
          data-slot="term-detail-pane"
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pr-1 pl-1 md:w-[65%]"
        >
          {selectedTerm ? (
            <div className="space-y-4">
              {/* Term Header Card */}
              <div className="rounded-lg border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {selectedTerm.label}
                      </h3>
                      <Badge
                        variant="outline"
                        className={
                          selectedTerm.type.toLowerCase() === "class"
                            ? "border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-600 uppercase dark:text-sky-400"
                            : "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 uppercase dark:text-amber-400"
                        }
                      >
                        {selectedTerm.type}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      CURIE: {selectedTerm.curie}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleCopy(
                          selectedTerm.curie,
                          `curie-${selectedTerm.id}`,
                          "CURIE"
                        )
                      }
                      className="h-7 gap-1 px-2 text-xs"
                      title="Copy CURIE"
                    >
                      {copiedKey === `curie-${selectedTerm.id}` ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copy CURIE
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleCopy(
                          selectedTerm.iri,
                          `iri-${selectedTerm.id}`,
                          "Full IRI"
                        )
                      }
                      className="h-7 gap-1 px-2 text-xs"
                      title="Copy Full IRI"
                    >
                      {copiedKey === `iri-${selectedTerm.id}` ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Link2 className="h-3 w-3" />
                      )}
                      Copy IRI
                    </Button>
                    <a
                      href={selectedTerm.iri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Open external IRI"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </div>
                </div>

                {/* Description */}
                <div className="mt-3 border-t pt-3">
                  <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Description
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">
                    {selectedTerm.description || (
                      <span className="text-muted-foreground italic">
                        No description provided for this term.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Parent IRIs Inspection Card */}
              <div
                data-slot="parent-iris-panel"
                className="rounded-lg border bg-card p-4 shadow-xs"
              >
                <div className="mb-2 flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>
                      Parent IRIs & Taxonomy (
                      {selectedTerm.parentIris?.length || 0})
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedTerm.parentIris?.length || 0} Parents
                  </Badge>
                </div>

                {selectedTerm.parentIris &&
                selectedTerm.parentIris.length > 0 ? (
                  <ul className="space-y-1.5 text-xs">
                    {selectedTerm.parentIris.map((parentIri, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        <span className="truncate pr-2 text-foreground">
                          {parentIri}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              handleCopy(
                                parentIri,
                                `parent-${idx}`,
                                "Parent IRI"
                              )
                            }
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Copy Parent IRI"
                          >
                            {copiedKey === `parent-${idx}` ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <a
                            href={parentIri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Open Parent IRI"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-2 text-xs text-muted-foreground italic">
                    Root level term or no explicit parent IRIs defined in this
                    ontology.
                  </p>
                )}
              </div>

              {/* Related Properties & Synonyms */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Related Properties */}
                <div className="rounded-lg border bg-card p-3 shadow-xs">
                  <h4 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Related Properties (
                    {selectedTerm.relatedPropertyIris?.length || 0})
                  </h4>
                  {selectedTerm.relatedPropertyIris &&
                  selectedTerm.relatedPropertyIris.length > 0 ? (
                    <ul className="space-y-1 text-xs">
                      {selectedTerm.relatedPropertyIris.map((propIri, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-2 py-1 font-mono text-[10px]"
                        >
                          <span className="truncate pr-1 text-foreground">
                            {propIri}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              handleCopy(
                                propIri,
                                `relprop-${idx}`,
                                "Property IRI"
                              )
                            }
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-2 text-xs text-muted-foreground italic">
                      No related properties registered.
                    </p>
                  )}
                </div>

                {/* Synonyms */}
                <div className="rounded-lg border bg-card p-3 shadow-xs">
                  <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    <Tag className="h-3 w-3" />
                    <span>Synonyms ({selectedTerm.synonyms?.length || 0})</span>
                  </h4>
                  {selectedTerm.synonyms && selectedTerm.synonyms.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTerm.synonyms.map((syn, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-[11px]"
                        >
                          {syn}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-xs text-muted-foreground italic">
                      No alternate labels or synonyms.
                    </p>
                  )}
                </div>
              </div>

              {/* Technical Grounding Box */}
              <div className="space-y-1 rounded-lg border bg-muted/30 p-3 font-mono text-[11px] text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">
                    Full IRI:
                  </span>{" "}
                  {selectedTerm.iri}
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    Internal ID:
                  </span>{" "}
                  {selectedTerm.id}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <Layers className="mb-2 h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">No term selected</p>
              <p className="mt-1 text-[11px]">
                Select a term from the list on the left to inspect its complete
                metadata, taxonomy, and parent IRIs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
