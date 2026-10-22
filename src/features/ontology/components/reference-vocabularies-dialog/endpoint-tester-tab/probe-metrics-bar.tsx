"use client"

import { CheckCircle2, Clock, Globe2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ProbeMetricsBarProps {
  ok: boolean
  statusCode: number
  latencyMs: number
  detectedCount: number
  endpointUrl: string
}

export function ProbeMetricsBar({
  ok,
  statusCode,
  latencyMs,
  detectedCount,
  endpointUrl,
}: ProbeMetricsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 bg-muted/30 text-xs">
      <div className="flex items-center gap-2">
        {ok ? (
          <Badge
            variant="outline"
            className="gap-1 border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400 font-mono text-[11px]"
          >
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
            {statusCode} OK
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-[11px]"
          >
            <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
            {statusCode > 0 ? `HTTP ${statusCode}` : "Offline / Unreachable"}
          </Badge>
        )}

        <div className="flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
          <Clock className="h-3 w-3" />
          <span>{latencyMs} ms</span>
        </div>

        <Badge variant="secondary" className="text-[11px] font-medium">
          {detectedCount} {detectedCount === 1 ? "vocabulary" : "vocabularies"} detected
        </Badge>
      </div>

      <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground truncate max-w-xs">
        <Globe2 className="h-3 w-3 shrink-0" />
        <span className="truncate">{endpointUrl}</span>
      </div>
    </div>
  )
}
