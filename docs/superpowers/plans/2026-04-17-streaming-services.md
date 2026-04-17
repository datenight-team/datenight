# Streaming Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add streaming service awareness to the watchlist — users configure which services they subscribe to, TMDB Watch Providers data shows which movies are streamable, and the UI surfaces "Watch on X" buttons and a Streamable filter.

**Architecture:** New `StreamingProvider` Prisma model stores per-movie provider records; `src/lib/streaming.ts` owns sync logic (triggered on movie add + 12h cron); the watchlist client filters providers against the user's configured service IDs from config.

**Tech Stack:** Prisma (SQLite), TMDB Watch Providers API, Next.js API routes, React (client components), node-cron, Vitest

---

## File Map

**Create:**
- `src/lib/streaming.ts` — downloadProviderLogo, syncMovieProviders, refreshStaleProviders, startStreamingRefreshJob
- `src/app/api/streaming-providers/route.ts` — GET handler returning provider list for configured region
- `tests/streaming.test.ts` — unit tests for streaming lib
- `public/streaming-logos/` — directory for cached logo PNGs (created at runtime by streaming lib)

**Modify:**
- `prisma/schema.prisma` — add `StreamingProvider` model, add `streamingLastChecked`/`streamingLink` to `Movie`
- `src/types/index.ts` — add `StreamingProvider` type, extend `Movie` type
- `src/lib/tmdb.ts` — add `fetchWatchProviders`, `fetchProviderList`, export `WatchProvider`/`WatchProviders` types
- `src/lib/config.ts` — add `streamingRegion`, `streamingServices` to `AppConfig`
- `src/app/api/movies/route.ts` — include `streamingProviders` in GET, trigger sync on POST
- `src/app/api/config/route.ts` — add `streamingRegion`, `streamingServices` to response
- `src/components/settings-form.tsx` — add Streaming section (region input + provider checkboxes)
- `src/components/movie-row.tsx` — replace action column with two-pill + stream buttons + revised actions
- `src/app/watchlist/page.tsx` — add Streamable filter, parse streaming config, pass providers to MovieRow
- `server.ts` — call `startStreamingRefreshJob()` alongside existing sync job
- `tests/tmdb.test.ts` — add tests for fetchWatchProviders + fetchProviderList
- `tests/config.test.ts` — add streaming fields to existing assertions
- `tests/sync.test.ts` — add streaming fields to mockConfig
- `tests/api.movies.test.ts` — mock streaming lib, add streamingProviders to movie fixture

---

### Task 1: Schema + Migration + Types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update prisma/schema.prisma**

Add the `StreamingProvider` model and two new fields to `Movie`. The full updated schema:

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "library"
}

datasource db {
  provider = "sqlite"
}

model Movie {
  id                   Int                  @id @default(autoincrement())
  title                String
  year                 Int
  runtime              Int
  description          String
  posterUrl            String
  imdbId               String               @unique
  tmdbId               Int                  @unique
  criterionUrl         String?
  imdbUrl              String?
  sortOrder            Int
  status               String               @default("watchlist")
  seerrRequestId       String?
  seerrMediaId         String?
  seerrStatus          String               @default("not_requested")
  watchedAt            DateTime?
  createdAt            DateTime             @default(now())
  streamingLastChecked DateTime?
  streamingLink        String?
  ratings              Rating[]
  streamingProviders   StreamingProvider[]
}

model Rating {
  id          Int      @id @default(autoincrement())
  movieId     Int
  user        String
  rating      String
  quote       String
  submittedAt DateTime @default(now())
  movie       Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)

  @@unique([movieId, user])
}

model Setting {
  key   String @id
  value String
}

model StreamingProvider {
  id           Int    @id @default(autoincrement())
  movieId      Int
  providerId   Int
  providerName String
  movie        Movie  @relation(fields: [movieId], references: [id], onDelete: Cascade)

  @@unique([movieId, providerId])
}
```

- [ ] **Step 2: Run migration**

```bash
cd /home/user/src/ianchesal/datenight
npx prisma migrate dev --name add-streaming-providers
```

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 3: Update src/types/index.ts**

Add the `StreamingProvider` interface and extend `Movie`:

```typescript
// src/types/index.ts

export type MovieStatus = 'watchlist' | 'watched'

export type SeerrStatus =
  | 'not_requested'
  | 'pending'
  | 'processing'
  | 'available'
  | 'deleted'

export type User = 'user1' | 'user2'

export type RatingValue = 'up' | 'down'

export interface StreamingProvider {
  id: number
  movieId: number
  providerId: number
  providerName: string
}

