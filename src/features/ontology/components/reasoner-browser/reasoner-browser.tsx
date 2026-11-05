"use client"

import { useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ReasonerViolationItem } from "./reasoner-violation-item"
import type { ReasonerBrowserProps } from "./types"

export function ReasonerBrowser({
  latestRun,
  isLoading = false,
  onRunReasoner,
  onOpenFullReport,
  onSelectClass,
}: ReasonerBrowserProps) {
  const [entailmentsOpen, setEntailmentsOpen] = useState(false)

  const result = latestRun?.result
  const isConsistent = result ? result.consistent : null
  const violations = result?.violations || []
  const inferredTriples = result?.inferredTriples || []

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header & Run Trigger */}
      <div className="space-y-2.5 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Semantic Reasoner
          </span>
          {onOpenFullReport && result && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onOpenFullReport}
            >
              Full report
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Status Card */}
        {isConsistent === true && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Ontology Consistent</div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                0 logical contradictions found
              </div>
            </div>
          </div>
        )}

        {isConsistent === false && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {violations.length} Violation(s) Found
              </div>
              <div className="text-[10px] text-red-600/80 dark:text-red-400/80">
                Disjointness or domain/range clash
              </div>
            </div>
          </div>
        )}

        {isConsistent === null && (
          <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/30 p-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Not Validated Yet</div>
              <div className="text-[10px]">
                Run reasoner to infer types and check logic
              </div>
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          onClick={onRunReasoner}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running OWL-RL reasoner...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Validate with Reasoner
            </>
          )}
        </Button>
      </div>

      {/* Content list */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {/* Violations section */}
          {violations.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Contradictions ({violations.length})
              </div>
              <div className="space-y-1.5">
                {violations.map((v, i) => (
                  <ReasonerViolationItem
                    key={i}
                    violation={v}
                    onSelectClass={onSelectClass}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inferred triples (entailments) accordion */}
          {inferredTriples.length > 0 && (
            <div className="overflow-hidden rounded-md border text-xs">
              <button
                type="button"
                className="flex w-full items-center justify-between bg-muted/30 p-2 text-left font-medium transition-colors hover:bg-muted/50"
                onClick={() => setEntailmentsOpen(!entailmentsOpen)}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span>Inferred Entailments ({inferredTriples.length})</span>
                </div>
                {entailmentsOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {entailmentsOpen && (
                <div className="max-h-56 divide-y overflow-y-auto bg-background p-1">
                  {inferredTriples.map((t, idx) => (
                    <div
                      key={idx}
                      className="space-y-0.5 p-1.5 font-mono text-[10px]"
                    >
                      <div className="truncate font-semibold text-foreground">
                        {t.subject}
                      </div>
                      <div className="truncate text-[9px] text-blue-600 dark:text-blue-400">
                        {t.predicate}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {t.object}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result &&
            violations.length === 0 &&
            inferredTriples.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No contradictions or new entailments derived.
              </div>
            )}
        </div>
      </ScrollArea>
    </div>
  )
}
