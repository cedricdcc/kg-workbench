"use client"

import { BookOpen, Globe, Loader2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RecommendedVocabulary } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

interface RecommendedVocabulariesTabProps {
  vocabularies: RecommendedVocabulary[]
  onImportVocabulary?: (vocab: RecommendedVocabulary) => Promise<void>
  importingPrefix?: string | null
  onOpenVocabularies?: () => void
}

export function RecommendedVocabulariesTab({
  vocabularies,
  onImportVocabulary,
  importingPrefix,
  onOpenVocabularies,
}: RecommendedVocabulariesTabProps) {
  if (vocabularies.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <div className="mb-3 rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
          <BookOpen className="h-6 w-6" />
        </div>
        <p className="font-semibold text-foreground">
          All Recommended Standards Already Active
        </p>
        <p className="mt-1 max-w-md text-xs leading-relaxed">
          Your current ontology classes are well-covered by the installed
          reference vocabularies. No additional standard imports required at
          this time.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
        <p>
          Recommended reference ontologies identified by semantic matching
          against standard registries (OLS &amp; LOV).
        </p>
        <span className="font-medium">
          {vocabularies.length} Recommendation(s)
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
        {vocabularies.map((vocab, idx) => {
          const isImporting = importingPrefix === vocab.prefix

          return (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border bg-card p-4.5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-md bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                      <BookOpen className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {vocab.name}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-2">
                        <code className="py-0.2 rounded bg-muted px-1.5 font-mono text-[11px] font-semibold text-muted-foreground">
                          {vocab.prefix}
                        </code>
                        <Badge
                          variant="outline"
                          className="gap-1 font-mono text-[10px] uppercase"
                        >
                          <Globe className="h-3 w-3" />
                          {vocab.suggestedSource}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Badge variant="secondary" className="font-mono text-xs">
                    {vocab.coveredClassCount} class
                    {vocab.coveredClassCount > 1 ? "es" : ""} matched
                  </Badge>
                </div>

                {/* Covered classes */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Covers Local Concepts:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {vocab.coveredClassNames.map((name, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="bg-muted/30 px-2 py-0.5 text-xs font-medium"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Registry: {vocab.suggestedSource.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  {onOpenVocabularies && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onOpenVocabularies}
                      className="h-8 text-xs font-medium text-muted-foreground"
                    >
                      Browse
                    </Button>
                  )}
                  {onImportVocabulary && (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isImporting}
                      onClick={() => onImportVocabulary(vocab)}
                      className="h-8 gap-1.5 text-xs font-medium"
                    >
                      {isImporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {isImporting
                        ? "Importing..."
                        : `Import ${vocab.prefix.toUpperCase()} Directly`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
