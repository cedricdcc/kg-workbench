# Settings Page & Encrypted API Key Management

- **Date:** 2026-10-22
- **Status:** Approved
- **Scope:** Architectural Subsystem (Sub-project 1 of Workflow & Configuration Initiative)

---

## 1. Overview & Problem Statement

Currently in KG Workbench, AI capabilities—such as AI-assisted ontology draft generation from Competency Questions (CQs) and AI relation reconciliation—require external LLM credentials (specifically Google Gemini).

Presently, these credentials either rely on a server-wide environment variable (`GEMINI_API_KEY`) or require users to manually paste raw API keys into modal forms (`ai-generate-config-step.tsx`). There is no centralized settings surface, keys are not saved securely across sessions, and other team members sharing an installation may have differing credentials or access quotas.

This specification introduces:

1. A top-level `/settings` route and navigation landmark in the application sidebar.
2. An anonymous client/user identity persistence layer via secure cookies (`kg-workbench-user-id`).
3. An at-rest encryption engine using AES-256-GCM to persist API keys safely in PostgreSQL.
4. Centralized key resolution (`getEffectiveApiKey`) that resolves user keys before falling back to server environment variables.
5. An interactive Settings UI with connection verification, masked key display, and key lifecycle management.

---

## 2. Identity & Security Architecture

### 2.1 Persistent User Identity

Since the workbench uses shared/group access rather than individual logins, each browser client maintains an independent identity:

