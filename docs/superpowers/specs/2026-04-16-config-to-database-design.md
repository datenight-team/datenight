# Config to Database Design

**Date:** 2026-04-16
**Branch:** `ian/move-config-to-database`
**Status:** Approved — ready for implementation

## Overview

Move all application configuration from environment variables into the SQLite database (`Setting` table). Only `DATABASE_URL` stays in `.env`. A new Settings page lets users manage all config through the UI. A setup wizard runs on first launch when no settings exist.

## Goals

- Eliminate the need for env vars beyond `DATABASE_URL` for routine config changes
- Provide a Settings UI for all configuration, with masked fields and reveal toggles for API keys
- Run a setup wizard on first launch so new installs have a guided path to a working configuration
- Config changes take effect immediately with no restart required

## Non-goals

- Authentication or access control on the settings page (local home-lab app, single household)
- Migration from existing env vars (user is the only operator; clean setup via the wizard is acceptable)
- Per-user config (all settings are global to the app instance)

---

## Data Layer

### Existing `Setting` model (no migration needed)

```prisma
model Setting {
  key   String @id
  value String
}
```

### New `src/lib/config.ts`

Single source of truth for all config. Exports:

- `AppConfig` — typed interface for all settings
- `CONFIG_KEYS` — `const` object mapping friendly names to DB key strings
- `CONFIG_META` — per-key metadata (label, sensitive flag, placeholder, hint, external link)
- `getConfig(): Promise<AppConfig>` — reads all `Setting` rows, maps to `AppConfig`, applies defaults for missing keys

**Config keys and defaults:**

| Key | DB key | Default | Sensitive |
|-----|--------|---------|-----------|
| `user1Name` | `user1_name` | `"User 1"` | no |
| `user2Name` | `user2_name` | `"User 2"` | no |
| `tmdbApiKey` | `tmdb_api_key` | `""` | yes |
| `seerrUrl` | `seerr_url` | `""` | no |
| `seerrPublicUrl` | `seerr_public_url` | `""` | no |
| `seerrApiKey` | `seerr_api_key` | `""` | yes |
| `seerrConcurrency` | `seerr_concurrency` | `""` | no |
| `plexUrl` | `plex_url` | `""` | no |
| `plexToken` | `plex_token` | `""` | yes |
| `anthropicApiKey` | `anthropic_api_key` | `""` | yes |

`getConfig()` does a direct DB read each call — no in-process cache. SQLite reads are in-process file I/O (~microseconds); the added latency is negligible at this traffic level and avoids cache invalidation complexity.

---

## API Layer

### `GET /api/config` (update existing)

Currently returns `{ seerrUrl: process.env.NEXT_PUBLIC_SEERR_URL | null }`. Updated to read `seerr_public_url` from the `Setting` table via `getConfig()`. Response shape and client usage unchanged.

### `GET /api/settings` (new)

Returns all config as a flat object with actual values. Used by the settings form to pre-populate fields.

```json
{
  "user1_name": "Ian",
  "user2_name": "Kate",
  "tmdb_api_key": "abc123...",
  "seerr_url": "http://seerr:5055",
  ...
}
```

### `PUT /api/settings` (new)

Accepts the same flat object. Bulk-upserts every key into the `Setting` table using Prisma's `upsert`. Returns `{ ok: true }`.

---

## Setup Wizard

`src/app/page.tsx` (root) currently redirects to `/watchlist`. It gains a server-side check:

```
if (await prisma.setting.count() === 0) redirect('/setup')
else redirect('/watchlist')
```

`src/app/setup/page.tsx` renders a welcome banner ("Welcome to Date Night — let's get you set up") above the shared settings form. The submit button reads "Save & Get Started" and redirects to `/watchlist` on success. The page is always accessible directly so settings can be revisited.

---

## UI

### `src/components/settings-form.tsx` (new, Client Component)

Handles all interactive state:

- Controlled inputs for every config field
- Per-field reveal toggle for sensitive fields: eye icon button (`👁` / `🙈`) toggles `type="password"` ↔ `type="text"` on the input
- On submit: `PUT /api/settings` with all values, then navigates to `redirectTo` prop (default: no redirect)
- Loading state on the save button during the request

