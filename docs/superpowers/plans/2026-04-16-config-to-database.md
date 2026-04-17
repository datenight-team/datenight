# Config to Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all app configuration from environment variables to the SQLite `Setting` table, add a Settings UI page, and show a setup wizard on first launch when no settings exist.

**Architecture:** A new `getConfig()` function in `src/lib/config.ts` reads all settings from the existing `Setting` table and returns a typed `AppConfig` object. All lib files call `await getConfig()` instead of `process.env`. Two new pages (`/settings`, `/setup`) share a `SettingsForm` Client Component. The root redirect page checks if any settings exist and redirects to `/setup` if not.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma + SQLite · Vitest · shadcn/ui (Button, Input)

---

## File Map

**New files:**
- `src/lib/config.ts` — typed config interface, `ALL_DB_KEYS`, `getConfig()`
- `src/app/api/settings/route.ts` — GET + PUT for settings management
- `src/components/settings-form.tsx` — Client Component: controlled inputs, reveal toggles, save
- `src/app/settings/page.tsx` — Server Component: fetches config, renders SettingsForm
- `src/app/setup/page.tsx` — Server Component: welcome banner + SettingsForm with redirect
- `tests/config.test.ts` — unit tests for getConfig()
- `tests/api.settings.test.ts` — unit tests for settings route

**Modified files:**
- `src/app/api/config/route.ts` — reads `seerr_public_url` from DB instead of env var
- `src/lib/tmdb.ts` — uses `getConfig()` for `tmdbApiKey`
- `src/lib/plex.ts` — uses `getConfig()` for `plexUrl`, `plexToken`
- `src/lib/users.ts` — becomes async, uses `getConfig()` for names
- `src/lib/seerr.ts` — uses `getConfig()` for `seerrUrl`, `seerrApiKey`
- `src/lib/sync.ts` — uses `getConfig()` for `seerrConcurrency`
- `src/lib/claude.ts` — replaces singleton with async `getAnthropic()` function
- `src/lib/recommendations.ts` — uses `getConfig()` for key check, `getAnthropic()` for client
- `src/app/api/user-names/route.ts` — awaits now-async `getUserNames()`
- `src/app/api/recommendations/route.ts` — removes redundant `process.env` check
- `src/app/watched/page.tsx` — awaits `getUserNames()`, uses `getConfig()` for seerrUrl
- `src/app/page.tsx` — redirects to `/setup` when Setting table is empty
- `src/components/sidebar.tsx` — adds "⚙️ Settings" utility link
- `src/components/mobile-bottom-nav.tsx` — adds Settings tab
- `tests/seerr.test.ts` — mocks `getConfig` instead of setting env vars
- `.env.example` — strips all vars except `DATABASE_URL`

---

## Task 1: Create `src/lib/config.ts`

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    setting: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { getConfig } from '@/lib/config'

describe('getConfig', () => {
  beforeEach(() => {
    vi.mocked(prisma.setting.findMany).mockReset()
  })

  it('returns defaults when no settings exist', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])
    const config = await getConfig()
    expect(config.user1Name).toBe('User 1')
    expect(config.user2Name).toBe('User 2')
    expect(config.tmdbApiKey).toBe('')
    expect(config.seerrUrl).toBe('')
    expect(config.seerrPublicUrl).toBe('')
    expect(config.seerrApiKey).toBe('')
    expect(config.seerrConcurrency).toBe('')
    expect(config.plexUrl).toBe('')
    expect(config.plexToken).toBe('')
    expect(config.anthropicApiKey).toBe('')
  })

  it('returns stored values over defaults', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'user1_name', value: 'Ian' },
      { key: 'user2_name', value: 'Kate' },
      { key: 'tmdb_api_key', value: 'abc123' },
    ])
    const config = await getConfig()
    expect(config.user1Name).toBe('Ian')
    expect(config.user2Name).toBe('Kate')
    expect(config.tmdbApiKey).toBe('abc123')
    expect(config.plexUrl).toBe('')  // not set → default
  })

  it('ignores unknown keys', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'unknown_key', value: 'foo' },
    ])
    const config = await getConfig()
    expect(config.user1Name).toBe('User 1')
  })

  it('maps all ten DB keys to AppConfig fields', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'user1_name', value: 'A' },
      { key: 'user2_name', value: 'B' },
      { key: 'tmdb_api_key', value: 'C' },
      { key: 'seerr_url', value: 'D' },
      { key: 'seerr_public_url', value: 'E' },
      { key: 'seerr_api_key', value: 'F' },
      { key: 'seerr_concurrency', value: '5' },
      { key: 'plex_url', value: 'G' },
      { key: 'plex_token', value: 'H' },
      { key: 'anthropic_api_key', value: 'I' },
    ])
    const config = await getConfig()
    expect(config.user1Name).toBe('A')
    expect(config.user2Name).toBe('B')
    expect(config.tmdbApiKey).toBe('C')
    expect(config.seerrUrl).toBe('D')
    expect(config.seerrPublicUrl).toBe('E')
    expect(config.seerrApiKey).toBe('F')
    expect(config.seerrConcurrency).toBe('5')
    expect(config.plexUrl).toBe('G')
    expect(config.plexToken).toBe('H')
    expect(config.anthropicApiKey).toBe('I')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/config.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/config'`

