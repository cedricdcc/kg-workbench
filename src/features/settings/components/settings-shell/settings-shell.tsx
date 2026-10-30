"use client"

import type { ProviderConfigStatus } from "@/features/settings/server/types"
import type { SystemServiceDisplay } from "@/features/settings/server/queries/get-system-services"
import { ApiKeysSection } from "../api-keys-section/api-keys-section"
import { ServicesSection } from "../services-section/services-section"

interface SettingsShellProps {
  initialStatuses: ProviderConfigStatus[]
  initialServices?: SystemServiceDisplay[]
}

export function SettingsShell({
  initialStatuses,
  initialServices = [],
}: SettingsShellProps) {
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
        {initialServices.length > 0 && (
          <ServicesSection services={initialServices} />
        )}
      </div>
    </div>
  )
}
