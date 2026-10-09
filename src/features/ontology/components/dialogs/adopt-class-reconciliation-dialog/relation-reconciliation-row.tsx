"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, ArrowRight, Sparkles, Trash2, CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { findNearestStandardTerms } from "@/features/ontology/server/actions/reference-vocabularies"
import type { RelationRowProps } from "./types"

export function RelationReconciliationRow({
  item,
  currentClassName,
  decision,
  onChangeDecision,
  aiSuggestion,
  onApplyAiSuggestion,
}: RelationRowProps) {
  const { data: propertyCandidates = [] } = useQuery({
    queryKey: ["property-candidates", item.relation.name],
    queryFn: () => findNearestStandardTerms(item.relation.name, "property", 5),
    staleTime: 60000,
  })

  const isIncoming = item.direction === "incoming"

  return (
    <div
      className={`rounded-lg border p-3.5 space-y-3 transition-colors ${
        decision.action === "delete"
          ? "border-destructive/30 bg-destructive/5"
          : decision.action === "remap"
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={isIncoming ? "secondary" : "outline"}
            className="text-[11px] font-medium"
          >
            {isIncoming ? (
              <span className="flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                Incoming: {item.otherClassName} ➔ {currentClassName}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Outgoing: {currentClassName} ➔ {item.otherClassName}
                <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </Badge>
          <span className="font-mono text-sm font-semibold text-foreground">
            {item.relation.name}
          </span>
        </div>

        {/* 3-way Action Selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          <Button
            type="button"
            size="sm"
            variant={decision.action === "keep" ? "default" : "ghost"}
            className="h-7 text-xs px-2.5"
            onClick={() =>
              onChangeDecision({
                relationId: item.relation.id,
                action: "keep",
              })
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Keep
          </Button>

          <Button
            type="button"
            size="sm"
            variant={decision.action === "remap" ? "default" : "ghost"}
            className="h-7 text-xs px-2.5"
            onClick={() => {
              const defaultRemap =
                propertyCandidates[0]?.curie || decision.remappedName || item.relation.name
              onChangeDecision({
                relationId: item.relation.id,
                action: "remap",
                remappedName: defaultRemap,
              })
            }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
            Remap
          </Button>

          <Button
            type="button"
            size="sm"
            variant={decision.action === "delete" ? "destructive" : "ghost"}
            className="h-7 text-xs px-2.5"
            onClick={() =>
              onChangeDecision({
                relationId: item.relation.id,
                action: "delete",
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {item.relation.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 italic">
          {item.relation.description}
        </p>
      )}

      {/* Remap Controls */}
      {decision.action === "remap" && (
        <div className="rounded-md border bg-background/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Select standard property or enter custom term:
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {propertyCandidates.length > 0 && (
              <Select
                value={decision.remappedName || ""}
                onValueChange={(val) =>
                  onChangeDecision({
                    ...decision,
                    remappedName: val,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Standard property matches..." />
                </SelectTrigger>
                <SelectContent>
                  {propertyCandidates.map((cand) => (
                    <SelectItem key={cand.curie} value={cand.curie} className="text-xs">
                      <span className="font-mono font-medium">{cand.curie}</span>
                      {cand.label ? ` (${cand.label})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Input
              value={decision.remappedName || ""}
              onChange={(e) =>
                onChangeDecision({
                  ...decision,
                  remappedName: e.target.value,
                })
              }
              placeholder="e.g. sosa:observedProperty"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* AI Rationale / Suggestion Badge */}
      {aiSuggestion && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
          <div className="flex items-start gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-primary">
                AI Suggests: {aiSuggestion.suggestedAction.toUpperCase()}
                {aiSuggestion.suggestedName ? ` ➔ ${aiSuggestion.suggestedName}` : ""}
              </span>
              <p className="text-muted-foreground mt-0.5">{aiSuggestion.rationale}</p>
            </div>
          </div>

          {onApplyAiSuggestion &&
            (decision.action !== aiSuggestion.suggestedAction ||
              (aiSuggestion.suggestedAction === "remap" &&
                decision.remappedName !== aiSuggestion.suggestedName)) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                onClick={onApplyAiSuggestion}
              >
                Apply
              </Button>
            )}
        </div>
      )}
    </div>
  )
}