export interface Movie {
  id: number
  title: string
  year: number
  runtime: number
  description: string
  posterUrl: string
  imdbId: string
  tmdbId: number
  criterionUrl?: string | null
  imdbUrl?: string | null
  sortOrder: number
  status: MovieStatus
  seerrRequestId?: string | null
  seerrMediaId?: string | null
  seerrStatus: SeerrStatus
  watchedAt?: Date | string | null
  createdAt: Date | string
  streamingLastChecked?: Date | string | null
  streamingLink?: string | null
  streamingProviders?: StreamingProvider[]
  ratings?: Rating[]
}

export interface Rating {
  id: number
  movieId: number
  user: User
  rating: RatingValue
  quote: string
  submittedAt: Date | string
}

export interface TmdbMovieDetails {
  tmdbId: number
  title: string
  year: number
  runtime: number
  description: string
  posterUrl: string
  imdbId: string
}

export interface MoviePreview extends TmdbMovieDetails {
  criterionUrl?: string
  imdbUrl?: string
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/types/index.ts
git commit -m "feat: add StreamingProvider schema and streaming fields to Movie"
```

---

### Task 2: TMDB — fetchWatchProviders + fetchProviderList

**Files:**
- Modify: `src/lib/tmdb.ts`
- Modify: `tests/tmdb.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/tmdb.test.ts` (after the existing imports and before closing):

```typescript
// Add to the existing import line at the top of the file:
// const { findByImdbId, searchByTitle, lookupCriterionSlug, fetchWatchProviders, fetchProviderList } = await import('@/lib/tmdb')
// Replace the existing dynamic import line with:
const { findByImdbId, searchByTitle, lookupCriterionSlug, fetchWatchProviders, fetchProviderList } = await import('@/lib/tmdb')
```

Then append these describe blocks at the bottom of `tests/tmdb.test.ts`:

```typescript
describe('fetchWatchProviders', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns flatrate providers for the given region', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          US: {
            link: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
            flatrate: [
              { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
              { provider_id: 337, provider_name: 'Disney+', logo_path: '/disney.jpg' },
            ],
          },
        },
      }),
    })
    const result = await fetchWatchProviders(345911, 'US')
    expect(result).toEqual({
      link: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
      flatrate: [
        { providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg' },
        { providerId: 337, providerName: 'Disney+', logoPath: '/disney.jpg' },
      ],
    })
  })

  it('returns null when region has no providers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: {} }),
    })
    expect(await fetchWatchProviders(345911, 'ZZ')).toBeNull()
  })

  it('returns null when TMDB key is not configured', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, tmdbApiKey: '' })
    expect(await fetchWatchProviders(345911, 'US')).toBeNull()
  })

  it('returns null on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await fetchWatchProviders(345911, 'US')).toBeNull()
  })
})

describe('fetchProviderList', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns list of providers for the region', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
          { provider_id: 337, provider_name: 'Disney+', logo_path: '/disney.jpg' },
        ],
      }),
    })
    const result = await fetchProviderList('US')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg' })
    expect(result[1]).toEqual({ providerId: 337, providerName: 'Disney+', logoPath: '/disney.jpg' })
  })

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await fetchProviderList('US')).toEqual([])
  })

  it('returns empty array when TMDB key is not configured', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, tmdbApiKey: '' })
    expect(await fetchProviderList('US')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/tmdb.test.ts 2>&1 | tail -15
```

Expected: FAIL — `fetchWatchProviders is not a function` (or similar).

- [ ] **Step 3: Add the two functions to src/lib/tmdb.ts**

Append after the last export in `src/lib/tmdb.ts`:

```typescript
export interface WatchProvider {
  providerId: number
  providerName: string
  logoPath: string
}

export interface WatchProviders {
  link: string
  flatrate: WatchProvider[]
}

export async function fetchWatchProviders(
  tmdbId: number,
  region: string
): Promise<WatchProviders | null> {
  const { tmdbApiKey } = await getConfig()
  if (!tmdbApiKey) return null
  const res = await fetch(`${BASE}/movie/${tmdbId}/watch/providers?api_key=${tmdbApiKey}`)
  if (!res.ok) return null
  const data = await res.json()
  const regional = data.results?.[region]
  if (!regional) return null
  return {
    link: regional.link ?? '',
    flatrate: (regional.flatrate ?? []).map(
      (p: { provider_id: number; provider_name: string; logo_path: string }) => ({
        providerId: p.provider_id,
        providerName: p.provider_name,
        logoPath: p.logo_path,
      })
    ),
  }
}

export async function fetchProviderList(region: string): Promise<WatchProvider[]> {
  const { tmdbApiKey } = await getConfig()
  if (!tmdbApiKey) return []
  const res = await fetch(
    `${BASE}/watch/providers/movie?api_key=${tmdbApiKey}&watch_region=${encodeURIComponent(region)}`
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map(
    (p: { provider_id: number; provider_name: string; logo_path: string }) => ({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoPath: p.logo_path,
    })
  )
}
```

Also update the dynamic import line in `tests/tmdb.test.ts` to include the new exports (the line that starts with `const {`):

```typescript
const { findByImdbId, searchByTitle, lookupCriterionSlug, fetchWatchProviders, fetchProviderList } = await import('@/lib/tmdb')
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/tmdb.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb.ts tests/tmdb.test.ts
git commit -m "feat: add fetchWatchProviders and fetchProviderList to tmdb lib"
```

---

### Task 3: Config — add streamingRegion + streamingServices

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `tests/config.test.ts`
- Modify: `tests/sync.test.ts` (mockConfig update)
- Modify: `tests/tmdb.test.ts` (mockConfig update)

- [ ] **Step 1: Update src/lib/config.ts**

Replace the full file:

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
  streamingRegion: string
  streamingServices: string
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
  streamingRegion: 'US',
  streamingServices: '[]',
}

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
  streamingRegion: 'streaming_region',
  streamingServices: 'streaming_services',
}

const DB_TO_CONFIG = Object.fromEntries(
  Object.entries(KEY_MAP).map(([configKey, dbKey]) => [dbKey, configKey as keyof AppConfig])
) as Record<string, keyof AppConfig>

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

- [ ] **Step 2: Update tests/config.test.ts**

Replace the last `it('maps all ten DB keys...')` test with two new tests:

```typescript
  it('returns streaming defaults when no settings exist', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])
    const config = await getConfig()
    expect(config.streamingRegion).toBe('US')
    expect(config.streamingServices).toBe('[]')
  })

  it('maps all twelve DB keys to AppConfig fields', async () => {
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
      { key: 'streaming_region', value: 'GB' },
      { key: 'streaming_services', value: '[8,337]' },
    ])
    const config = await getConfig()
    expect(config.streamingRegion).toBe('GB')
    expect(config.streamingServices).toBe('[8,337]')
    expect(config.user1Name).toBe('A')
    expect(config.anthropicApiKey).toBe('I')
  })
