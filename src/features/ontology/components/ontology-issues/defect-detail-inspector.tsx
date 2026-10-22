"use client"

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Info,
  Layers,
  RotateCcw,
  ShieldCheck,
  VolumeX,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OntologyDefect } from "@/features/ontology/utils/linter"

export interface DefectDetailInspectorProps {
  defect: OntologyDefect | null
  isSuppressed?: boolean
  onSelectEntity: (id: string, kind: "class" | "relation") => void
  onSuppress: (defectId: string) => void
  onRestore: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
}

const OOPS_DESCRIPTIONS: Record<string, string> = {
  P29: "Recursive hierarchical loops (subclass cycles) violate the acyclic requirement of OWL Description Logics, forcing reasoners to mark participating concepts as owl:Nothing or crash.",
  P10: "Relationships targeting undefined domain or range entities create dangling pointers in RDF/Turtle knowledge graphs, breaking SPARQL graph path traversal.",
  P04: "Disconnected classes without hierarchy or relationship connections are isolated nodes that provide minimal semantic value.",
  P24: "Near-identical or case-divergent entity names cause lexical confusion, redundant concept proliferation, and mapping ambiguities.",
  P11: "Mismatched domain and range constraints between an original relation and its declared inverse property break bidirectional logic inference.",
  P08: "Missing human-readable descriptions hinder ontology reuse, FAIR compliance, and collaborative documentation.",
}

export function DefectDetailInspector({
  defect,
  isSuppressed = false,
  onSelectEntity,
  onSuppress,
  onRestore,
  onQuickFix,
}: DefectDetailInspectorProps) {
  if (!defect) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <ShieldCheck className="mb-3 size-10 text-emerald-500" />
        <h4 className="text-sm font-semibold text-foreground">
          No Defect Selected
        </h4>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Select an issue from the defect list on the left to inspect detailed
          diagnostics and execute quick fixes.
        </p>
      </div>
    )
  }

  const isError = defect.severity === "error"
  const isWarning = defect.severity === "warning"
  const oopsDescription =
    defect.oopsPitfallId && OOPS_DESCRIPTIONS[defect.oopsPitfallId]

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto pr-1">
      {/* Header Banner */}
      <div
        className={`rounded-xl border p-4 transition-colors ${
          isSuppressed
            ? "border-dashed bg-muted/20"
            : isError
              ? "border-destructive/30 bg-destructive/5"
              : isWarning
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-sky-500/30 bg-sky-500/5"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={`mt-0.5 rounded-lg p-2 ${
                isError
                  ? "bg-destructive/10 text-destructive"
                  : isWarning
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
              }`}
            >
              {isError ? (
                <AlertCircle className="size-5" />
              ) : isWarning ? (
                <AlertTriangle className="size-5" />
              ) : (
                <Info className="size-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold uppercase ${
                    isError
                      ? "border-destructive/30 text-destructive"
                      : isWarning
                        ? "border-amber-500/30 text-amber-700 dark:text-amber-300"
                        : "border-sky-500/30 text-sky-700 dark:text-sky-300"
                  }`}
                >
                  {defect.severity}
                </Badge>
                {defect.oopsPitfallId && (
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs font-semibold text-muted-foreground"
                  >
                    OOPS! {defect.oopsPitfallId}
                  </Badge>
                )}
              </div>
              <h3 className="mt-1.5 text-base font-semibold text-foreground">
                {defect.title}
              </h3>
            </div>
          </div>

          <div>
            {isSuppressed ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onRestore(defect.id)}
              >
                <RotateCcw className="size-3.5" />
                Restore Defect
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onSuppress(defect.id)}
              >
                <VolumeX className="size-3.5" />
                Mute Defect
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Target Entity Card */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Affected Entity
        </h4>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-background p-1.5 shadow-xs">
              {defect.targetType === "class" ? (
                <Layers className="size-4 text-primary" />
              ) : (
                <ArrowRight className="size-4 text-primary" />
              )}
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">
                {defect.targetName}
              </p>
              <div className="flex items-center gap-2">
                <code className="text-[10px] text-muted-foreground">
                  ID: {defect.targetId}
                </code>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {defect.targetType}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-medium"
            onClick={() => onSelectEntity(defect.targetId, defect.targetType)}
          >
            <ExternalLink className="size-3.5" />
            Inspect in Graph / Detail
          </Button>
        </div>
      </div>

      {/* Diagnosis & Rule Background */}
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
        <div>
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Defect Explanation
          </h4>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground">
            {defect.description}
          </p>
        </div>

        {oopsDescription && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <h5 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckCircle2 className="size-3.5 text-primary" />
              Why this rule exists (OOPS! Pitfall Reference)
            </h5>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {oopsDescription}
            </p>
          </div>
        )}
      </div>

      {/* Remediation & Quick-Fix Actions */}
      {defect.quickFixType && onQuickFix && !isSuppressed && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="size-4 text-primary" />
                <h4 className="text-xs font-semibold tracking-wider text-primary uppercase">
                  1-Click Remediation
                </h4>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Apply automated repair to resolve this defect instantly without
                manual editing.
              </p>
            </div>

            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => onQuickFix(defect)}
            >
              <Wrench className="size-3.5" />
              {defect.suggestedAction ?? "Apply Quick Fix"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
