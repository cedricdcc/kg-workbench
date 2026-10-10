import { BookOpen, Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RecommendedVocabulary } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

interface RecommendedVocabulariesTabProps {
  vocabularies: RecommendedVocabulary[]
  onOpenVocabularies?: () => void
}

export function RecommendedVocabulariesTab({
  vocabularies,
  onOpenVocabularies,
}: RecommendedVocabulariesTabProps) {
  if (vocabularies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          All recommended standards imported
        </p>
        <p className="mt-1 text-xs">
          Your ontology appears well covered by current reference vocabularies.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-muted-foreground">
        Based on your class names, these standard ontologies would provide the
        highest reuse and interoperability.
      </p>

      <div className="space-y-2.5">
        {vocabularies.map((vocab, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-medium text-card-foreground">
                  {vocab.name}
                </span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {vocab.prefix}
                </code>
              </div>
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Globe className="h-3 w-3" />
                {vocab.suggestedSource.toUpperCase()}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-xs text-muted-foreground">
                Matches {vocab.coveredClassCount} classes:
              </span>
              {vocab.coveredClassNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">
                  {name}
                </Badge>
              ))}
            </div>

            {onOpenVocabularies && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenVocabularies}
                  className="h-7 text-xs"
                >
                  Import {vocab.prefix.toUpperCase()} from Registries
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