```

- [ ] **Step 3: Add streaming fields to mockConfig in tests/sync.test.ts**

```typescript
const mockConfig = {
  seerrConcurrency: '',
  user1Name: 'User 1', user2Name: 'User 2',
  tmdbApiKey: '', seerrUrl: '', seerrPublicUrl: '', seerrApiKey: '',
  plexUrl: '', plexToken: '', anthropicApiKey: '',
  streamingRegion: 'US', streamingServices: '[]',
}
```

- [ ] **Step 4: Add streaming fields to mockConfig in tests/tmdb.test.ts**

```typescript
const mockConfig = {
  tmdbApiKey: 'test-key',
  user1Name: 'User 1', user2Name: 'User 2',
  seerrUrl: '', seerrPublicUrl: '', seerrApiKey: '', seerrConcurrency: '',
  plexUrl: '', plexToken: '', anthropicApiKey: '',
  streamingRegion: 'US', streamingServices: '[]',
}
```

- [ ] **Step 5: Run tests to verify everything passes**

```bash
npm run test:run -- tests/config.test.ts tests/sync.test.ts tests/tmdb.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/config.ts tests/config.test.ts tests/sync.test.ts tests/tmdb.test.ts
git commit -m "feat: add streamingRegion and streamingServices to app config"
```

---

### Task 4: Streaming Lib — sync logic + tests

**Files:**
- Create: `src/lib/streaming.ts`
- Create: `tests/streaming.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/streaming.test.ts`:

```typescript
// tests/streaming.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    movie: { update: vi.fn(), findMany: vi.fn() },
    streamingProvider: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}))

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}))

vi.mock('@/lib/tmdb', () => ({
  fetchWatchProviders: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { access, writeFile } from 'fs/promises'
import { prisma } from '@/lib/db'
import { getConfig } from '@/lib/config'
import { fetchWatchProviders } from '@/lib/tmdb'
import { downloadProviderLogo, syncMovieProviders, refreshStaleProviders } from '@/lib/streaming'

const mockConfig = {
  streamingRegion: 'US',
  streamingServices: '[8]',
  user1Name: 'User 1', user2Name: 'User 2',
  tmdbApiKey: 'test-key', seerrUrl: '', seerrPublicUrl: '', seerrApiKey: '',
  seerrConcurrency: '', plexUrl: '', plexToken: '', anthropicApiKey: '',
}

describe('downloadProviderLogo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips download when file already exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined)
    await downloadProviderLogo(8, '/netflix.jpg')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('downloads and writes file when it does not exist', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    })
    await downloadProviderLogo(8, '/netflix.jpg')
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('8.png'),
      expect.any(Buffer)
    )
  })

  it('does not throw when download fetch fails', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    mockFetch.mockResolvedValue({ ok: false })
    await expect(downloadProviderLogo(8, '/netflix.jpg')).resolves.not.toThrow()
  })
})