Sensitive fields render masked (`type="password"`) by default with a reveal button on the right edge of the input.

### `src/app/settings/page.tsx` (new, Server Component)

Fetches current settings via `GET /api/settings`, passes to `SettingsForm` with title "Settings" and no redirect on save.

### `src/app/setup/page.tsx` (new, Server Component)

Same as settings page but with a welcome header and `redirectTo="/watchlist"` so the form navigates after saving.

### Settings page layout (5 sections)

| Section | Fields |
|---------|--------|
| 👥 General | User 1 Name, User 2 Name |
| 🎬 TMDB | API Key (sensitive) — with ↗ link to themoviedb.org |
| 📥 Seerr | Server URL, Public URL (optional), API Key (sensitive), Concurrency (optional) |
| 📺 Plex | Server URL, Token (sensitive) |
| 🤖 Anthropic | API Key (sensitive) — with ↗ link to console.anthropic.com |

### Sidebar & mobile nav updates

Add "⚙️ Settings" as a utility link (bottom section) in:
- `src/components/sidebar.tsx`
- `src/components/mobile-bottom-nav.tsx`

---

## Lib File Changes

All files replace `process.env.X` with `await getConfig()` (or receive relevant values from a caller that does so):

| File | Change |
|------|--------|
| `src/lib/tmdb.ts` | `apiKey()` reads `(await getConfig()).tmdbApiKey` |
| `src/lib/seerr.ts` | `base()` and `key()` read from `getConfig()` |
| `src/lib/plex.ts` | `base()` and `token()` read from `getConfig()` |
| `src/lib/users.ts` | `getUserNames()` becomes async, reads from `getConfig()` |
| `src/lib/sync.ts` | `getConcurrencyLimit()` becomes async, reads from `getConfig()` |
| `src/lib/recommendations.ts` | Checks `config.anthropicApiKey` instead of `process.env.ANTHROPIC_API_KEY` |
| `src/app/api/config/route.ts` | Reads `seerr_public_url` from `getConfig()` |

### `src/lib/claude.ts` — singleton removed

Current pattern creates `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` at module load. Since the key now lives in the DB and must be fetched async, the singleton is replaced with a `getAnthropic()` async function:

```ts
export async function getAnthropic(): Promise<Anthropic> {
  const { anthropicApiKey } = await getConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}
```

`Anthropic` instances are cheap to create (no persistent connections). `recommendations.ts` calls `getAnthropic()` instead of importing the `anthropic` singleton.

---

## `.env.example` cleanup

Stripped to just `DATABASE_URL` with all other vars removed and a comment:

```
# All other configuration is managed through the Settings page in the UI.
# See /setup on first launch, or /settings thereafter.
```

`.env.local` is similarly cleaned up (user's local file — note in spec that user should do this manually after migration).

---

## Files Created / Modified Summary

**New files:**
- `src/lib/config.ts`
- `src/app/api/settings/route.ts`
- `src/app/settings/page.tsx`
- `src/app/setup/page.tsx`
- `src/components/settings-form.tsx`

**Modified files:**
- `src/app/page.tsx` — setup redirect check
- `src/app/api/config/route.ts` — read from DB
- `src/app/api/user-names/route.ts` — add `await` since `getUserNames()` becomes async
- `src/lib/tmdb.ts`
- `src/lib/seerr.ts`
- `src/lib/plex.ts`
- `src/lib/users.ts`
- `src/lib/sync.ts`
- `src/lib/recommendations.ts`
- `src/lib/claude.ts`
- `src/components/sidebar.tsx`
- `src/components/mobile-bottom-nav.tsx`
- `.env.example`

---

## Testing Notes

- Unit tests for `getConfig()` can use an in-memory SQLite DB (existing test pattern)
- Settings form: test that sensitive fields default to `type="password"` and toggle on reveal click
- Setup redirect: test that root page redirects to `/setup` when `Setting` count is 0, and to `/watchlist` when settings exist
- API routes: test `PUT /api/settings` upserts correctly and `GET /api/settings` returns expected shape
