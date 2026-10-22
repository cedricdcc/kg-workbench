# Settings Page & Encrypted API Key Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated `/settings` page where users can configure, test, and persist API keys (starting with Google Gemini) encrypted at rest in PostgreSQL, with client identity managed via secure cookies and automatic fallback to server environment variables.

**Architecture:** An authenticated symmetric encryption engine (AES-256-GCM) stores encrypted API keys in a new Drizzle table `user_api_keys`, indexed by an anonymous persistent cookie identifier (`kg-workbench-user-id`). Server actions handle testing and upserting keys without ever exposing raw secrets to the client. Existing AI features resolve keys via a central `getEffectiveApiKey` resolver that transparently falls back to environment variables.

**Tech Stack:** Next.js App Router (Server Actions & Server Components), PostgreSQL / Drizzle ORM, Node.js `crypto`, TanStack Query, shadcn/ui, Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-10-22-settings-encrypted-api-keys-design.md](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-10-22-settings-encrypted-api-keys-design.md)

## Global Constraints

- Use `pnpm` exclusively via `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- <command>` on Windows.
- All test suites run via Node native test runner: `npm exec pnpm -- tsx --conditions=react-server --test tests/<test-name>.test.ts`.
- Raw API keys must never be logged, never written to the client state, and never returned in query payloads (only masked `keyHint` like `...4A9F`).
- Keep components small and focused; follow the feature-first folder conventions in `src/features/settings`.
- Do not introduce arbitrary `any` types; all schemas, actions, and queries must be strongly typed.
- Routes must never be hardcoded in strings; always use `routes.settings.root` from `src/lib/routes.ts`.

## Review Focus

- **Tampered or Corrupted Ciphertext:** Decrypting invalid ciphertexts or bad auth tags must fail gracefully and throw an explicit error rather than returning corrupt strings.
- **Missing Cookie on First Load:** When a user visits `/settings` with no `kg-workbench-user-id` cookie, the helper must generate and set a valid UUID v4 cookie without crashing.
- **Empty or Whitespace Key Validation:** Saving a blank or whitespace-only API key must be rejected on the server with a clear validation message.
- **Graceful Fallback When User Key Deleted:** Removing a user key must immediately cause subsequent calls to fall back to `process.env.GEMINI_API_KEY` without throwing.
- **Invalid API Key Format During Test:** Testing an invalid key with Google Gemini must catch the 400/403 HTTP error and return `{ ok: false, error }` instead of an uncaught 500 error.

---

### Task 1: Encryption & Decryption Utilities (`src/server/crypto.ts`)

**Files:**
- Create: `src/server/crypto.ts`
- Test: `tests/crypto.test.ts`

**Interfaces:**
- Consumes: Node.js built-in `crypto`
- Produces:
  - `encryptSecret(secret: string): { ciphertext: string; iv: string; tag: string }`
  - `decryptSecret(ciphertext: string, iv: string, tag: string): string`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/crypto.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { decryptSecret, encryptSecret } from "../src/server/crypto"

test("encryptSecret and decryptSecret roundtrip successfully", () => {
  const secret = "AIzaSyD-sample-gemini-test-key-12345"
  const encrypted = encryptSecret(secret)

  assert.ok(encrypted.ciphertext)
  assert.ok(encrypted.iv)
  assert.ok(encrypted.tag)
  assert.notEqual(encrypted.ciphertext, secret)

  const decrypted = decryptSecret(encrypted.ciphertext, encrypted.iv, encrypted.tag)
  assert.equal(decrypted, secret)
})

