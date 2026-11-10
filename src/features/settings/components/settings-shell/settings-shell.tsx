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
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-6 md:p-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace credentials, API keys, and external service
          configurations.
        </p>
      </div>

      {/* prettier-ignore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <ApiKeysSection initialStatuses={initialStatuses} />
        {initialServices.length > 0 && (
          <ServicesSection services={initialServices} />
        )}
      </div>
    </div>
  )
}