describe('syncMovieProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    mockFetch.mockResolvedValue({ ok: false })
  })

  it('only updates streamingLastChecked when TMDB returns no data', async () => {
    vi.mocked(fetchWatchProviders).mockResolvedValue(null)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await syncMovieProviders(1, 345911)

    expect(prisma.streamingProvider.deleteMany).not.toHaveBeenCalled()
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { streamingLastChecked: expect.any(Date) },
    })
  })

  it('deletes old providers and inserts fresh ones when TMDB returns data', async () => {
    vi.mocked(fetchWatchProviders).mockResolvedValue({
      link: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
      flatrate: [{ providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg' }],
    })
    vi.mocked(prisma.streamingProvider.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.streamingProvider.createMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await syncMovieProviders(1, 345911)

    expect(prisma.streamingProvider.deleteMany).toHaveBeenCalledWith({ where: { movieId: 1 } })
    expect(prisma.streamingProvider.createMany).toHaveBeenCalledWith({
      data: [{ movieId: 1, providerId: 8, providerName: 'Netflix' }],
    })
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        streamingLastChecked: expect.any(Date),
        streamingLink: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
      },
    })
  })

  it('skips createMany when flatrate list is empty', async () => {
    vi.mocked(fetchWatchProviders).mockResolvedValue({ link: 'https://tmdb.org', flatrate: [] })
    vi.mocked(prisma.streamingProvider.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await syncMovieProviders(1, 345911)

    expect(prisma.streamingProvider.deleteMany).toHaveBeenCalled()
    expect(prisma.streamingProvider.createMany).not.toHaveBeenCalled()
  })
})

describe('refreshStaleProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('queries movies with null or stale streamingLastChecked', async () => {
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])

    await refreshStaleProviders()

    expect(prisma.movie.findMany).toHaveBeenCalledWith({
      where: {
        status: 'watchlist',
        OR: [
          { streamingLastChecked: null },
          { streamingLastChecked: { lt: expect.any(Date) } },
        ],
      },
      select: { id: true, tmdbId: true },
    })
  })

  it('calls syncMovieProviders for each stale movie', async () => {
    vi.mocked(prisma.movie.findMany).mockResolvedValue([
      { id: 1, tmdbId: 345911 },
      { id: 2, tmdbId: 11216 },
    ] as any)
    vi.mocked(fetchWatchProviders).mockResolvedValue(null)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await refreshStaleProviders()

    expect(prisma.movie.update).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/streaming.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/lib/streaming'`.

- [ ] **Step 3: Create src/lib/streaming.ts**

```typescript
// src/lib/streaming.ts
import { writeFile, access, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from './db'
import { getConfig } from './config'
import { fetchWatchProviders } from './tmdb'

const LOGOS_DIR = join(process.cwd(), 'public', 'streaming-logos')
const STALE_HOURS = 12

export async function downloadProviderLogo(providerId: number, logoPath: string): Promise<void> {
  await mkdir(LOGOS_DIR, { recursive: true })
  const filePath = join(LOGOS_DIR, `${providerId}.png`)
  try {
    await access(filePath)
    return
  } catch {
    // file does not exist — download it
  }
  try {
    const res = await fetch(`https://image.tmdb.org/t/p/w45${logoPath}`)
    if (!res.ok) return
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(filePath, buf)
  } catch {
    // non-fatal: logo download failure is logged by caller
  }
}

export async function syncMovieProviders(movieId: number, tmdbId: number): Promise<void> {
  const { streamingRegion } = await getConfig()
  const region = streamingRegion || 'US'
  const now = new Date()

  const data = await fetchWatchProviders(tmdbId, region)

  if (!data) {
    await prisma.movie.update({
      where: { id: movieId },
      data: { streamingLastChecked: now },
    })
    return
  }

  await Promise.all(
    data.flatrate.map((p) =>
      downloadProviderLogo(p.providerId, p.logoPath).catch(() => {})
    )
  )

  await prisma.streamingProvider.deleteMany({ where: { movieId } })
  if (data.flatrate.length > 0) {
    await prisma.streamingProvider.createMany({
      data: data.flatrate.map((p) => ({
        movieId,
        providerId: p.providerId,
        providerName: p.providerName,
      })),
    })
  }

  await prisma.movie.update({
    where: { id: movieId },
    data: { streamingLastChecked: now, streamingLink: data.link },
  })
}

