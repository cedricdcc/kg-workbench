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
    <div className="max-h-[400px] overflow-auto rounded-md border border-border">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
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
              <tr key={col.name} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">
                  {col.name}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={typeBadge.variant} className="text-[10px] px-1.5 py-0">
                      {typeBadge.label}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({col.duckdbType})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {col.nullCount > 0 ? (
                    <span className="flex items-center gap-1 text-amber-500 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {col.nullPercentage}% ({col.nullCount})
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0%</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-foreground font-mono">
                  {col.distinctCount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  {col.isUniqueCandidate ? (
                    <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <Key className="h-2.5 w-2.5" /> Unique
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {col.sampleValues.slice(0, 3).map((val, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[120px]"
                        title={String(val)}
                      >
                        {String(val)}
                      </span>
                    ))}
                    {col.sampleValues.length > 3 && (
                      <span className="text-[10px] text-muted-foreground self-center">
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

