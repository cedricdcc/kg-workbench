import type { Metadata } from "next"

import { SettingsShell } from "@/features/settings/components/settings-shell/settings-shell"
import { getUserApiKeysStatus } from "@/features/settings/server"

export const metadata: Metadata = {
  title: "Settings - KG Workbench",
  description: "Configure workspace settings and API credentials.",
}

export default async function SettingsPage() {
  const initialStatuses = await getUserApiKeysStatus()

  return <SettingsShell initialStatuses={initialStatuses} />
}
