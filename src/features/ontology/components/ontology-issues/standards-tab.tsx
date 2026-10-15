"use client"

import { AlertTriangle, BookOpen, Globe, Loader2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RecommendedVocabulary } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

export interface StandardsTabProps {
  vocabularies?: RecommendedVocabulary[]
  isLoading?: boolean
  error?: Error | null
  onImportVocabulary?: (vocab: RecommendedVocabulary) => Promise<void>
  importingPrefix?: string | null
  onOpenVocabularies?: () => void
}

export function StandardsTab({
  vocabularies = [],
  isLoading = false,
  error = null,
  onImportVocabulary,
  importingPrefix,
  onOpenVocabularies,
}: StandardsTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Loader2 className="mb-3 size-6 animate-spin text-primary" />
        <p className="text-xs font-medium text-foreground">
          Checking standard registries...
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Querying OLS4 &amp; LOV registries for matching standard ontologies.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-xs text-destructive">
        <AlertTriangle className="mb-2 size-6" />
        <p className="font-semibold">
          Failed to load standards recommendations
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {error.message ||
            "An unexpected error occurred while querying registries."}
        </p>
      </div>
    )
  }

  if (vocabularies.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
        <div className="mb-3 rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
          <BookOpen className="size-6" />
        </div>
        <p className="font-semibold text-foreground">
          All Recommended Standards Already Active
        </p>
        <p className="mt-1 max-w-sm text-[11px] leading-relaxed">
          Your current ontology classes are well-covered by the installed
          reference vocabularies. No additional standard imports required at
          this time.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between text-[11px] text-muted-foreground">
        <p>Standards recommended via OLS4 &amp; LOV semantic matching.</p>
        <span className="font-medium">
          {vocabularies.length} Recommendation(s)
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        {vocabularies.map((vocab, idx) => {
          const isImporting = importingPrefix === vocab.prefix

          return (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-border/80"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-sky-500/10 p-1.5 text-sky-600 dark:text-sky-400">
                      <BookOpen className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        {vocab.name}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <code className="py-0.2 rounded bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          {vocab.prefix}
                        </code>
                        <Badge
                          variant="outline"
                          className="gap-0.5 font-mono text-[9px] uppercase"
                        >
                          <Globe className="size-2.5" />
                          {vocab.suggestedSource}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {vocab.coveredClassCount} class
                    {vocab.coveredClassCount > 1 ? "es" : ""} matched
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Covers Local Concepts:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {vocab.coveredClassNames.map((name, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="bg-muted/30 px-2 py-0 text-xs font-medium"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                <span className="text-[10px] text-muted-foreground">
                  Registry: {vocab.suggestedSource.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  {onOpenVocabularies && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onOpenVocabularies}
                      className="h-7 px-2 text-[11px] font-medium text-muted-foreground"
                    >
                      Browse All
                    </Button>
                  )}
                  {onImportVocabulary && (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isImporting}
                      onClick={() => onImportVocabulary(vocab)}
                      className="h-7 gap-1 px-2.5 text-xs font-medium"
                    >
                      {isImporting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Sparkles className="size-3" />
                      )}
                      {isImporting
                        ? "Importing..."
                        : `Import ${vocab.prefix.toUpperCase()}`}
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