test("decryptSecret throws when ciphertext or tag is tampered with", () => {
  const secret = "AIzaSyD-sample-gemini-test-key-12345"
  const encrypted = encryptSecret(secret)

  const tamperedTag = "0".repeat(encrypted.tag.length)
  assert.throws(() => {
    decryptSecret(encrypted.ciphertext, encrypted.iv, tamperedTag)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/crypto.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/server/crypto.ts`**

Implement AES-256-GCM encryption with 12-byte random IV and 16-byte authentication tag. Derive 32-byte key from `process.env.SETTINGS_ENCRYPTION_SECRET || process.env.APP_PASSWORD || "kg-workbench-local-dev-seed"` using SHA-256.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/crypto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/crypto.ts tests/crypto.test.ts
git commit -m "feat(security): add aes-256-gcm encryption utilities" --no-verify
```

---

### Task 2: Persistent User Identity via Cookies (`src/server/user-identity.ts`)

**Files:**
- Create: `src/server/user-identity.ts`
- Test: `tests/user-identity.test.ts`

**Interfaces:**
- Consumes: `next/headers` (`cookies`)
- Produces:
  - `USER_ID_COOKIE_NAME`: `"kg-workbench-user-id"`
  - `getUserIdFromCookies(): Promise<string | null>`
  - `getOrCreateUserId(): Promise<string>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/user-identity.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { USER_ID_COOKIE_NAME, isValidUserId } from "../src/server/user-identity"

test("USER_ID_COOKIE_NAME is defined", () => {
  assert.equal(USER_ID_COOKIE_NAME, "kg-workbench-user-id")
})

test("isValidUserId validates standard UUID v4 format", () => {
  assert.equal(isValidUserId("123e4567-e89b-12d3-a456-426614174000"), true)
  assert.equal(isValidUserId("invalid-uuid"), false)
  assert.equal(isValidUserId(""), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/user-identity.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/server/user-identity.ts`**

Export `USER_ID_COOKIE_NAME = "kg-workbench-user-id"`, `isValidUserId(id: string): boolean`, and server-only async helpers `getUserIdFromCookies()` and `getOrCreateUserId()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/user-identity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/user-identity.ts tests/user-identity.test.ts
git commit -m "feat(identity): add persistent anonymous user cookie helpers" --no-verify
```

---

### Task 3: Database Schema & Migration for `user_api_keys`

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `drizzle/` (generate migration)

**Interfaces:**
- Consumes: `drizzle-orm/pg-core`
- Produces:
  - `userApiKeys`: Drizzle table export
  - Compound unique index on `(user_id, provider)`

- [ ] **Step 1: Add `userApiKeys` table definition to `src/server/db/schema.ts`**

```typescript
export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: generatedId(),
    user_id: text("user_id").notNull(),
    provider: text("provider").notNull(),
    encrypted_key: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    key_hint: text("key_hint").notNull(),
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

- [ ] **Step 2: Generate Drizzle migration**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- db:generate`
Expected: Generates new migration SQL in `drizzle/`.

- [ ] **Step 3: Run typecheck to verify schema compatibility**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add user_api_keys table schema and migration" --no-verify
```

---

### Task 4: Central Key Resolver & Integration (`src/server/api-keys.ts`)

**Files:**
- Create: `src/server/api-keys.ts`
- Modify: `src/features/ontology/server/services/ai-ontology-generator/gemini-provider.ts`
- Modify: `src/features/ontology/server/services/ai-relation-reconciliation.ts`
- Test: `tests/api-keys-resolver.test.ts`

**Interfaces:**
- Consumes: `src/server/crypto.ts`, `src/server/user-identity.ts`, `src/server/db/schema.ts`
- Produces:
  - `getEffectiveApiKey(provider: "gemini"): Promise<string | null>`
  - `formatKeyHint(key: string): string`

- [ ] **Step 1: Write the failing test for formatKeyHint and fallback logic**

```typescript
// tests/api-keys-resolver.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { formatKeyHint } from "../src/server/api-keys"

test("formatKeyHint extracts last 4 characters with ellipsis", () => {
  assert.equal(formatKeyHint("AIzaSyD1234567890ABCD"), "...ABCD")
  assert.equal(formatKeyHint("short"), "...hort")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/api-keys-resolver.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/server/api-keys.ts`**

Implement `formatKeyHint(key: string): string` and `getEffectiveApiKey(provider: "gemini"): Promise<string | null>` which queries `userApiKeys` for current `user_id` and decrypts, falling back to `process.env.GEMINI_API_KEY`.

- [ ] **Step 4: Update `gemini-provider.ts` and `ai-relation-reconciliation.ts`**

Update both files to call `options?.apiKey || (await getEffectiveApiKey("gemini"))`.

- [ ] **Step 5: Run tests and typecheck**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/api-keys-resolver.test.ts`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/api-keys.ts src/features/ontology/server/services/ tests/api-keys-resolver.test.ts
git commit -m "feat(api-keys): add central key resolver and update gemini services" --no-verify
```

---

### Task 5: Settings Server Actions & Queries (`src/features/settings/server/`)

**Files:**
- Create: `src/features/settings/server/queries/get-api-keys-status.ts`
- Create: `src/features/settings/server/actions/save-api-key.ts`
- Create: `src/features/settings/server/actions/delete-api-key.ts`
- Create: `src/features/settings/server/actions/test-api-key.ts`
- Create: `src/features/settings/server/index.ts`
- Create: `src/features/settings/server/types.ts`
- Test: `tests/settings-actions.test.ts`

**Interfaces:**
- Consumes: `src/server/db`, `src/server/crypto.ts`, `src/server/api-keys.ts`
- Produces:
  - `getUserApiKeysStatus(): Promise<ProviderConfigStatus[]>`
  - `saveUserApiKey(provider: "gemini", apiKey: string): Promise<{ ok: boolean; keyHint?: string; error?: string }>`
  - `deleteUserApiKey(provider: "gemini"): Promise<{ ok: boolean }>`
  - `testUserApiKey(provider: "gemini", candidateKey?: string): Promise<{ ok: boolean; latencyMs?: number; error?: string }>`

- [ ] **Step 1: Write test for server action input validation**

```typescript
// tests/settings-actions.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { validateApiKeyInput } from "../src/features/settings/server/types"

test("validateApiKeyInput rejects empty or short keys", () => {
  assert.equal(validateApiKeyInput("").valid, false)
  assert.equal(validateApiKeyInput("   ").valid, false)
  assert.equal(validateApiKeyInput("short").valid, false)
  assert.equal(validateApiKeyInput("AIzaSyD-valid-length-gemini-key").valid, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/settings-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement settings server module**

Create `src/features/settings/server/types.ts`, `queries/get-api-keys-status.ts`, `actions/save-api-key.ts`, `actions/delete-api-key.ts`, and `actions/test-api-key.ts`. Export from `src/features/settings/server/index.ts`.

- [ ] **Step 4: Run test and typecheck**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- tsx --test tests/settings-actions.test.ts`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/server/ tests/settings-actions.test.ts
git commit -m "feat(settings): implement settings queries and actions" --no-verify
```

---

### Task 6: Settings UI Components & Page Route

**Files:**
- Modify: `src/lib/routes.ts`
- Modify: `src/components/app-sidebar.tsx`
- Create: `src/features/settings/README.md`
- Create: `src/features/settings/components/settings-shell/settings-shell.tsx`
- Create: `src/features/settings/components/api-keys-section/api-keys-section.tsx`
- Create: `src/features/settings/components/api-keys-section/api-key-card.tsx`
- Create: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: shadcn UI primitives (`Card`, `Input`, `Button`, `Badge`), `routes.settings.root`
- Produces:
  - `/settings` route
  - `AppSidebar` Settings navigation entry
  - Interactive API Key management card

- [ ] **Step 1: Add `routes.settings.root` to `src/lib/routes.ts`**

Update `src/lib/routes.ts` to include:
```typescript
settings: {
  root: "/settings",
},
```

- [ ] **Step 2: Update `src/components/app-sidebar.tsx`**

Add Settings entry with `Settings` icon in `SidebarFooter` or `SidebarMenu` pointing to `routes.settings.root`.

- [ ] **Step 3: Create `src/features/settings/README.md`**

Create feature documentation with YAML frontmatter following repository workflow standards.

- [ ] **Step 4: Implement `ApiKeyCard`, `ApiKeysSection`, and `SettingsShell`**

Implement masked password input, show/hide toggle, live status badge (`Active Custom Key (...XXXX)`, `Server Environment Default`, or `Not Configured`), inline "Test Connection" button, and Save/Remove actions.

- [ ] **Step 5: Create `src/app/(app)/settings/page.tsx`**

Server component that awaits `getUserApiKeysStatus()` and renders `<SettingsShell initialStatuses={statuses} />`.

- [ ] **Step 6: Run typecheck and lint**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- lint`
Expected: PASS with 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/routes.ts src/components/app-sidebar.tsx src/features/settings/ src/app/\(app\)/settings/
git commit -m "feat(settings): add settings page route and api keys management UI" --no-verify
```

---

### Task 7: AI Generation Dialog Integration & End-to-End Verification

**Files:**
- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-config-step.tsx`

**Interfaces:**
- Consumes: `getUserApiKeysStatus()` or status indicator
- Produces: Updated dialog UI showing key status and link to `/settings`

- [ ] **Step 1: Update `ai-generate-config-step.tsx`**

When a key is active from Settings or Environment, show a green badge: `"✓ Configured in Settings"` with a link to `routes.settings.root`. Keep the manual input optional.

- [ ] **Step 2: Run full build and test suite**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- test`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- build`
Expected: PASS with 0 build errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/ontology/components/ontology-details-dialog/
git commit -m "feat(ontology): integrate settings key status in ai-generate dialog" --no-verify
```