- **Cookie Name:** `kg-workbench-user-id`
- **Value:** RFC 4122 UUID v4.
- **Attributes:** `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `maxAge: 31536000` (1 year), `secure: process.env.NODE_ENV === "production"`.
- **Resolution Helper (`src/server/user-identity.ts`):**
  - Reads the request cookies. If missing or invalid, generates a new UUID v4 and sets the cookie on the response.

### 2.2 At-Rest Symmetric Encryption (`src/server/crypto.ts`)

- **Algorithm:** `aes-256-gcm` authenticated encryption with 12-byte IV and 16-byte authentication tag.
- **Master Secret:** Resolved from `process.env.SETTINGS_ENCRYPTION_SECRET`. If unset, falls back in development to a SHA-256 hash of `process.env.APP_PASSWORD ?? "kg-workbench-local-dev-seed"`.
- **Functions:**
  - `encryptSecret(secret: string): { ciphertext: string; iv: string; tag: string }`
  - `decryptSecret(ciphertext: string, iv: string, tag: string): string`
- **Tampering Protection:** Any payload modification or invalid key causes AES-GCM tag verification to throw, preventing cipher forgery.
- **Leakage Prevention:** Server queries never return `ciphertext`, `iv`, or decrypted keys to the frontend. Only a non-sensitive mask (`key_hint`, e.g., `"...4A9F"`) is sent to the client.

---

## 3. Database Schema

Located in `src/server/db/schema.ts`:

```typescript
export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: generatedId(),
    user_id: text("user_id").notNull(),
    provider: text("provider").notNull(), // e.g. "gemini"
    encrypted_key: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    key_hint: text("key_hint").notNull(), // e.g. "...4A9F" (last 4 characters)
    created_at: created_at(),
    updated_at: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    uniqueIndex("user_api_keys_user_provider_idx").on(
      table.user_id,
      table.provider
    ),
  ]
)
```

---

## 4. Server Logic & Key Resolution

### 4.1 Central Key Resolver (`src/server/api-keys.ts`)

```typescript
export async function getEffectiveApiKey(
  provider: "gemini"
): Promise<string | null> {
  const userId = await getUserIdFromCookies()
  if (userId) {
    const record = await getDb()
      .select()
      .from(userApiKeys)
      .where(
        and(eq(userApiKeys.user_id, userId), eq(userApiKeys.provider, provider))
      )
      .limit(1)

    if (record.length > 0) {
      try {
        return decryptSecret(
          record[0].encrypted_key,
          record[0].iv,
          record[0].tag
        )
      } catch (error) {
        console.error("Failed to decrypt stored user API key:", error)
      }
    }
  }

  // Fallback to server environment
  if (provider === "gemini") {
    return process.env.GEMINI_API_KEY?.trim() || null
  }

  return null
}
```

### 4.2 Settings Server Actions & Queries (`src/features/settings/server/`)

- **`getUserApiKeysStatus()`**:
  - Scans available providers (`"gemini"`).
  - Checks if user has a configured record.
  - Checks if server environment variable fallback exists (`Boolean(process.env.GEMINI_API_KEY)`).
  - Returns metadata:
    ```typescript
    export interface ProviderStatus {
      provider: "gemini"
      isConfigured: boolean
      keyHint?: string
      updatedAt?: string
      hasEnvFallback: boolean
    }
    ```
- **`saveUserApiKey(provider, rawApiKey)`**:
  - Validates key input string (minimum 10 characters).
  - Derives `keyHint = "..." + rawApiKey.slice(-4)`.
  - Encrypts via `encryptSecret(rawApiKey)`.
  - Upserts into `user_api_keys` on conflict `(user_id, provider)`.
  - Revalidates path `/settings`.
- **`deleteUserApiKey(provider)`**:
  - Deletes row matching `(user_id, provider)`.
  - Revalidates path `/settings`.
- **`testUserApiKey(provider, candidateKey?)`**:
  - Resolves key: candidate key if passed from input, otherwise calls `getEffectiveApiKey(provider)`.
  - If no key available, returns `{ ok: false, error: "No API key configured to test." }`.
  - For Gemini: Performs a test HTTP call to `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1` with a 6-second abort controller.
  - Returns `{ ok: true, latencyMs: number }` on HTTP 200, or `{ ok: false, error: string }` on failure.

---

## 5. UI & Component Architecture

### 5.1 Route & Sidebar

- **Route Definition:** Add `settings: { root: "/settings" }` in `src/lib/routes.ts`.
- **Server Route:** Create `src/app/(app)/settings/page.tsx` loading initial statuses via `getUserApiKeysStatus()`.
- **Sidebar Integration:** Update `src/components/app-sidebar.tsx` with a bottom-aligned `Settings` entry using the `Settings` icon from `lucide-react`.

### 5.2 Component Breakdown

Located under `src/features/settings/`:

- `src/features/settings/README.md`: Feature lifecycle documentation.
- `src/features/settings/components/settings-shell/settings-shell.tsx`: Main page layout container with title, description, and navigation breadcrumb/anchor.
- `src/features/settings/components/api-keys-section/api-keys-section.tsx`: Section container managing provider cards and global notification toasts.
- `src/features/settings/components/api-keys-section/api-key-card.tsx`:
  - Provider header with Google Gemini branding and status pill:
    - `Active Custom Key (...4A9F)` (Green)
    - `Server Environment Default` (Blue/Neutral)
    - `Not Configured` (Amber)
  - Key input with show/hide password toggle.
  - "Test Connection" button with loading spinner and inline latency / error result indicator.
  - "Save Key" primary button.
  - "Remove" destructive button (when user key is active) with confirmation dialog.
  - Helpful links to Google AI Studio to generate a free Gemini API key.

---

## 6. Integration with Existing Workflows

1. **`gemini-provider.ts` (`src/features/ontology/server/services/ai-ontology-generator/gemini-provider.ts`)**:
   - Update `getGeminiClient(options)` to call `await getEffectiveApiKey("gemini")` when options key is omitted.
2. **`ai-relation-reconciliation.ts` (`src/features/ontology/server/services/ai-relation-reconciliation.ts`)**:
   - Update key resolution to check `input.apiKey || await getEffectiveApiKey("gemini")`.
3. **`ai-generate-config-step.tsx` (`src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-config-step.tsx`)**:
   - When a key is already configured via Settings or Environment, show a green status: `"✓ Using API key from Settings"` with a link to change it in `/settings`, keeping the manual input field optional/collapsed.

---

## 7. Verification & Testing Plan

1. **Unit Tests (`src/server/__tests__/crypto.test.ts`)**:
   - Verify encryption and decryption round-trip.
   - Verify that altering ciphertext or auth tag fails decryption.
2. **Integration Verification**:
   - Navigate to `/settings` via sidebar.
   - Test invalid key -> verify error message displays clearly.
   - Test valid key -> verify success indicator and latency display.
   - Save valid key -> verify status pill changes to `Active Custom Key (...XXXX)`.
   - Run AI ontology draft generation from CQs -> verify generation succeeds using the saved key without manual key entry.
   - Remove key -> verify status pill reverts to `Server Environment Default` or `Not Configured`.
3. **Build & Lint Verification**:
   - Execute `npm exec pnpm -- lint` and verify clean build.
