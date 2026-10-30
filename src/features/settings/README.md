---
feature: settings
status: active
purpose: Manage application-wide credentials, external AI provider API keys, workspace preferences, and microservice mesh status.
scope:
  - user API key configuration (Gemini)
  - encrypted credential storage and masked hints
  - live API connection testing
  - environment variable fallback inspection
  - connected microservices and worker health matrix dashboard
entry_points:
  - path: src/app/(app)/settings/page.tsx
    purpose: Server route loading initial provider statuses, system services, and rendering SettingsShell.
  - path: src/features/settings/components/settings-shell/settings-shell.tsx
    purpose: Client shell container coordinating settings sections and notifications.
server_entry_points:
  - path: src/features/settings/server/queries/get-api-keys-status.ts
    purpose: Resolves provider configuration statuses without leaking secrets.
  - path: src/features/settings/server/queries/get-system-services.ts
    purpose: Resolves connected microservices, capabilities, and worker health matrix.
  - path: src/features/settings/server/actions/
    purpose: Server actions for testing, saving (AES-GCM encryption), and deleting user keys.
update_this_readme_when:
  - new settings categories or providers are added
  - credential storage or identity resolution changes
  - microservice mesh integration changes
---

# Settings

## Domain Concepts

- `anonymous client identity`: persistent UUID v4 cookie (`kg-workbench-user-id`) scoping credentials to a user's browser.
- `at-rest encryption`: AES-256-GCM symmetric encryption storing ciphertexts and authentication tags in `user_api_keys`.
- `key hint`: non-sensitive trailing substring (e.g. `...4A9F`) displayed in the UI to confirm configured keys without exposing plaintext.
- `environment fallback`: automatic resolution of server `.env` variables (`GEMINI_API_KEY`) when no user-specific key is stored.
- `connection test`: live ping to provider REST endpoints validating API key authenticity and latency.
- `microservice mesh`: pluggable worker containers (extractor, reasoner, tabular, analyst) coordinated via PostgreSQL event outbox and Docker Compose profiles.

## Flow

1. `src/app/(app)/settings/page.tsx` resolves initial configuration statuses via `getUserApiKeysStatus()` and `getSystemServices()`.
2. `SettingsShell` displays settings sections: `ApiKeysSection` followed by `ServicesSection`.
3. `ApiKeyCard` renders provider status badges, input with show/hide toggle, live connection testing, save, and removal actions.
4. `ServicesSection` renders `ServiceCard` items showing live status, capabilities, and one-click copyable Docker Compose startup commands when offline.
5. Other features across the workbench query `getEffectiveApiKey` and the event outbox to interact with external providers and workers.

## Constraints

- Never expose raw API keys or decryption logic to the client.
- When new providers are added, support `testUserApiKey` and `getEffectiveApiKey` fallbacks.
- When new microservices are introduced, declare their default capabilities and compose profiles in `getSystemServices`.
