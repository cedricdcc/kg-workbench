import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ReasonerJobViolation } from "../../server/actions/run-ontology-reasoning"
import { formatViolationBadge } from "./formatters"

export { formatViolationBadge }

interface ReasonerViolationsTabProps {
  violations: ReasonerJobViolation[]
}

export function ReasonerViolationsTab({
  violations,
}: ReasonerViolationsTabProps) {
  if (violations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
        No semantic violations detected. All classes, relations, and instance
        shapes conform.
      </div>
    )
  }

  return (
    <div
      data-slot="shacl-violations-table"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border"
    >
      <div className="flex-1 overflow-auto">
        <Table className="w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs">
            <TableRow>
              <TableHead className="w-[120px] font-semibold">
                Severity
              </TableHead>
              <TableHead className="w-[220px] font-semibold">
                Constraint / Source
              </TableHead>
              <TableHead className="w-[260px] font-semibold">
                Focus Node
              </TableHead>
              <TableHead className="font-semibold">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {violations.map((v, idx) => {
              const badge = formatViolationBadge(v.severity)
              return (
                <TableRow key={idx} className="hover:bg-muted/30">
                  <TableCell className="align-top font-medium">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs break-all text-muted-foreground">
                    {v.source}
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs break-all text-foreground">
                    {v.focusNode || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-xs leading-relaxed text-foreground">
                    {v.message}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