- [ ] **Step 3: Implement `src/lib/config.ts`**

```typescript
// src/lib/config.ts
import { prisma } from './db'

export interface AppConfig {
  user1Name: string
  user2Name: string
  tmdbApiKey: string
  seerrUrl: string
  seerrPublicUrl: string
  seerrApiKey: string
  seerrConcurrency: string
  plexUrl: string
  plexToken: string
  anthropicApiKey: string
}

const DEFAULTS: AppConfig = {
  user1Name: 'User 1',
  user2Name: 'User 2',
  tmdbApiKey: '',
  seerrUrl: '',
  seerrPublicUrl: '',
  seerrApiKey: '',
  seerrConcurrency: '',
  plexUrl: '',
  plexToken: '',
  anthropicApiKey: '',
}

// Map from AppConfig camelCase keys → DB snake_case keys
const KEY_MAP: Record<keyof AppConfig, string> = {
  user1Name: 'user1_name',
  user2Name: 'user2_name',
  tmdbApiKey: 'tmdb_api_key',
  seerrUrl: 'seerr_url',
  seerrPublicUrl: 'seerr_public_url',
  seerrApiKey: 'seerr_api_key',
  seerrConcurrency: 'seerr_concurrency',
  plexUrl: 'plex_url',
  plexToken: 'plex_token',
  anthropicApiKey: 'anthropic_api_key',
}

// Reverse map: DB key → AppConfig key
const DB_TO_CONFIG = Object.fromEntries(
  Object.entries(KEY_MAP).map(([configKey, dbKey]) => [dbKey, configKey as keyof AppConfig])
) as Record<string, keyof AppConfig>

// All valid DB keys — used by API routes to enumerate/upsert settings
export const ALL_DB_KEYS = Object.values(KEY_MAP)

export async function getConfig(): Promise<AppConfig> {
  const rows = await prisma.setting.findMany()
  const config = { ...DEFAULTS }
  for (const row of rows) {
    const configKey = DB_TO_CONFIG[row.key]
    if (configKey) {
      config[configKey] = row.value
    }
  }
  return config
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/config.test.ts
```
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts tests/config.test.ts
git commit -m "feat: add getConfig() — reads AppConfig from Setting table"
```

---

## Task 2: Create `src/app/api/settings/route.ts`

**Files:**
- Create: `src/app/api/settings/route.ts`
- Create: `tests/api.settings.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/api.settings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    setting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { GET, PUT } from '@/app/api/settings/route'

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.mocked(prisma.setting.findMany).mockReset()
  })

  it('returns all known keys as a flat object', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'user1_name', value: 'Ian' },
      { key: 'tmdb_api_key', value: 'abc123' },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user1_name).toBe('Ian')
    expect(data.tmdb_api_key).toBe('abc123')
    // Keys not in DB return empty string
    expect(data.user2_name).toBe('')
    expect(data.plex_url).toBe('')
  })

  it('returns empty strings for all keys when table is empty', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.user1_name).toBe('')
    expect(data.anthropic_api_key).toBe('')
  })
})

