"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
} from "lucide-react"

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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const { data: propertyCandidates = [] } = useQuery({
    queryKey: ["property-candidates", item.relation.name],
    queryFn: () => findNearestStandardTerms(item.relation.name, "property", 5),
    staleTime: 60000,
  })

  const isIncoming = item.direction === "incoming"
  const isRemap = decision.action === "remap"

  return (
    <div
      className={`rounded-lg border p-3 space-y-2.5 transition-all text-xs ${
        decision.action === "delete"
          ? "border-destructive/30 bg-destructive/5"
          : decision.action === "remap"
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-border/80"
      }`}
    >
      {/* Main Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge
            variant={isIncoming ? "secondary" : "outline"}
            className="text-[10px] font-medium px-1.5 py-0.5 truncate shrink-0"
          >
            {isIncoming ? (
              <span className="flex items-center gap-1">
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                {item.otherClassName} ➔ {currentClassName}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                {currentClassName} ➔ {item.otherClassName}
              </span>
            )}
          </Badge>
          <span className="font-mono text-xs font-semibold text-foreground truncate" title={item.relation.name}>
            {item.relation.name}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md shrink-0">
          <Button
            type="button"
            size="sm"
            variant={decision.action === "keep" ? "default" : "ghost"}
            className="h-6 text-[11px] px-2"
            onClick={() =>
              onChangeDecision({
                relationId: item.relation.id,
                action: "keep",
              })
            }
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Keep
          </Button>

          <Button
            type="button"
            size="sm"
            variant={decision.action === "remap" ? "default" : "ghost"}
            className="h-6 text-[11px] px-2"
            onClick={() => {
              const defaultRemap =
                propertyCandidates[0]?.curie || decision.remappedName || item.relation.name
              onChangeDecision({
                relationId: item.relation.id,
                action: "remap",
                remappedName: defaultRemap,
              })
              setIsDetailsOpen(true)
            }}
          >
            <ArrowLeftRight className="h-3 w-3 mr-1" />
            Remap
          </Button>

          <Button
            type="button"
            size="sm"
            variant={decision.action === "delete" ? "destructive" : "ghost"}
            className="h-6 text-[11px] px-2"
            onClick={() =>
              onChangeDecision({
                relationId: item.relation.id,
                action: "delete",
              })
            }
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Remap Active Summary or Input */}
      {isRemap && (
        <div className="rounded-md border bg-background/90 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-foreground">Remap to reference property:</span>
            <span className="text-muted-foreground font-mono text-[10px]">
              {decision.remappedName ? `➔ ${decision.remappedName}` : "Select target"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
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
                <SelectTrigger className="h-7 text-xs font-mono">
                  <SelectValue placeholder="Select standard property..." />
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
              placeholder="Or type standard CURIE (e.g. sosa:observedProperty)"
              className="h-7 text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* AI Suggestion Banner */}
      {aiSuggestion && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 p-2 text-[11px]">
          <div className="flex items-start gap-1.5 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold text-primary">
                AI Suggests: {aiSuggestion.suggestedAction.toUpperCase()}
                {aiSuggestion.suggestedName ? ` ➔ ${aiSuggestion.suggestedName}` : ""}
              </span>
              <p className="text-muted-foreground mt-0.5 line-clamp-2">{aiSuggestion.rationale}</p>
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
                className="h-5 text-[10px] px-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                onClick={onApplyAiSuggestion}
              >
                Apply
              </Button>
            )}
        </div>
      )}

      {/* Collapsible Details (description) */}
      {item.relation.description && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {isDetailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>{isDetailsOpen ? "Hide relation description" : "View relation description"}</span>
          </button>
          {isDetailsOpen && (
            <p className="mt-1 text-[11px] text-muted-foreground italic bg-muted/20 rounded p-1.5">
              {item.relation.description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
