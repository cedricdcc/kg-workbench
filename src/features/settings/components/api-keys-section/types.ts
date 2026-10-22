import type { ProviderConfigStatus } from "@/features/settings/server/types"

export interface ApiKeyCardProps {
  status: ProviderConfigStatus
  onStatusChange?: (updated: ProviderConfigStatus) => void
}

export interface ApiKeysSectionProps {
  initialStatuses: ProviderConfigStatus[]
}
