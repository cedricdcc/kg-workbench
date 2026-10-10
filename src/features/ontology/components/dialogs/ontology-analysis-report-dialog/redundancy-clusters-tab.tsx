import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RedundancyCluster } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

interface RedundancyClustersTabProps {
  clusters: RedundancyCluster[]
  onSelectClassForRefactor?: (classId: string) => void
}

export function RedundancyClustersTab({
  clusters,
  onSelectClassForRefactor,
}: RedundancyClustersTabProps) {
  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          No redundancy clusters found
        </p>
        <p className="mt-1 text-xs">
          Your class names appear distinct with no overlapping synonyms
          detected.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-muted-foreground">
        The following classes have high lexical similarity or overlapping
        semantics. Consider merging or refactoring them into a single class.
      </p>

      <div className="space-y-2">
        {clusters.map((cluster, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-card-foreground">
                  {cluster.clusterName}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {Math.round(cluster.similarityScore * 100)}% match
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Classes:</span>
              {cluster.classNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>

            {onSelectClassForRefactor && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectClassForRefactor(cluster.classIds[0])}
                  className="h-7 text-xs"
                >
                  Refactor / Merge Class
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
