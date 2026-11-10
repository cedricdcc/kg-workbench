"use client"

import { Key, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { TabularColumnProfile } from "../../types"
import { formatTypeBadge } from "./formatters"

interface TabularSchemaTabProps {
  columns: TabularColumnProfile[]
}

export function TabularSchemaTab({ columns }: TabularSchemaTabProps) {
  if (columns.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No columns found in dataset.
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 w-full flex-1 overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted/50 text-xs font-medium tracking-wider text-muted-foreground uppercase backdrop-blur-sm">
          <tr>
            <th className="px-4 py-3">Column</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Nulls</th>
            <th className="px-4 py-3">Distinct</th>
            <th className="px-4 py-3">Candidate Key</th>
            <th className="px-4 py-3">Sample Values</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {columns.map((col) => {
            const typeBadge = formatTypeBadge(col.inferredKgType)
            return (
              <tr
                key={col.name}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">
                  {col.name}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={typeBadge.variant}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {typeBadge.label}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({col.duckdbType})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {col.nullCount > 0 ? (
                    <span className="flex items-center gap-1 font-medium text-amber-500">
                      <AlertCircle className="h-3 w-3" />
                      {col.nullPercentage}% ({col.nullCount})
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0%</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                  {col.distinctCount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  {col.isUniqueCandidate ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                    >
                      <Key className="h-2.5 w-2.5" /> Unique
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex max-w-[280px] flex-wrap gap-1">
                    {col.sampleValues.slice(0, 3).map((val, idx) => (
                      <span
                        key={idx}
                        className="max-w-[120px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        title={String(val)}
                      >
                        {String(val)}
                      </span>
                    ))}
                    {col.sampleValues.length > 3 && (
                      <span className="self-center text-[10px] text-muted-foreground">
                        +{col.sampleValues.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
