"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BookMarked,
  Check,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  getReferenceOntologies,
  getActiveReferenceTerms,
  type ReferenceOntologySummary,
} from "@/features/ontology/server/queries/reference-vocabularies"
import { SearchInput } from "../shared/search-input"

interface ReferenceBrowserProps {
  onOpenManage: () => void
  selectedTermId?: string | null
  onSelectTerm?: (term: {
    curie: string
    label: string
    iri: string
    type: string
    description: string
  }) => void
}

export function ReferenceBrowser({
  onOpenManage,
  selectedTermId,
  onSelectTerm,
}: ReferenceBrowserProps) {
  const [search, setSearch] = useState("")
  const [selectedOntologyId, setSelectedOntologyId] = useState<string>("all")
  const [copiedCurie, setCopiedCurie] = useState<string | null>(null)

  const { data: vocabularies = [], isLoading: isLoadingVocabs } = useQuery<
    ReferenceOntologySummary[]
  >({
    queryKey: ["reference-ontologies"],
    queryFn: () => getReferenceOntologies(),
  })

  const activeOntologyIds = useMemo(() => {
    if (selectedOntologyId === "all") {
      return vocabularies.map((v) => v.id)
    }
    return [selectedOntologyId]
  }, [vocabularies, selectedOntologyId])

  const { data: terms = [], isLoading: isLoadingTerms } = useQuery({
    queryKey: [
      "reference-terms-browser",
      selectedOntologyId,
      activeOntologyIds,
    ],
    queryFn: () =>
      activeOntologyIds.length > 0
        ? getActiveReferenceTerms(activeOntologyIds)
        : Promise.resolve([]),
    enabled: activeOntologyIds.length > 0,
  })

  const filteredTerms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return terms
    return terms.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.curie.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    )
  }, [terms, search])

  function handleCopy(e: React.MouseEvent, text: string, curie: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedCurie(curie)
    toast.success(`Copied ${curie} to clipboard.`)
    setTimeout(() => setCopiedCurie(null), 1800)
  }

  if (isLoadingVocabs) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header with Search and Manage Button */}
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Standards Catalog
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenManage}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <BookMarked className="h-3.5 w-3.5 text-primary" />
            Manage
          </Button>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter standard terms..."
        />

        {vocabularies.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedOntologyId("all")}
              className={`rounded px-2 py-0.5 font-medium whitespace-nowrap transition-colors ${
                selectedOntologyId === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({vocabularies.length})
            </button>
            {vocabularies.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedOntologyId(v.id)}
                className={`rounded px-2 py-0.5 font-mono font-medium whitespace-nowrap uppercase transition-colors ${
                  selectedOntologyId === v.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.prefix}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Term List */}
      <ScrollArea className="min-h-0 flex-1 p-2">
        {vocabularies.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <Layers className="mb-2 h-8 w-8 opacity-40" />
            <p className="font-medium text-foreground">
              No standards added yet
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add reference ontologies like SOSA or ENVO from OLS4 / LOV to
              navigate standard terms here.
            </p>
            <Button
              size="sm"
              variant="default"
              onClick={onOpenManage}
              className="mt-3 h-7 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Vocabularies
            </Button>
          </div>
        ) : isLoadingTerms ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <p className="font-medium">No matching terms</p>
            <p className="mt-0.5 text-[11px] opacity-75">
              Try a different search keyword.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredTerms.map((term) => {
              const isSelected = selectedTermId === term.id
              const isCopied = copiedCurie === term.curie
              const isClass = term.type.toLowerCase() === "class"

              return (
                <div
                  key={term.id}
                  onClick={() =>
                    onSelectTerm?.({
                      curie: term.curie,
                      label: term.label,
                      iri: term.iri,
                      type: term.type,
                      description: term.description,
                    })
                  }
                  className={`group flex cursor-pointer flex-col gap-1 rounded-md border p-2.5 text-xs transition-colors ${
                    isSelected
                      ? "border-accent-foreground/20 bg-accent text-accent-foreground"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate font-medium text-foreground">
                      {term.label}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge
                        variant={isClass ? "default" : "secondary"}
                        className="h-3.5 px-1 py-0 text-[9px] uppercase"
                      >
                        {term.type}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleCopy(e, term.curie, term.curie)}
                        className="h-5 w-5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-foreground"
                        title="Copy CURIE"
                      >
                        {isCopied ? (
                          <Check className="h-2.5 w-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </Button>
                      <a
                        href={term.iri}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-foreground"
                        title="Open external IRI"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>

                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {term.curie}
                  </div>

                  {term.description && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {term.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
