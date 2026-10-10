import { CheckCircle2, Link2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClassAlignment } from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

interface ClassAlignmentMatrixTabProps {
  alignments: ClassAlignment[]
  totalClasses: number
}

export function ClassAlignmentMatrixTab({
  alignments,
  totalClasses,
}: ClassAlignmentMatrixTabProps) {
  if (alignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          No standard alignments mapped yet
        </p>
        <p className="mt-1 text-xs">
          Import standard reference vocabularies (e.g. SOSA, Schema.org) to map
          your ontology classes to industry standards.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <strong>{alignments.length}</strong> aligned of{" "}
          <strong>{totalClasses}</strong> total classes
        </span>
        <Badge variant="outline" className="text-xs">
          {Math.round((alignments.length / totalClasses) * 100)}% coverage
        </Badge>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Local Class</TableHead>
              <TableHead className="w-[45%]">
                Standard Vocabulary Match
              </TableHead>
              <TableHead className="w-[20%] text-right">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alignments.map((a, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{a.className}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <code className="rounded bg-muted px-1 py-0.5 text-xs font-semibold text-foreground">
                      {a.candidateCurie}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      ({a.candidateLabel})
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={a.similarity >= 0.9 ? "default" : "secondary"}
                    className="gap-1 text-[11px]"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {Math.round(a.similarity * 100)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
