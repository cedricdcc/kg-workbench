"use client"

import * as React from "react"
import { Check, Copy, Server, Terminal } from "lucide-react"
import type { SystemServiceDisplay } from "@/features/settings/server/queries/get-system-services"
import { formatComposeCommand } from "./commands"

export { formatComposeCommand }

interface ServiceCardProps {
  service: SystemServiceDisplay
}

export function ServiceCard({ service }: ServiceCardProps) {
  const [copied, setCopied] = React.useState(false)
  const composeCmd = formatComposeCommand(service.profile)

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(composeCmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const statusColors = {
    online: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    degraded: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    offline: "bg-muted text-muted-foreground border-border",
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-base leading-none">
              {service.displayName}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{service.description}</p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
            statusColors[service.status]
          }`}
        >
          {service.status}
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Capabilities
        </p>
        <div className="flex flex-wrap gap-1.5">
          {service.capabilities.map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground font-mono"
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      {service.status === "offline" && (
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Terminal className="w-3.5 h-3.5" /> Start Service
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors"
              title="Copy docker compose command"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="p-2 rounded bg-muted/60 text-[11px] font-mono text-muted-foreground overflow-x-auto select-all">
            {composeCmd}
          </pre>
        </div>
      )}
    </div>
  )
}
