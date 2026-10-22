---
feature: settings
status: active
purpose: Manage application-wide credentials, external AI provider API keys, and workspace preferences.
scope:
  - user API key configuration (Gemini)
  - encrypted credential storage and masked hints
  - live API connection testing
  - environment variable fallback inspection
entry_points:
  - path: src/app/(app)/settings/page.tsx
    purpose: Server route loading initial provider statuses and rendering SettingsShell.
  - path: src/features/settings/components/settings-shell/settings-shell.tsx
    purpose: Client shell container coordinating settings sections and notifications.
server_entry_points:
  - path: src/features/settings/server/queries/get-api-keys-status.ts
    purpose: Resolves provider configuration statuses without leaking secrets.
  - path: src/features/settings/server/actions/
    purpose: Server actions for testing, saving (AES-GCM encryption), and deleting user keys.
update_this_readme_when:
  - new settings categories or providers are added
  - credential storage or identity resolution changes
---

# Settings

## Domain Concepts

- `anonymous client identity`: persistent UUID v4 cookie (`kg-workbench-user-id`) scoping credentials to a user's browser.
- `at-rest encryption`: AES-256-GCM symmetric encryption storing ciphertexts and authentication tags in `user_api_keys`.
- `key hint`: non-sensitive trailing substring (e.g. `...4A9F`) displayed in the UI to confirm configured keys without exposing plaintext.
- `environment fallback`: automatic resolution of server `.env` variables (`GEMINI_API_KEY`) when no user-specific key is stored.
- `connection test`: live ping to provider REST endpoints validating API key authenticity and latency.

## Flow

1. `src/app/(app)/settings/page.tsx` resolves initial configuration statuses via `getUserApiKeysStatus()`.
2. `SettingsShell` displays settings sections, starting with `ApiKeysSection`.
3. `ApiKeyCard` renders provider status badges, input with show/hide toggle, live connection testing, save, and removal actions.
4. Saving encrypts the key server-side and writes to `user_api_keys`.
5. Other AI features across the workbench query `getEffectiveApiKey` to resolve credentials transparently.

## Constraints

- Never expose raw API keys or decryption logic to the client.
- When new providers are added, support `testUserApiKey` and `getEffectiveApiKey` fallbacks.
