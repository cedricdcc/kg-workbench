import type { InferredTriple } from "../../server/actions/run-ontology-reasoning"

interface ReasonerEntailmentsTabProps {
  inferredTriples: InferredTriple[]
}

export function ReasonerEntailmentsTab({
  inferredTriples,
}: ReasonerEntailmentsTabProps) {
  if (inferredTriples.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
        No new entailments inferred. The ontology is fully explicit or minimal.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      {inferredTriples.map((t, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="font-semibold text-primary">{t.subject}</span>
            <span className="text-muted-foreground">{t.predicate}</span>
            <span className="font-semibold text-primary">{t.object}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t.derivation}</p>
        </div>
      ))}
    </div>
  )
}
