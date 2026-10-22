import type { ProviderConfigStatus } from "@/features/settings/server"

export interface ApiKeyCardProps {
  status: ProviderConfigStatus
  onStatusChange?: (updated: ProviderConfigStatus) => void
}

export interface ApiKeysSectionProps {
  initialStatuses: ProviderConfigStatus[]
}
