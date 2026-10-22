"use client"

import type { ProviderConfigStatus } from "@/features/settings/server"
import { ApiKeysSection } from "../api-keys-section/api-keys-section"

interface SettingsShellProps {
  initialStatuses: ProviderConfigStatus[]
}

export function SettingsShell({ initialStatuses }: SettingsShellProps) {
  return (
    <div className="flex-1 space-y-8 p-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-heading tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace credentials, API keys, and external service
          configurations.
        </p>
      </div>

      <div className="space-y-8">
        <ApiKeysSection initialStatuses={initialStatuses} />
      </div>
    </div>
  )
}
