import { AlertCircle, Sparkles, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OntologyAssistResult } from "@/features/ontology/hooks/use-ontology-assist"

interface SmartAssistChipProps {
  assist: OntologyAssistResult
  onAdoptSuggestion?: (
    suggestion: NonNullable<OntologyAssistResult["standardSuggestion"]>
  ) => void
  className?: string
}

export function SmartAssistChip({
  assist,
  onAdoptSuggestion,
  className = "",
}: SmartAssistChipProps) {
  if (!assist.hasCollision && !assist.isCycle && !assist.standardSuggestion) {
    return null
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 pt-1 text-xs ${className}`}
    >
      {assist.hasCollision && (
        <Badge
          variant="destructive"
          className="flex items-center gap-1 py-0.5 text-[11px]"
        >
          <AlertCircle className="h-3 w-3" />
          <span>{assist.collisionMessage ?? "Name collision detected"}</span>
        </Badge>
      )}

      {assist.isCycle && (
        <Badge
          variant="destructive"
          className="flex items-center gap-1 py-0.5 text-[11px]"
        >
          <XCircle className="h-3 w-3" />
          <span>{assist.cycleMessage ?? "Hierarchy cycle detected"}</span>
        </Badge>
      )}

      {assist.standardSuggestion && (
        <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
          <Sparkles className="h-3 w-3 text-sky-600 dark:text-sky-400" />
          <span>
            Standard match: <strong>{assist.standardSuggestion.curie}</strong> (
            {assist.standardSuggestion.label})
          </span>
          {onAdoptSuggestion && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAdoptSuggestion(assist.standardSuggestion!)}
              className="h-4 px-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-200/60 hover:text-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
            >
              Adopt
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