export async function refreshStaleProviders(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)
  const movies = await prisma.movie.findMany({
    where: {
      status: 'watchlist',
      OR: [{ streamingLastChecked: null }, { streamingLastChecked: { lt: cutoff } }],
    },
    select: { id: true, tmdbId: true },
  })
  await Promise.all(
    movies.map((m) =>
      syncMovieProviders(m.id, m.tmdbId).catch((err) =>
        console.error(`[streaming] Error syncing movie ${m.id}:`, err)
      )
    )
  )
}

export function startStreamingRefreshJob(): void {
  import('node-cron').then(({ default: cron }) => {
    cron.schedule('0 */12 * * *', async () => {
      console.log('[streaming] Refreshing stale providers...')
      try {
        await refreshStaleProviders()
        console.log('[streaming] Done')
      } catch (err) {
        console.error('[streaming] Error:', err)
      }
    })
    console.log('[streaming] Refresh job started (every 12h)')
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/streaming.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streaming.ts tests/streaming.test.ts
git commit -m "feat: add streaming lib with sync, logo download, and cron job"
```

---

### Task 5: Movies API — streamingProviders in GET + sync trigger on POST

**Files:**
- Modify: `src/app/api/movies/route.ts`
- Modify: `tests/api.movies.test.ts`

- [ ] **Step 1: Update src/app/api/movies/route.ts**

Replace the full file:

```typescript
// src/app/api/movies/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncMovieProviders } from '@/lib/streaming'

export async function GET() {
  const movies = await prisma.movie.findMany({
    where: { status: 'watchlist' },
    orderBy: { sortOrder: 'asc' },
    include: { ratings: true, streamingProviders: true },
  })
  return NextResponse.json(movies)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { _max } = await prisma.movie.aggregate({ _max: { sortOrder: true } })
  const nextOrder = (_max.sortOrder ?? 0) + 1

  const movie = await prisma.movie.create({
    data: {
      title: body.title,
      year: body.year,
      runtime: body.runtime,
      description: body.description,
      posterUrl: body.posterUrl,
      imdbId: body.imdbId,
      tmdbId: body.tmdbId,
      imdbUrl: body.imdbUrl ?? null,
      criterionUrl: body.criterionUrl ?? null,
      sortOrder: nextOrder,
    },
  })

  syncMovieProviders(movie.id, movie.tmdbId).catch((err) =>
    console.error('[streaming] Failed to sync providers for new movie:', err)
  )

  return NextResponse.json(movie, { status: 201 })
}
```

- [ ] **Step 2: Update tests/api.movies.test.ts**

Add the streaming lib mock and update the movie fixture. At the top of the file, add to the existing mocks:

```typescript
vi.mock('@/lib/streaming', () => ({ syncMovieProviders: vi.fn().mockResolvedValue(undefined) }))
```

Update the `movie` fixture to include streaming fields:

```typescript
const movie = {
  id: 1, title: 'Seven Samurai', year: 1954, runtime: 207,
  description: 'A poor village...', posterUrl: 'https://img/p.jpg',
  imdbId: 'tt0047478', tmdbId: 345911, criterionUrl: null, imdbUrl: null,
  sortOrder: 1, status: 'watchlist', seerrRequestId: null, seerrMediaId: null,
  seerrStatus: 'not_requested', watchedAt: null,
  streamingLastChecked: null, streamingLink: null, streamingProviders: [],
  createdAt: new Date(), ratings: [],
}
```

Add a test for the POST sync trigger in the `describe('POST /api/movies')` block:

```typescript
  it('triggers streaming provider sync after creating movie', async () => {
    const { syncMovieProviders } = await import('@/lib/streaming')
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 2 } } as any)
    vi.mocked(prisma.movie.create).mockResolvedValue({ ...movie, sortOrder: 3 } as any)
    const req = new Request('http://localhost/api/movies', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Seven Samurai', year: 1954, runtime: 207,
        description: 'A poor village...', posterUrl: 'https://img/p.jpg',
        imdbId: 'tt0047478', tmdbId: 345911,
      }),
    })
    await POST(req)
    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0))
    expect(syncMovieProviders).toHaveBeenCalledWith(1, 345911)
  })
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- tests/api.movies.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/movies/route.ts tests/api.movies.test.ts
git commit -m "feat: include streamingProviders in movies API and trigger sync on add"
```

---

### Task 6: Config API + Streaming Providers Route

**Files:**
- Modify: `src/app/api/config/route.ts`
- Create: `src/app/api/streaming-providers/route.ts`

- [ ] **Step 1: Update src/app/api/config/route.ts**

Replace the full file:

```typescript
// src/app/api/config/route.ts
import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { seerrPublicUrl, streamingRegion, streamingServices } = await getConfig()
  return NextResponse.json({
    seerrUrl: seerrPublicUrl || null,
    streamingRegion: streamingRegion || 'US',
    streamingServices,
  })
}
```

- [ ] **Step 2: Create src/app/api/streaming-providers/route.ts**

```typescript
// src/app/api/streaming-providers/route.ts
import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { fetchProviderList } from '@/lib/tmdb'
import { downloadProviderLogo } from '@/lib/streaming'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { streamingRegion } = await getConfig()
  const region = streamingRegion || 'US'
  const providers = await fetchProviderList(region)

  providers.forEach((p) =>
    downloadProviderLogo(p.providerId, p.logoPath).catch(() => {})
  )

  return NextResponse.json(providers)
}
```

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npm run test:run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/config/route.ts src/app/api/streaming-providers/route.ts
git commit -m "feat: expose streaming config in /api/config and add /api/streaming-providers route"
```

