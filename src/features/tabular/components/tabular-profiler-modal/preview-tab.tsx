"use client"

interface TabularPreviewTabProps {
  rows: Record<string, unknown>[]
  columns: Array<{ name: string }>
}

export function TabularPreviewTab({ rows, columns }: TabularPreviewTabProps) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No preview rows available.
      </div>
    )
  }

  const colNames = columns.map((c) => c.name)

  return (
    <div className="h-full min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-muted/50 font-medium tracking-wider text-muted-foreground uppercase backdrop-blur-sm">
          <tr>
            <th className="w-12 border-r border-border px-3 py-2 text-center text-[10px] text-muted-foreground/60">
              #
            </th>
            {colNames.map((name) => (
              <th key={name} className="px-3 py-2 font-mono whitespace-nowrap">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {rows.map((row, idx) => (
            <tr key={idx} className="transition-colors hover:bg-muted/30">
              <td className="border-r border-border bg-muted/10 px-3 py-1.5 text-center text-[10px] text-muted-foreground/60">
                {idx + 1}
              </td>
              {colNames.map((name) => {
                const val = row[name]
                return (
                  <td
                    key={name}
                    className="max-w-[200px] truncate px-3 py-1.5 whitespace-nowrap text-foreground"
                    title={
                      val !== null && val !== undefined ? String(val) : "NULL"
                    }
                  >
                    {val === null || val === undefined ? (
                      <span className="text-muted-foreground italic">null</span>
                    ) : (
                      String(val)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
