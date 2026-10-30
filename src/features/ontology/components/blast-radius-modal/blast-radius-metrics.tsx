import { FileQuestion, GitBranch, Network, TableProperties } from "lucide-react"
import type { BlastRadiusReport } from "../../server/blast-radius/types"

interface BlastRadiusMetricsProps {
  summary: BlastRadiusReport["summary"]
  targetType: "class" | "relation"
}

export function BlastRadiusMetrics({
  summary,
  targetType,
}: BlastRadiusMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileQuestion className="h-3.5 w-3.5" />
          <span>Competency Qs</span>
        </div>
        <p className="mt-1 text-xl font-bold">{summary.affectedCqsCount}</p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TableProperties className="h-3.5 w-3.5" />
          <span>Extracted Facts</span>
        </div>
        <p className="mt-1 text-xl font-bold">{summary.affectedFactsCount}</p>
      </div>

      {targetType === "class" ? (
        <>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Network className="h-3.5 w-3.5" />
              <span>Relations</span>
            </div>
            <p className="mt-1 text-xl font-bold">
              {summary.affectedRelationsCount}
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              <span>Subclasses</span>
            </div>
            <p className="mt-1 text-xl font-bold">
              {summary.affectedSubclassesCount}
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Network className="h-3.5 w-3.5" />
            <span>Attributes</span>
          </div>
          <p className="mt-1 text-xl font-bold">
            {summary.affectedAttributesCount}
          </p>
        </div>
      )}
    </div>
  )
}