---

### Task 7: Server — 12h Refresh Cron

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Update server.ts**

Replace the full file:

```typescript
// server.ts
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const port = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  if (!dev) {
    const { startSyncJob } = await import('./src/lib/sync')
    startSyncJob()
    const { startStreamingRefreshJob } = await import('./src/lib/streaming')
    startStreamingRefreshJob()
  }

  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: start streaming refresh cron job (every 12h) in production"
```

---

### Task 8: Settings UI — Streaming Section

**Files:**
- Modify: `src/components/settings-form.tsx`

- [ ] **Step 1: Update src/components/settings-form.tsx**

Add `useEffect` to the React import and add the streaming section. The full updated file:

```typescript
// src/components/settings-form.tsx
'use client'
import { useState, useEffect } from 'react'
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

interface StreamingProviderOption {
  providerId: number
  providerName: string
  logoPath: string
}

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
  const [providers, setProviders] = useState<StreamingProviderOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)

  useEffect(() => {
    setLoadingProviders(true)
    fetch('/api/streaming-providers')
      .then((r) => r.json())
      .then((data) => setProviders(data))
      .catch(() => {})
      .finally(() => setLoadingProviders(false))
  }, [])

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function toggleReveal(key: string) {
    setRevealed((r) => ({ ...r, [key]: !r[key] }))
  }

  function getSelectedProviderIds(): number[] {
    try {
      return JSON.parse(values['streaming_services'] || '[]')
    } catch {
      return []
    }
  }

  function toggleProvider(providerId: number) {
    const current = getSelectedProviderIds()
    const updated = current.includes(providerId)
      ? current.filter((id) => id !== providerId)
      : [...current, providerId]
    set('streaming_services', JSON.stringify(updated))
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

      {/* Streaming section — custom layout (provider checkboxes don't fit the text-field pattern) */}
      <div className="bg-white rounded-xl border border-amber-200 mb-5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
          <span className="text-base">▶️</span>
          <span className="font-semibold text-sm text-amber-900">Streaming</span>
          <span className="ml-auto text-xs text-amber-600">Optional — for streaming availability</span>
        </div>
        <div className="px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="streaming_region"
              className="text-xs font-semibold text-amber-900 uppercase tracking-wide"
            >
              Region
            </label>
            <Input
              id="streaming_region"
              type="text"
              value={values['streaming_region'] ?? 'US'}
              onChange={(e) => set('streaming_region', e.target.value.toUpperCase())}
              placeholder="US"
              className="bg-amber-50 border-amber-200 focus:border-amber-500 w-20"
            />
            <p className="text-xs text-amber-600">
              ISO 3166-1 alpha-2 code (e.g. US, GB, AU). Determines which streaming services are shown.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Your Streaming Services
            </span>
            {loadingProviders ? (
              <p className="text-xs text-amber-600">Loading providers…</p>
            ) : providers.length === 0 ? (
              <p className="text-xs text-amber-600">
                No providers found. Check your TMDB API key and region above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {providers.map((p) => {
                  const selected = getSelectedProviderIds().includes(p.providerId)
                  return (
                    <button
                      key={p.providerId}
                      type="button"
                      onClick={() => toggleProvider(p.providerId)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      <img
                        src={`/streaming-logos/${p.providerId}.png`}
                        alt=""
                        width={16}
                        height={16}
                        className="rounded-sm object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      {p.providerName}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-amber-600">
              Select the services you subscribe to. Movies available on these services will show Watch buttons.
            </p>
          </div>
        </div>
      </div>

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

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings-form.tsx
git commit -m "feat: add Streaming section to settings form with region and provider checkboxes"
```

---

### Task 9: MovieRow — Two Pills + Stream Buttons + Revised Actions

**Files:**
- Modify: `src/components/movie-row.tsx`

- [ ] **Step 1: Replace src/components/movie-row.tsx**