describe('PUT /api/settings', () => {
  beforeEach(() => {
    vi.mocked(prisma.setting.upsert).mockReset()
    vi.mocked(prisma.setting.upsert).mockResolvedValue({ key: '', value: '' })
  })

  it('upserts known keys and returns ok:true', async () => {
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user1_name: 'Ian', user2_name: 'Kate' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(vi.mocked(prisma.setting.upsert)).toHaveBeenCalledWith({
      where: { key: 'user1_name' },
      update: { value: 'Ian' },
      create: { key: 'user1_name', value: 'Ian' },
    })
    expect(vi.mocked(prisma.setting.upsert)).toHaveBeenCalledWith({
      where: { key: 'user2_name' },
      update: { value: 'Kate' },
      create: { key: 'user2_name', value: 'Kate' },
    })
  })

  it('silently skips unknown keys', async () => {
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_key: 'bad', user1_name: 'Ian' }),
    })
    await PUT(req)
    // upsert called once (only for user1_name), not for unknown_key
    expect(vi.mocked(prisma.setting.upsert)).toHaveBeenCalledTimes(1)
  })

  it('returns 400 for non-JSON body', async () => {
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      body: 'not json',
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/api.settings.test.ts
```
Expected: FAIL — `Cannot find module '@/app/api/settings/route'`

- [ ] **Step 3: Implement `src/app/api/settings/route.ts`**

```typescript
// src/app/api/settings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ALL_DB_KEYS } from '@/lib/config'

export async function GET() {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const result = Object.fromEntries(ALL_DB_KEYS.map((k) => [k, map[k] ?? '']))
  return NextResponse.json(result)
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates = Object.entries(body).filter(
    ([k, v]) => ALL_DB_KEYS.includes(k) && typeof v === 'string'
  ) as [string, string][]

  await Promise.all(
    updates.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/api.settings.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/settings/route.ts tests/api.settings.test.ts
git commit -m "feat: add GET+PUT /api/settings for DB-backed config management"
```

---

## Task 3: Update `src/app/api/config/route.ts`

**Files:**
- Modify: `src/app/api/config/route.ts`

- [ ] **Step 1: Replace the file**

```typescript
// src/app/api/config/route.ts
import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { seerrPublicUrl } = await getConfig()
  return NextResponse.json({
    seerrUrl: seerrPublicUrl || null,
  })
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/config/route.ts
git commit -m "feat: /api/config reads seerrPublicUrl from DB"
```

---

## Task 4: Update `src/lib/tmdb.ts`

**Files:**
- Modify: `src/lib/tmdb.ts`

- [ ] **Step 1: Replace the `apiKey()` helper to read from config**

Replace lines 7–9 in `src/lib/tmdb.ts`:

```typescript
// src/lib/tmdb.ts
import type { TmdbMovieDetails } from '@/types'
import { getConfig } from './config'

const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

async function apiKey(): Promise<string> {
  return (await getConfig()).tmdbApiKey
}

async function fetchDetails(tmdbId: number): Promise<TmdbMovieDetails | null> {
  const res = await fetch(`${BASE}/movie/${tmdbId}?api_key=${await apiKey()}`)
  if (!res.ok) return null
  const m = await res.json()
  return {
    tmdbId: m.id,
    title: m.title,
    year: parseInt((m.release_date || '0').split('-')[0], 10) || 0,
    runtime: m.runtime ?? 0,
    description: m.overview ?? '',
    posterUrl: m.poster_path ? `${IMG_BASE}${m.poster_path}` : '',
    imdbId: m.imdb_id ?? '',
  }
}

export async function findByImdbId(
  imdbId: string
): Promise<TmdbMovieDetails | null> {
  const res = await fetch(
    `${BASE}/find/${imdbId}?api_key=${await apiKey()}&external_source=imdb_id`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.movie_results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id)
}

export async function searchByTitle(
  title: string,
  year?: number
): Promise<TmdbMovieDetails | null> {
  const yearParam = year ? `&year=${year}` : ''
  const res = await fetch(
    `${BASE}/search/movie?api_key=${await apiKey()}&query=${encodeURIComponent(title)}${yearParam}`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id)
}

export async function lookupCriterionSlug(
  slug: string
): Promise<TmdbMovieDetails | null> {
  try {
    const res = await fetch(`https://www.criterion.com/films/${slug}`)
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/<meta property="og:title" content="([^"]+)"/)
      if (match) {
        const title = match[1].replace(/ \| The Criterion Collection$/, '').trim()
        const movie = await searchByTitle(title)
        if (movie) return movie
      }
    }
  } catch {
    // fall through
  }

  const titleSlug = slug.replace(/^\d+-/, '')
  const title = titleSlug.replace(/-/g, ' ')
  return searchByTitle(title)
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS (api.preview.test.ts mocks tmdb, so no change needed there)

- [ ] **Step 3: Commit**

```bash
git add src/lib/tmdb.ts
git commit -m "feat: tmdb reads API key from DB config"
```

---

## Task 5: Update `src/lib/plex.ts`

**Files:**
- Modify: `src/lib/plex.ts`

- [ ] **Step 1: Replace `base()` and `token()` helpers**

Replace lines 1–9 in `src/lib/plex.ts`. The public functions `syncDateNightCollection`, `getMachineIdentifier`, `findMovieLibrarySectionId`, `findMovieRatingKey` each need to fetch config at the start. Since many internal helpers use `base()` and `token()`, the cleanest approach is to read config once per exported function call and pass values down:

```typescript
// src/lib/plex.ts
import { getConfig } from './config'

const jsonHeaders = {
  Accept: 'application/json',
  'X-Plex-Client-Identifier': 'datenight',
  'X-Plex-Product': 'DateNight',
  'X-Plex-Version': '1.0.0',
  'X-Plex-Platform': 'Node.js',
}

function plexUrl(base: string, token: string, path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, 'X-Plex-Token': token })
  return `${base}${path}?${q}`
}

export async function getMachineIdentifier(): Promise<string> {
  const { plexUrl: base, plexToken: token } = await getConfig()
  const res = await fetch(plexUrl(base, token, '/identity'), { headers: jsonHeaders })
  const data = await res.json()
  return data.MediaContainer.machineIdentifier as string
}

export async function findMovieLibrarySectionId(): Promise<string | null> {
  const { plexUrl: base, plexToken: token } = await getConfig()
  const res = await fetch(plexUrl(base, token, '/library/sections'), { headers: jsonHeaders })
  if (!res.ok) return null
  const data = await res.json()
  const sections = (data.MediaContainer?.Directory ?? []) as Array<{
    type: string
    key: string
    title: string
  }>
  const movies = sections.filter((s) => s.type === 'movie')
  return (
    movies.find((s) => s.title.toLowerCase() === 'movies')?.key ??
    movies[0]?.key ??
    null
  )
}

export async function findMovieRatingKey(
  sectionId: string,
  title: string,
  year: number
): Promise<string | null> {
  const { plexUrl: base, plexToken: token } = await getConfig()
  try {
    const res = await fetch(
      plexUrl(base, token, `/library/sections/${sectionId}/search`, { query: title, type: '1' }),
      { headers: jsonHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    const results = (data.MediaContainer?.Metadata ?? []) as Array<{
      ratingKey: string
      title: string
      year: number
    }>
    return results.find((m) => m.year === year)?.ratingKey ?? null
  } catch {
    return null
  }
}

async function findCollection(
  base: string,
  token: string,
  sectionId: string,
  title: string
): Promise<string | null> {
  const res = await fetch(
    plexUrl(base, token, `/library/sections/${sectionId}/collections`),
    { headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  const list = (data.MediaContainer?.Metadata ?? []) as Array<{
    title: string
    ratingKey: string
  }>
  return list.find((c) => c.title === title)?.ratingKey ?? null
}

async function deleteCollection(base: string, token: string, collectionKey: string): Promise<void> {
  await fetch(plexUrl(base, token, `/library/collections/${collectionKey}`), {
    method: 'DELETE',
    headers: jsonHeaders,
  })
}

async function createCollection(
  base: string,
  token: string,
  title: string,
  sectionId: string,
  machineId: string,
  ratingKeys: string[]
): Promise<string | null> {
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKeys.join(',')}`
  const res = await fetch(
    plexUrl(base, token, '/library/collections', {
      type: '1',
      title,
      sectionId,
      uri,
    }),
    { method: 'POST', headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.MediaContainer?.Metadata?.[0]?.ratingKey ?? null
}

export async function syncDateNightCollection(
  movies: Array<{ title: string; year: number }>
): Promise<void> {
  if (movies.length === 0) return

  const { plexUrl: base, plexToken: token } = await getConfig()

  const [machineId, sectionId] = await Promise.all([
    getMachineIdentifier(),
    findMovieLibrarySectionId(),
  ])

  if (!sectionId) return

  const ratingKeys = (
    await Promise.all(movies.map((m) => findMovieRatingKey(sectionId, m.title, m.year)))
  ).filter((k): k is string => k !== null)

  if (ratingKeys.length === 0) return

  const existingKey = await findCollection(base, token, sectionId, 'Date Night')
  if (existingKey) {
    await deleteCollection(base, token, existingKey)
  }

  await createCollection(base, token, 'Date Night', sectionId, machineId, ratingKeys)
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/plex.ts
git commit -m "feat: plex reads URL and token from DB config"
```

---

## Task 6: Update `src/lib/users.ts`

**Files:**
- Modify: `src/lib/users.ts`

- [ ] **Step 1: Make `getUserNames()` async and read from config**

```typescript
// src/lib/users.ts
import { getConfig } from './config'
import type { User } from '@/types'

export const USER_KEYS: User[] = ['user1', 'user2']

export async function getUserNames(): Promise<Record<User, string>> {
  const config = await getConfig()
  return {
    user1: config.user1Name || 'User 1',
    user2: config.user2Name || 'User 2',
  }
}

export function otherUser(user: User): User {
  return user === 'user1' ? 'user2' : 'user1'
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS (no tests currently import getUserNames directly)

- [ ] **Step 3: Commit**

```bash
git add src/lib/users.ts
git commit -m "feat: getUserNames() becomes async, reads from DB config"
```

---

## Task 7: Update `src/lib/seerr.ts` and fix `tests/seerr.test.ts`

**Files:**
- Modify: `src/lib/seerr.ts`
- Modify: `tests/seerr.test.ts`

- [ ] **Step 1: Update `src/lib/seerr.ts`**

```typescript
// src/lib/seerr.ts
import type { SeerrStatus } from '@/types'
import { getConfig } from './config'

function mapStatus(code: number | undefined): SeerrStatus {
  if (code === 5) return 'available'
  if (code === 3) return 'processing'
  if (code === 2) return 'pending'
  return 'not_requested'
}

export async function getMovieStatus(tmdbId: number): Promise<{
  status: SeerrStatus
  seerrMediaId?: number
  seerrRequestId?: number
}> {
  try {
    const { seerrUrl, seerrApiKey } = await getConfig()
    const res = await fetch(`${seerrUrl}/api/v1/movie/${tmdbId}`, {
      headers: { 'X-Api-Key': seerrApiKey },
    })
    if (!res.ok) return { status: 'not_requested' }
    const data = await res.json()
    const media = data.mediaInfo
    return {
      status: mapStatus(media?.status),
      seerrMediaId: media?.id,
      seerrRequestId: media?.requests?.[0]?.id,
    }
  } catch {
    return { status: 'not_requested' }
  }
}

export async function requestMovie(
  tmdbId: number
): Promise<{ requestId: string } | null> {
  try {
    const { seerrUrl, seerrApiKey } = await getConfig()
    const res = await fetch(`${seerrUrl}/api/v1/request`, {
      method: 'POST',
      headers: { 'X-Api-Key': seerrApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'movie', mediaId: tmdbId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { requestId: String(data.id) }
  } catch {
    return null
  }
}

export async function deleteMedia(seerrMediaId: number): Promise<boolean> {
  try {
    const { seerrUrl, seerrApiKey } = await getConfig()
    const res = await fetch(`${seerrUrl}/api/v1/media/${seerrMediaId}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': seerrApiKey },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteFromService(tmdbId: number): Promise<boolean> {
  try {
    const { seerrUrl, seerrApiKey } = await getConfig()
    const res = await fetch(`${seerrUrl}/api/v1/movie/${tmdbId}`, {
      headers: { 'X-Api-Key': seerrApiKey },
    })
    if (!res.ok) return false
    const data = await res.json()
    const media = data.mediaInfo
    if (!media || media.serviceId === null || media.serviceId === undefined) return false
    if (media.externalServiceId === null || media.externalServiceId === undefined) return false

    const delRes = await fetch(
      `${seerrUrl}/api/v1/service/radarr/${media.serviceId}/movie/${media.externalServiceId}`,
      { method: 'DELETE', headers: { 'X-Api-Key': seerrApiKey } }
    )
    return delRes.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Update `tests/seerr.test.ts` to mock `getConfig` instead of env vars**

```typescript
// tests/seerr.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}))

import { getConfig } from '@/lib/config'
const { getMovieStatus, requestMovie, deleteMedia } = await import('@/lib/seerr')

const mockConfig = {
  seerrUrl: 'http://seerr:5055',
  seerrApiKey: 'test-key',
  user1Name: 'User 1', user2Name: 'User 2',
  tmdbApiKey: '', seerrPublicUrl: '', seerrConcurrency: '',
  plexUrl: '', plexToken: '', anthropicApiKey: '',
}

describe('getMovieStatus', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns available when Seerr status is 5', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mediaInfo: { id: 42, status: 5, requests: [{ id: 99 }] },
      }),
    })
    const result = await getMovieStatus(345911)
    expect(result).toEqual({
      status: 'available',
      seerrMediaId: 42,
      seerrRequestId: 99,
    })
  })

  it('returns processing when status is 3', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mediaInfo: { id: 42, status: 3, requests: [] } }),
    })
    expect((await getMovieStatus(345911)).status).toBe('processing')
  })

  it('returns pending when status is 2', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mediaInfo: { id: 42, status: 2, requests: [] } }),
    })
    expect((await getMovieStatus(345911)).status).toBe('pending')
  })

  it('returns not_requested when mediaInfo is absent', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    expect((await getMovieStatus(345911)).status).toBe('not_requested')
  })

  it('returns not_requested on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect((await getMovieStatus(345911)).status).toBe('not_requested')
  })
})

describe('requestMovie', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns requestId on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) })
    expect(await requestMovie(345911)).toEqual({ requestId: '99' })
  })

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await requestMovie(345911)).toBeNull()
  })
})

describe('deleteMedia', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    expect(await deleteMedia(42)).toBe(true)
  })

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await deleteMedia(42)).toBe(false)
  })
})
```

- [ ] **Step 3: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/seerr.ts tests/seerr.test.ts
git commit -m "feat: seerr reads URL and API key from DB config"
```

---

## Task 8: Update `src/lib/sync.ts`

**Files:**
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: Make `getConcurrencyLimit()` async and read from config**

Replace lines 8–12 in `src/lib/sync.ts`:

```typescript
// src/lib/sync.ts
import { prisma } from './db'
import { getConfig } from './config'
import { getMovieStatus, requestMovie } from './seerr'
import { syncDateNightCollection } from './plex'

const TOP_N = 10

async function getConcurrencyLimit(): Promise<number | null> {
  const { seerrConcurrency } = await getConfig()
  if (!seerrConcurrency) return null
  return parseInt(seerrConcurrency, 10)
}

async function isRequestingAllowed(): Promise<boolean> {
  const limit = await getConcurrencyLimit()
  if (limit === null) return true
  if (limit === 0) return false
  const active = await prisma.movie.count({
    where: { seerrStatus: { in: ['pending', 'processing'] } },
  })
  return active < limit
}

export async function runSync(): Promise<void> {
  const canRequest = await isRequestingAllowed()

  if (canRequest) {
    const toRequest = await prisma.movie.findMany({
      where: { status: 'watchlist', seerrRequestId: null },
      orderBy: { sortOrder: 'asc' },
      take: TOP_N,
    })
    await Promise.all(
      toRequest.map(async (movie) => {
        const result = await requestMovie(movie.tmdbId)
        if (result) {
          await prisma.movie.update({
            where: { id: movie.id },
            data: {
              seerrRequestId: result.requestId,
              seerrMediaId: null,
              seerrStatus: 'pending',
            },
          })
        }
      })
    )
  }

  const requested = await prisma.movie.findMany({
    where: { status: 'watchlist', seerrRequestId: { not: null } },
  })
  await Promise.all(
    requested.map(async (movie) => {
      const { status, seerrMediaId } = await getMovieStatus(movie.tmdbId)
      await prisma.movie.update({
        where: { id: movie.id },
        data: {
          seerrStatus: status,
          ...(seerrMediaId !== undefined ? { seerrMediaId: String(seerrMediaId) } : {}),
        },
      })
    })
  )

  const available = await prisma.movie.findMany({
    where: { status: 'watchlist', seerrStatus: 'available' },
    orderBy: { sortOrder: 'asc' },
  })

  await syncDateNightCollection(available.map((m) => ({ title: m.title, year: m.year })))
}

export function startSyncJob(): void {
  import('node-cron').then(({ default: cron }) => {
    cron.schedule('*/5 * * * *', async () => {
      console.log('[sync] Running...')
      try {
        await runSync()
        console.log('[sync] Done')
      } catch (err) {
        console.error('[sync] Error:', err)
      }
    })
    console.log('[sync] Job started (every 5 min)')
  })
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat: sync reads SEERR_CONCURRENCY from DB config"
```

---

## Task 9: Update `src/lib/claude.ts`

**Files:**
- Modify: `src/lib/claude.ts`

- [ ] **Step 1: Replace the singleton with an async factory function**

```typescript
// src/lib/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from './config'

export async function getAnthropic(): Promise<Anthropic> {
  const { anthropicApiKey } = await getConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: replace Anthropic singleton with getAnthropic() async factory"
```

---

## Task 10: Update `src/lib/recommendations.ts` and `src/app/api/recommendations/route.ts`

**Files:**
- Modify: `src/lib/recommendations.ts`
- Modify: `src/app/api/recommendations/route.ts`

- [ ] **Step 1: Update `src/lib/recommendations.ts`**

Replace the import of `anthropic` with `getAnthropic`, and replace the `process.env.ANTHROPIC_API_KEY` check with a config check. The function signature is unchanged.

Change lines 1–5 from:
```typescript
import { anthropic } from './claude'
```
to:
```typescript
import { getAnthropic } from './claude'
import { getConfig } from './config'
```

Change lines 62–67 from:
```typescript
export async function getRecommendations(
  criterionOnly: boolean
): Promise<RecommendationsResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const userNames = getUserNames()
```
to:
```typescript
export async function getRecommendations(
  criterionOnly: boolean
): Promise<RecommendationsResult> {
  const config = await getConfig()
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key is not configured')
  }

  const userNames = await getUserNames()
```

Change line 160 from:
```typescript
  const stream = anthropic.messages.stream({
```
to:
```typescript
  const anthropic = await getAnthropic()
  const stream = anthropic.messages.stream({
```

- [ ] **Step 2: Update `src/app/api/recommendations/route.ts`**

Remove the redundant `process.env.ANTHROPIC_API_KEY` guard — the `getRecommendations()` function now throws if the key is missing, and the route's existing `catch` block handles it:

```typescript
// src/app/api/recommendations/route.ts
import { NextResponse } from 'next/server'
import { getRecommendations } from '@/lib/recommendations'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const criterionOnly: boolean = body?.criterionOnly === true

  try {
    const result = await getRecommendations(criterionOnly)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not configured') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
```

- [ ] **Step 3: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/recommendations.ts src/app/api/recommendations/route.ts
git commit -m "feat: recommendations reads Anthropic key from DB config"
```

---

## Task 11: Update `src/app/api/user-names/route.ts` and `src/app/watched/page.tsx`

**Files:**
- Modify: `src/app/api/user-names/route.ts`
- Modify: `src/app/watched/page.tsx`

- [ ] **Step 1: Add `await` to `user-names` route**

```typescript
// src/app/api/user-names/route.ts
import { NextResponse } from 'next/server'
import { getUserNames } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getUserNames())
}
```

- [ ] **Step 2: Update `watched/page.tsx`**

`getUserNames()` is now async. `NEXT_PUBLIC_SEERR_URL` moves to `getConfig()`:

```typescript
// src/app/watched/page.tsx
import { prisma } from '@/lib/db'
import { getUserNames } from '@/lib/users'
import { getConfig } from '@/lib/config'
import { WatchedClient } from '@/components/watched-client'
import type { Movie } from '@/types'

export const dynamic = 'force-dynamic'

export default async function WatchedPage() {
  const [movies, userNames, config] = await Promise.all([
    prisma.movie.findMany({
      where: { status: 'watched' },
      orderBy: { watchedAt: 'desc' },
      include: { ratings: true },
    }),
    getUserNames(),
    getConfig(),
  ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Watched</h1>
      <WatchedClient
        movies={movies as Movie[]}
        userNames={userNames}
        seerrUrl={config.seerrPublicUrl || null}
      />
    </div>
  )
}
```

- [ ] **Step 3: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user-names/route.ts src/app/watched/page.tsx
git commit -m "feat: user-names route and watched page use async getUserNames + DB config"
```

---

## Task 12: Create `src/components/settings-form.tsx`

**Files:**
- Create: `src/components/settings-form.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/settings-form.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Field {
  key: string
  label: string
  sensitive?: boolean
  placeholder?: string
  hint?: string
  hintUrl?: string
  hintLinkText?: string
  hintSuffix?: string
  badge?: 'required' | 'optional'
}

interface Row {
  fields: Field[]
}

interface Section {
  title: string
  icon: string
  description?: string
  rows: Row[]
}

const SECTIONS: Section[] = [
  {
    title: 'General',
    icon: '👥',
    rows: [
      {
        fields: [
          { key: 'user1_name', label: 'User 1 Name', placeholder: 'User 1', hint: 'Name shown on rating buttons' },
          { key: 'user2_name', label: 'User 2 Name', placeholder: 'User 2', hint: 'Name shown on rating buttons' },
        ],
      },
    ],
  },
  {
    title: 'TMDB',
    icon: '🎬',
    description: 'Required for Add Movie',
    rows: [
      {
        fields: [
          {
            key: 'tmdb_api_key',
            label: 'API Key',
            sensitive: true,
            badge: 'required',
            hint: 'Get a free key at',
            hintUrl: 'https://developer.themoviedb.org/docs/getting-started',
            hintLinkText: 'themoviedb.org',
          },
        ],
      },
    ],
  },
  {
    title: 'Seerr',
    icon: '📥',
    description: 'Optional — for auto-requesting downloads',
    rows: [
      {
        fields: [
          { key: 'seerr_url', label: 'Server URL', placeholder: 'http://seerr:5055', hint: 'Internal server URL (for API calls)' },
          { key: 'seerr_public_url', label: 'Public URL', placeholder: 'http://192.168.1.x:5055', hint: 'Browser-accessible URL for links in UI', badge: 'optional' },
        ],
      },
      {
        fields: [
          { key: 'seerr_api_key', label: 'API Key', sensitive: true, hint: 'Settings → API Key in Seerr UI' },
          { key: 'seerr_concurrency', label: 'Concurrency', placeholder: 'blank = unlimited, 0 = disabled', hint: 'Max concurrent auto-requests', badge: 'optional' },
        ],
      },
    ],
  },
  {
    title: 'Plex',
    icon: '📺',
    description: 'Optional — for Date Night collection sync',
    rows: [
      {
        fields: [
          { key: 'plex_url', label: 'Server URL', placeholder: 'http://plex:32400' },
          { key: 'plex_token', label: 'Token', sensitive: true },
        ],
      },
    ],
  },
  {
    title: 'Anthropic',
    icon: '🤖',
    description: 'Optional — for Recommendations feature',
    rows: [
      {
        fields: [
          {
            key: 'anthropic_api_key',
            label: 'API Key',
            sensitive: true,
            placeholder: 'sk-ant-…',
            hint: 'Get a key at',
            hintUrl: 'https://console.anthropic.com/',
            hintLinkText: 'console.anthropic.com',
            hintSuffix: '— leave blank to disable recommendations.',
          },
        ],
      },
    ],
  },
]

interface SettingsFormProps {
  initialValues: Record<string, string>
  redirectTo?: string
  submitLabel?: string
}

export function SettingsForm({
  initialValues,
  redirectTo,
  submitLabel = 'Save Settings',
}: SettingsFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function toggleReveal(key: string) {
    setRevealed((r) => ({ ...r, [key]: !r[key] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (redirectTo) router.push(redirectTo)
  }

  return (
    <form onSubmit={handleSubmit}>
      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className="bg-white rounded-xl border border-amber-200 mb-5 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
            <span className="text-base">{section.icon}</span>
            <span className="font-semibold text-sm text-amber-900">{section.title}</span>
            {section.description && (
              <span className="ml-auto text-xs text-amber-600">{section.description}</span>
            )}
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            {section.rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className={row.fields.length === 2 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1'}
              >
                {row.fields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={field.key}
                        className="text-xs font-semibold text-amber-900 uppercase tracking-wide"
                      >
                        {field.label}
                      </label>
                      {field.badge === 'required' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          required
                        </span>
                      )}
                      {field.badge === 'optional' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          optional
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type={field.sensitive && !revealed[field.key] ? 'password' : 'text'}
                        value={values[field.key] ?? ''}
                        onChange={(e) => set(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`bg-amber-50 border-amber-200 focus:border-amber-500 ${
                          field.sensitive ? 'pr-9' : ''
                        }`}
                      />
                      {field.sensitive && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(field.key)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700 text-sm"
                          title={revealed[field.key] ? 'Hide' : 'Reveal'}
                        >
                          {revealed[field.key] ? '🙈' : '👁'}
                        </button>
                      )}
                    </div>
                    {(field.hint || field.hintUrl) && (
                      <p className="text-xs text-amber-600">
                        {field.hint}{field.hint && field.hintUrl ? ' ' : ''}
                        {field.hintUrl && (
                          <a
                            href={field.hintUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-amber-700 hover:underline"
                          >
                            {field.hintLinkText ?? field.hintUrl} ↗
                          </a>
                        )}
                        {field.hintSuffix ? ` ${field.hintSuffix}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 pb-6">
        <p className="text-sm text-amber-600">
          Changes are saved to the database and take effect immediately.
        </p>
        <Button
          type="submit"
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Run full suite to confirm no regressions**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/settings-form.tsx
git commit -m "feat: add SettingsForm client component with reveal toggles"
```

---

## Task 13: Create `src/app/settings/page.tsx`

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

```tsx
// src/app/settings/page.tsx
import { prisma } from '@/lib/db'
import { ALL_DB_KEYS } from '@/lib/config'
import { SettingsForm } from '@/components/settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const initialValues = Object.fromEntries(ALL_DB_KEYS.map((k) => [k, map[k] ?? '']))

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-amber-900 mb-1">Settings</h1>
      <p className="text-sm text-amber-600 mb-8">Configure your Date Night app.</p>
      <SettingsForm initialValues={initialValues} />
    </div>
  )
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add /settings page"
```

---

## Task 14: Create `src/app/setup/page.tsx`

**Files:**
- Create: `src/app/setup/page.tsx`

- [ ] **Step 1: Create the setup page**

```tsx
// src/app/setup/page.tsx
import { prisma } from '@/lib/db'
import { ALL_DB_KEYS } from '@/lib/config'
import { SettingsForm } from '@/components/settings-form'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const initialValues = Object.fromEntries(ALL_DB_KEYS.map((k) => [k, map[k] ?? '']))

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8 p-5 bg-amber-100 border border-amber-300 rounded-xl">
        <h1 className="text-2xl font-bold text-amber-900 mb-1">Welcome to Date Night 🎬</h1>
        <p className="text-sm text-amber-700">
          Let&apos;s get you set up. Fill in the services you use — everything optional except the TMDB API key, which is needed to add movies.
        </p>
      </div>
      <SettingsForm
        initialValues={initialValues}
        redirectTo="/watchlist"
        submitLabel="Save & Get Started"
      />
    </div>
  )
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat: add /setup page for first-launch wizard"
```

---

## Task 15: Update `src/app/page.tsx` — setup redirect

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add setup check to root redirect**

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function Home() {
  const count = await prisma.setting.count()
  if (count === 0) {
    redirect('/setup')
  }
  redirect('/watchlist')
}
```

- [ ] **Step 2: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redirect to /setup on first launch when no settings exist"
```

---

## Task 16: Update sidebar and mobile nav

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-bottom-nav.tsx`

- [ ] **Step 1: Add Settings link to `src/components/sidebar.tsx`**

In `src/components/sidebar.tsx`, add a Settings link to the utility section. Replace the `{/* Utility links */}` section (lines 47–67):

```tsx
      {/* Utility links */}
      <div className="px-2 py-4 border-t border-amber-200 flex flex-col gap-1">
        <a
          href="https://www.criterion.com/shop/browse/list?q=&format=all"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
        >
          🎞️ Browse Criterion
        </a>
        <a
          href="https://www.imdb.com/search/title/?title_type=feature"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
        >
          🎬 Browse IMDB
        </a>
        <PlexSyncButton />
        <AskClaudeLink />
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors',
            pathname === '/settings' && 'bg-amber-100 font-semibold'
          )}
        >
          ⚙️ Settings
        </Link>
      </div>
```

- [ ] **Step 2: Add Settings tab to `src/components/mobile-bottom-nav.tsx`**

In `src/components/mobile-bottom-nav.tsx`, add `{ href: '/settings', label: 'Settings', icon: '⚙️' }` to the `tabs` array:

```tsx
const tabs = [
  { href: '/watchlist', label: 'List',     icon: '📋' },
  { href: '/watched',   label: 'Watched',  icon: '✅' },
  { href: '/add',       label: 'Add',      icon: '➕' },
  { href: '/recommendations', label: 'Recs', icon: '🎯' },
  { href: '/settings',  label: 'Settings', icon: '⚙️' },
]
```

- [ ] **Step 3: Run full suite**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar.tsx src/components/mobile-bottom-nav.tsx
git commit -m "feat: add Settings link to sidebar and mobile nav"
```

---

## Task 17: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Strip all vars except `DATABASE_URL`**

```bash
# Date Night — environment variables
# Copy this file to .env.local for local development.
# In Docker, pass DATABASE_URL via docker-compose.yml or docker run -e flags.

# Path to the SQLite database file.
# Local dev: file:./data/datenight.db
# Docker:    file:/app/data/datenight.db  (mounted volume)
DATABASE_URL=file:/app/data/datenight.db

# All other configuration (API keys, service URLs, user names) is managed
# through the Settings page in the app UI.
# On first launch, you will be redirected to /setup to configure the app.
```

Also remove all non-`DATABASE_URL` vars from your local `.env.local` file — they are no longer read by the app.

- [ ] **Step 2: Run full suite one final time**

```bash
npm run test:run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: strip .env.example down to DATABASE_URL only"
```

---

## Done

At this point:
- All configuration reads from the `Setting` table via `getConfig()`
- `GET /api/settings` + `PUT /api/settings` manage the settings
- `/setup` is shown on first launch (empty DB)
- `/settings` is reachable from sidebar and mobile nav
- Sensitive fields (4 API keys) are masked by default with a reveal toggle
- No env vars beyond `DATABASE_URL` are used anywhere in the app
