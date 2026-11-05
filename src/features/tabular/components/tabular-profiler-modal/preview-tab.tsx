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
    <div className="max-h-[400px] overflow-auto rounded-md border border-border">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-muted/50 font-medium text-muted-foreground uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
          <tr>
            <th className="px-3 py-2 text-center text-[10px] w-12 text-muted-foreground/60 border-r border-border">
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
            <tr key={idx} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground/60 bg-muted/10 border-r border-border">
                {idx + 1}
              </td>
              {colNames.map((name) => {
                const val = row[name]
                return (
                  <td
                    key={name}
                    className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate text-foreground"
                    title={val !== null && val !== undefined ? String(val) : "NULL"}
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