```typescript
// src/components/movie-row.tsx
"use client";
import { useState } from "react";
import { MoviePoster } from "./movie-poster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Movie } from "@/types";
import { formatRuntime } from "@/lib/utils";

const SEERR_LABEL: Record<string, string> = {
  not_requested: "Not Requested",
  pending: "Queued",
  processing: "Downloading",
  available: "Ready",
  deleted: "Deleted",
};

interface MovieRowProps {
  movie: Movie;
  position: number;
  seerrUrl?: string | null;
  streamingProviders: { providerId: number; providerName: string }[];
  streamingLink: string | null;
  onMarkWatched: (movie: Movie) => void;
  onForceDownload: (movieId: number) => void;
  onRemove: (movieId: number, opts: { seerr: boolean }) => void;
}

export function MovieRow({
  movie,
  position,
  seerrUrl,
  streamingProviders,
  streamingLink,
  onMarkWatched,
  onForceDownload,
  onRemove,
}: MovieRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [askSeerr, setAskSeerr] = useState(false);

  const isStreamable = streamingProviders.length > 0;

  const seerrPillClass =
    movie.seerrStatus === "available"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-stone-100 text-stone-500 border-stone-200";

  const handleConfirmRemove = () => {
    setConfirming(false);
    if (movie.seerrMediaId) {
      setAskSeerr(true);
    } else {
      onRemove(movie.id, { seerr: false });
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 bg-white border border-amber-200 rounded-xl px-4 py-3 mb-2 shadow-sm">
        {/* Position */}
        <span className="text-amber-700 font-bold text-sm w-5 text-center flex-shrink-0 pt-3">
          {position}
        </span>

        {/* Poster */}
        <div className="pt-1">
          <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="sm" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="font-semibold text-stone-900 text-sm truncate">
            {movie.title}
          </div>
          <div className="text-stone-400 text-xs flex items-center gap-1.5">
            <span>
              {movie.year} · {formatRuntime(movie.runtime)}
            </span>
            {seerrUrl && (
              <a
                href={`${seerrUrl}/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-500 hover:text-amber-700 transition-colors"
                title="View in Seerr"
              >
                ↗
              </a>
            )}
          </div>
        </div>

        {/* Actions column */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Row 1: Streaming pill + Seerr status pill */}
          <div className="flex gap-1.5 flex-wrap justify-end">
            {isStreamable ? (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200">
                Streaming
              </span>
            ) : (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-stone-100 text-stone-500 border-stone-200">
                Not Streaming
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${seerrPillClass}`}>
              {SEERR_LABEL[movie.seerrStatus] ?? movie.seerrStatus}
            </span>
          </div>

          {/* Row 2: Watch on X buttons (streamable only) */}
          {isStreamable && (
            <div className="flex gap-1 flex-wrap justify-end">
              {streamingProviders.map((p) => (
                <a
                  key={p.providerId}
                  href={streamingLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded border border-stone-600 bg-stone-800 text-white px-2 py-0.5 text-xs font-medium hover:bg-stone-700 transition-colors"
                >
                  <img
                    src={`/streaming-logos/${p.providerId}.png`}
                    alt=""
                    width={12}
                    height={12}
                    className="rounded-sm object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {p.providerName}
                </a>
              ))}
            </div>
          )}

          {/* Row 3: Action buttons */}
          <div className="flex gap-1">
            {isStreamable ? (
              <>
                <Button
                  size="sm"
                  className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => onMarkWatched(movie)}
                >
                  Mark Watched
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => onForceDownload(movie.id)}
                >
                  Download Now
                </Button>
              </>
            ) : movie.seerrStatus === "available" ? (
              <Button
                size="sm"
                className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => onMarkWatched(movie)}
              >
                Mark Watched
              </Button>
            ) : movie.seerrStatus === "not_requested" ||
              movie.seerrStatus === "pending" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => onForceDownload(movie.id)}
              >
                Download Now
              </Button>
            ) : null}
          </div>

          {/* Row 4: Remove (two-tap confirm) — always last */}
          {confirming ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleConfirmRemove}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-stone-200 text-stone-400 hover:bg-stone-50"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-stone-300 hover:text-red-400 text-xs transition-colors"
              aria-label="Remove from list"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Seerr cleanup dialog */}
      <Dialog open={askSeerr} onOpenChange={(o) => !o && setAskSeerr(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-amber-900">
              Remove from Plex too?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-stone-600">
              <em>{movie.title}</em> is in your Plex library. Remove it from
              Plex and Radarr as well?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setAskSeerr(false);
                  onRemove(movie.id, { seerr: true });
                }}
              >
                Yes, remove from Plex
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-stone-200 text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  setAskSeerr(false);
                  onRemove(movie.id, { seerr: false });
                }}
              >
                No, just the list
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/movie-row.tsx
git commit -m "feat: redesign MovieRow with streaming pills, Watch-on-X buttons, and revised action layout"
```

---

### Task 10: Watchlist Page — Streamable Filter

**Files:**
- Modify: `src/app/watchlist/page.tsx`

- [ ] **Step 1: Replace src/app/watchlist/page.tsx**

```typescript
// src/app/watchlist/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { MovieRow } from '@/components/movie-row'
import { RatingDialog } from '@/components/rating-dialog'
import { FilterBar } from '@/components/filter-bar'
import type { Movie, User, StreamingProvider } from '@/types'

const STATUS_BUTTONS = [
  { label: 'Not Requested', value: 'not_requested' },
  { label: 'Queued', value: 'pending' },
  { label: 'Downloading', value: 'processing' },
  { label: 'Ready', value: 'available' },
  { label: '▶ Streamable', value: 'streamable' },
]

const STATUS_ORDER: Record<string, number> = {
  available: 0,
  processing: 1,
  pending: 2,
  not_requested: 3,
}

function sortByStatus(movies: Movie[]): Movie[] {
  return [...movies].sort(
    (a, b) =>
      (STATUS_ORDER[a.seerrStatus] ?? 99) - (STATUS_ORDER[b.seerrStatus] ?? 99)
  )
}

function getMatchingProviders(
  movie: Movie,
  serviceIds: number[]
): StreamingProvider[] {
  return (movie.streamingProviders ?? []).filter((p) =>
    serviceIds.includes(p.providerId)
  )
}

export default function WatchlistPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null)
  const [userNames, setUserNames] = useState<Record<User, string>>({ user1: 'User 1', user2: 'User 2' })
  const [seerrUrl, setSeerrUrl] = useState<string | null>(null)
  const [streamingServiceIds, setStreamingServiceIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const fetchMovies = useCallback(async () => {
    const data = await fetch('/api/movies').then((r) => r.json())
    setMovies(sortByStatus(data))
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const [moviesData, namesData, configData] = await Promise.all([
          fetch('/api/movies', { signal: controller.signal }).then((r) => r.json()),
          fetch('/api/user-names', { signal: controller.signal }).then((r) => r.json()),
          fetch('/api/config', { signal: controller.signal }).then((r) => r.json()),
        ])
        setMovies(sortByStatus(moviesData))
        setUserNames(namesData)
        setSeerrUrl(configData.seerrUrl ?? null)
        try {
          setStreamingServiceIds(JSON.parse(configData.streamingServices || '[]'))
        } catch {
          setStreamingServiceIds([])
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        throw err
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  const lowerSearch = search.toLowerCase()
  const filteredMovies = movies.filter((m) => {
    if (!m.title.toLowerCase().includes(lowerSearch)) return false
    if (activeFilter === 'streamable') {
      return getMatchingProviders(m, streamingServiceIds).length > 0
    }
    return activeFilter === null || m.seerrStatus === activeFilter
  })

  const handleForceDownload = async (movieId: number) => {
    await fetch(`/api/movies/${movieId}/download`, { method: 'POST' })
    fetchMovies()
  }

  const handleRemove = async (movieId: number, opts: { seerr: boolean }) => {
    await fetch(`/api/movies/${movieId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seerr: opts.seerr }),
    })
    fetchMovies()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-amber-100 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-amber-900 mb-1">Watchlist</h1>
      <p className="text-sm text-amber-600 mb-4">
        {filteredMovies.length} {filteredMovies.length === 1 ? 'film' : 'films'}
      </p>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        buttons={STATUS_BUTTONS}
        activeButton={activeFilter}
        onButtonChange={setActiveFilter}
      />

      <div>
        {filteredMovies.map((movie, index) => {
          const matchingProviders = getMatchingProviders(movie, streamingServiceIds)
          return (
            <MovieRow
              key={movie.id}
              movie={movie}
              position={index + 1}
              seerrUrl={seerrUrl}
              streamingProviders={matchingProviders}
              streamingLink={movie.streamingLink ?? null}
              onMarkWatched={setRatingTarget}
              onForceDownload={handleForceDownload}
              onRemove={handleRemove}
            />
          )
        })}
        {filteredMovies.length === 0 && (
          <p className="text-center text-stone-400 text-sm py-12">
            {activeFilter === 'streamable'
              ? 'No streamable movies found. Configure your streaming services in Settings.'
              : 'No movies match your filter.'}
          </p>
        )}
      </div>

      {ratingTarget && (
        <RatingDialog
          movie={ratingTarget}
          userNames={userNames}
          onClose={() => {
            setRatingTarget(null)
            fetchMovies()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/watchlist/page.tsx
git commit -m "feat: add Streamable filter and pass streaming data to MovieRow"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass with no failures.

- [ ] **Check test count**

```bash
npm run test:run 2>&1 | grep -E "Tests|passed|failed"
```

Expected: more tests than before (was 120), all passing.
