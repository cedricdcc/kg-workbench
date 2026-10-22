"use client"

import { useState } from "react"

import { ApiKeyCard } from "./api-key-card"
import type { ApiKeysSectionProps } from "./types"

export function ApiKeysSection({ initialStatuses }: ApiKeysSectionProps) {
  const [statuses, setStatuses] = useState(initialStatuses)

  const handleStatusChange = (index: number, updated: (typeof statuses)[0]) => {
    setStatuses((prev) => {
      const copy = [...prev]
      copy[index] = updated
      return copy
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium font-heading">
          AI Services & API Keys
        </h2>
        <p className="text-xs text-muted-foreground">
          Configure API credentials used across ontology generation and
          knowledge extraction workflows.
        </p>
      </div>

      <div className="grid gap-4">
        {statuses.map((status, index) => (
          <ApiKeyCard
            key={status.provider}
            status={status}
            onStatusChange={(updated) => handleStatusChange(index, updated)}
          />
        ))}
      </div>
    </div>
  )
}
