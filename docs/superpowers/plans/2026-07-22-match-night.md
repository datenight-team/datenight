# Match Night Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tinder-style swipe feature ("Match Night") where Ian and Krista each independently thumbs-up/down a deck of candidate movies (seeded from a bundled Criterion catalog file + TMDB popular), and a mutual thumbs-up auto-adds the film to the watchlist with a match badge.

**Architecture:** Two new Prisma models (`SwipeCandidate`, `Swipe`) plus a `matchedViaSwipe` flag on `Movie`. A `src/lib/match-night.ts` module owns all business logic (deck refill, next-candidate lookup, swipe/match transaction); two thin API routes expose it; a new `/match-night` page + card component drive the UI; the existing `MovieRow` gets a small badge.

**Tech Stack:** Next.js API routes, Prisma (SQLite via `better-sqlite3` adapter), Vitest + Testing Library — all matching existing project conventions.

## Global Constraints

- Follow the spec at `docs/superpowers/specs/2026-07-22-match-night-design.md` (as revised after review — Criterion sourcing uses a bundled static file, not a live scrape).
- `User` type is `'user1' | 'user2'` (existing `src/types/index.ts`); user display names come from `getUserNames()` / `/api/user-names`, never hardcode "Krista"/"Ian" in code.
- Reuse `USER_KEYS` / `otherUser` from `src/lib/user-utils.ts` for validation — do not redefine.
- No drag/swipe gestures — tap-only 👍/👎 buttons (spec non-goal).
- No toast/notification on match — the only surfacing is the `matchedViaSwipe` badge on the watchlist card (spec decision).
- Refill threshold = 5, batch size = 20 — hardcoded constants for v1, not in Settings (spec decision).
- The read-check-write around a mutual up-vote (and the stale-candidate check) MUST run inside a single `prisma.$transaction(async (tx) => {...})` interactive transaction — this is the concurrency guarantee from the spec, not optional.
- Match every existing file's code style when editing it (e.g. `movie-row.tsx` uses semicolons; most `src/lib`/`src/app/api` files do not — don't reformat surrounding code).

---

### Task 1: Prisma schema — new models, `matchedViaSwipe`, and shared types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/index.ts`
- Test: manual verification (schema/type tasks aren't unit-testable in isolation; verified via `tsc` and `prisma validate`)

**Interfaces:**
- Produces: Prisma models `SwipeCandidate` (fields: `id, tmdbId, imdbId, title, year, runtime, description, posterUrl, source, status, createdAt, swipes`) and `Swipe` (fields: `id, candidateId, user, vote, swipedAt, candidate`), each accessible as `prisma.swipeCandidate` / `prisma.swipe`. `Movie.matchedViaSwipe: boolean`.
- Produces TS types in `src/types/index.ts`: `SwipeSource = 'criterion' | 'tmdb'`, `SwipeStatus = 'pending' | 'dead' | 'matched'`, `SwipeVote = 'up' | 'down'`, `SwipeCandidateRecord` interface, `Swipe` interface. `Movie` interface gains `matchedViaSwipe: boolean`.

- [ ] **Step 1: Add the new models and field to `prisma/schema.prisma`**

Add `matchedViaSwipe` to the existing `Movie` model (insert after `streamingLink`):

```prisma
model Movie {
  id                   Int                 @id @default(autoincrement())
  title                String
  year                 Int
  runtime              Int
  description          String
  posterUrl            String
  imdbId               String              @unique
  tmdbId               Int                 @unique
  criterionUrl         String?
  imdbUrl              String?
  sortOrder            Int
  status               String              @default("watchlist")
  seerrRequestId       String?
  seerrMediaId         String?
  seerrStatus          String              @default("not_requested")
  watchedAt            DateTime?
  createdAt            DateTime            @default(now())
  streamingLastChecked DateTime?
  streamingLink        String?
  matchedViaSwipe      Boolean             @default(false)
  ratings              Rating[]
  streamingProviders   StreamingProvider[]
}
```

Add two new models after `StreamingProvider`:

```prisma
model SwipeCandidate {
  id          Int      @id @default(autoincrement())
  tmdbId      Int      @unique
  imdbId      String
  title       String
  year        Int
  runtime     Int
  description String
  posterUrl   String
  source      String // "criterion" | "tmdb"
  status      String   @default("pending") // pending | dead | matched
  createdAt   DateTime @default(now())
  swipes      Swipe[]
}

model Swipe {
  id          Int            @id @default(autoincrement())
  candidateId Int
  user        String
  vote        String // "up" | "down"
  swipedAt    DateTime       @default(now())
  candidate   SwipeCandidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)

  @@unique([candidateId, user])
}
```

- [ ] **Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name add_match_night`
Expected: a new folder under `prisma/migrations/` is created, migration applies cleanly, and `npx prisma generate` runs as part of the command with no errors.

- [ ] **Step 3: Add TypeScript types to `src/types/index.ts`**

Add near the existing `Rating`/`RatingValue` types:

```typescript
export type SwipeSource = 'criterion' | 'tmdb'
export type SwipeStatus = 'pending' | 'dead' | 'matched'
export type SwipeVote = 'up' | 'down'

export interface SwipeCandidateRecord {
  id: number
  tmdbId: number
  imdbId: string
  title: string
  year: number
  runtime: number
  description: string
  posterUrl: string
  source: SwipeSource
  status: SwipeStatus
  createdAt: Date | string
}

export interface Swipe {
  id: number
  candidateId: number
  user: User
  vote: SwipeVote
  swipedAt: Date | string
}
```

Add `matchedViaSwipe: boolean` to the existing `Movie` interface, right after `streamingLink`:

```typescript
  streamingLink?: string | null
  matchedViaSwipe: boolean
  ratings?: Rating[]
```

- [ ] **Step 4: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors (existing test mock objects that build a full `Movie` literal, e.g. in `tests/api.movies.test.ts` and `tests/movie-row.test.tsx`, will need `matchedViaSwipe: false` added — do that now if `tsc` flags them).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/types/index.ts tests/api.movies.test.ts tests/movie-row.test.tsx
git commit -m "feat: add SwipeCandidate/Swipe models and matchedViaSwipe field for Match Night"
```

---

### Task 2: Bundled Criterion catalog data file

**Files:**
- Create: `data/criterion-catalog.json`
- Test: `tests/criterion-catalog.test.ts`

**Interfaces:**
- Produces: a JSON file at `data/criterion-catalog.json` containing an array of `{ title: string, year?: number }`, and a loader `getCriterionCatalog(): Array<{ title: string; year?: number }>` in `src/lib/criterion-catalog.ts` that later tasks import.

- [ ] **Step 1: Write the failing test**

Create `tests/criterion-catalog.test.ts`:

```typescript
// tests/criterion-catalog.test.ts
import { describe, it, expect } from 'vitest'
import { getCriterionCatalog } from '@/lib/criterion-catalog'

describe('getCriterionCatalog', () => {
  it('returns a non-empty array of title entries', () => {
    const catalog = getCriterionCatalog()
    expect(Array.isArray(catalog)).toBe(true)
    expect(catalog.length).toBeGreaterThan(10)
  })

  it('every entry has a non-empty string title', () => {
    const catalog = getCriterionCatalog()
    for (const entry of catalog) {
      expect(typeof entry.title).toBe('string')
      expect(entry.title.length).toBeGreaterThan(0)
    }
  })

  it('every entry with a year has a plausible film year', () => {
    const catalog = getCriterionCatalog()
    for (const entry of catalog) {
      if (entry.year !== undefined) {
        expect(entry.year).toBeGreaterThan(1880)
        expect(entry.year).toBeLessThanOrEqual(new Date().getFullYear())
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/criterion-catalog.test.ts`
Expected: FAIL — `Cannot find module '@/lib/criterion-catalog'`

- [ ] **Step 3: Create the data file**

Create `data/criterion-catalog.json`:

```json
[
  { "title": "Seven Samurai", "year": 1954 },
  { "title": "Rashomon", "year": 1950 },
  { "title": "Ikiru", "year": 1952 },
  { "title": "Yojimbo", "year": 1961 },
  { "title": "Sanjuro", "year": 1962 },
  { "title": "High and Low", "year": 1963 },
  { "title": "The Hidden Fortress", "year": 1958 },
  { "title": "Ran", "year": 1985 },
  { "title": "Kagemusha", "year": 1980 },
  { "title": "The Seventh Seal", "year": 1957 },
  { "title": "Persona", "year": 1966 },
  { "title": "Wild Strawberries", "year": 1957 },
  { "title": "Fanny and Alexander", "year": 1982 },
  { "title": "8 1/2", "year": 1963 },
  { "title": "La Strada", "year": 1954 },
  { "title": "Nights of Cabiria", "year": 1957 },
  { "title": "Amarcord", "year": 1973 },
  { "title": "L'Avventura", "year": 1960 },
  { "title": "The 400 Blows", "year": 1959 },
  { "title": "Breathless", "year": 1960 },
  { "title": "Contempt", "year": 1963 },
  { "title": "Playtime", "year": 1967 },
  { "title": "Mon Oncle", "year": 1958 },
  { "title": "Le Samourai", "year": 1967 },
  { "title": "Diabolique", "year": 1955 },
  { "title": "The Third Man", "year": 1949 },
  { "title": "Rebecca", "year": 1940 },
  { "title": "M", "year": 1931 },
  { "title": "Metropolis", "year": 1927 },
  { "title": "Beauty and the Beast", "year": 1946 },
  { "title": "Orpheus", "year": 1950 },
  { "title": "Tokyo Story", "year": 1953 },
  { "title": "Late Spring", "year": 1949 },
  { "title": "Ugetsu", "year": 1953 },
  { "title": "Sansho the Bailiff", "year": 1954 },
  { "title": "Harakiri", "year": 1962 },
  { "title": "Onibaba", "year": 1964 },
  { "title": "Woman in the Dunes", "year": 1964 },
  { "title": "Kwaidan", "year": 1964 },
  { "title": "In the Mood for Love", "year": 2000 },
  { "title": "Chungking Express", "year": 1994 },
  { "title": "Branded to Kill", "year": 1967 },
  { "title": "Tokyo Drifter", "year": 1966 },
  { "title": "House", "year": 1977 },
  { "title": "The Killing", "year": 1956 },
  { "title": "Paths of Glory", "year": 1957 },
  { "title": "Dr. Strangelove", "year": 1964 },
  { "title": "Rosemary's Baby", "year": 1968 },
  { "title": "Repo Man", "year": 1984 },
  { "title": "The Man Who Fell to Earth", "year": 1976 },
  { "title": "Blood Simple", "year": 1984 },
  { "title": "Do the Right Thing", "year": 1989 },
  { "title": "Malcolm X", "year": 1992 },
  { "title": "Hoop Dreams", "year": 1994 },
  { "title": "Chimes at Midnight", "year": 1965 },
  { "title": "Sullivan's Travels", "year": 1941 },
  { "title": "The Lady Eve", "year": 1941 },
  { "title": "Sweet Smell of Success", "year": 1957 },
  { "title": "Rififi", "year": 1955 },
  { "title": "Charade", "year": 1963 }
]
```

- [ ] **Step 4: Create the loader**

Create `src/lib/criterion-catalog.ts`:

```typescript
// src/lib/criterion-catalog.ts
import catalog from '../../data/criterion-catalog.json'

export interface CriterionCatalogEntry {
  title: string
  year?: number
}

export function getCriterionCatalog(): CriterionCatalogEntry[] {
  return catalog as CriterionCatalogEntry[]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/criterion-catalog.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add data/criterion-catalog.json src/lib/criterion-catalog.ts tests/criterion-catalog.test.ts
git commit -m "feat: add bundled Criterion catalog data file and loader"
```

---

### Task 3: TMDB popular-movies helper + fetch timeouts

**Files:**
- Modify: `src/lib/tmdb.ts`
- Test: `tests/tmdb.test.ts`

**Interfaces:**
- Consumes: existing `fetchDetails(tmdbId, key)` (module-private), `getConfig()` from `@/lib/config`, `TmdbMovieDetails` from `@/types`.
- Produces: `fetchPopularMovies(page: number): Promise<TmdbMovieDetails[]>` — later tasks (Task 4) call this during deck refill.

- [ ] **Step 1: Write the failing test**

Add to `tests/tmdb.test.ts` (append a new `describe` block, and add the new import to the existing destructured `await import('@/lib/tmdb')` line at the top of the file):

```typescript
// change the top-of-file import line to also pull in fetchPopularMovies:
// const { findByImdbId, searchByTitle, lookupCriterionSlug, fetchWatchProviders, fetchProviderList, fetchPopularMovies } = await import('@/lib/tmdb')
```

```typescript
describe('fetchPopularMovies', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('resolves full details for each popular result', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 345911 }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => detailsResponse })

    const result = await fetchPopularMovies(1)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Seven Samurai')
  })

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await fetchPopularMovies(1)).toEqual([])
  })

  it('filters out results TMDB details couldn\'t resolve', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 1 }, { id: 2 }] }),
      })
      .mockResolvedValueOnce({ ok: false }) // details for id 1 fail
      .mockResolvedValueOnce({ ok: true, json: async () => detailsResponse }) // id 2 succeeds

    const result = await fetchPopularMovies(1)
    expect(result).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tmdb.test.ts`
Expected: FAIL — `fetchPopularMovies is not a function` / import error

- [ ] **Step 3: Implement `fetchPopularMovies` and add fetch timeouts**

In `src/lib/tmdb.ts`, add a timeout wrapper and use it inside `fetchDetails` and `searchByTitle`'s search call, then add the new function. Replace the top of the file:

```typescript
// src/lib/tmdb.ts
import type { TmdbMovieDetails } from '@/types'
import { getConfig } from './config'

const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'
const FETCH_TIMEOUT_MS = 5000

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

async function fetchDetails(tmdbId: number, key: string): Promise<TmdbMovieDetails | null> {
  const res = await fetchWithTimeout(`${BASE}/movie/${tmdbId}?api_key=${key}`)
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
```

Update `searchByTitle`'s own fetch call to use `fetchWithTimeout` instead of `fetch`:

```typescript
export async function searchByTitle(
  title: string,
  year?: number
): Promise<TmdbMovieDetails | null> {
  const { tmdbApiKey } = await getConfig()
  const yearParam = year ? `&year=${year}` : ''
  const res = await fetchWithTimeout(
    `${BASE}/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}${yearParam}`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id, tmdbApiKey)
}
```

Add the new function at the end of the file (after `fetchProviderList`):

```typescript
export async function fetchPopularMovies(page: number): Promise<TmdbMovieDetails[]> {
  const { tmdbApiKey } = await getConfig()
  const res = await fetchWithTimeout(`${BASE}/movie/popular?api_key=${tmdbApiKey}&page=${page}`)
  if (!res.ok) return []
  const data = await res.json()
  const hits = (data.results ?? []) as Array<{ id: number }>
  const details = await Promise.all(hits.map((h) => fetchDetails(h.id, tmdbApiKey)))
  return details.filter((d): d is TmdbMovieDetails => d !== null)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tmdb.test.ts`
Expected: PASS, all tests in the file (existing + 3 new) green

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb.ts tests/tmdb.test.ts
git commit -m "feat: add fetchPopularMovies helper and request timeouts to tmdb.ts"
```

---

### Task 4: Deck refill logic

**Files:**
- Create: `src/lib/match-night.ts`
- Test: `tests/match-night.test.ts`

**Interfaces:**
- Consumes: `getCriterionCatalog()` from `@/lib/criterion-catalog`, `searchByTitle` / `fetchPopularMovies` from `@/lib/tmdb`, `prisma` from `@/lib/db`.
- Produces: `refillCandidates(): Promise<number>` (returns count of newly inserted candidates) — consumed by Task 5's `getNextCandidateForUser`.
- Produces internally (not exported): `REFILL_THRESHOLD = 5`, `REFILL_BATCH_SIZE = 20` constants — Task 5 imports `REFILL_THRESHOLD` too.

- [ ] **Step 1: Write the failing test**

Create `tests/match-night.test.ts`:

```typescript
// tests/match-night.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const prisma: any = {
    movie: { findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    swipeCandidate: {
      findMany: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn(),
    },
    swipe: { create: vi.fn(), findUnique: vi.fn() },
    setting: { findUnique: vi.fn(), upsert: vi.fn() },
  }
  prisma.$transaction = vi.fn((cb: any) => cb(prisma))
  return { prisma }
})
vi.mock('@/lib/criterion-catalog', () => ({
  getCriterionCatalog: vi.fn(),
}))
vi.mock('@/lib/tmdb', () => ({
  searchByTitle: vi.fn(),
  fetchPopularMovies: vi.fn(),
}))

import { prisma } from '@/lib/db'
import { getCriterionCatalog } from '@/lib/criterion-catalog'
import { searchByTitle, fetchPopularMovies } from '@/lib/tmdb'
import { refillCandidates } from '@/lib/match-night'

const tmdbDetails = (overrides: Partial<any> = {}) => ({
  tmdbId: 1, title: 'Some Film', year: 1960, runtime: 90,
  description: 'desc', posterUrl: 'poster.jpg', imdbId: 'tt0000001',
  ...overrides,
})

describe('refillCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.setting.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.swipeCandidate.createMany).mockResolvedValue({ count: 0 } as any)
  })

  it('resolves catalog entries via TMDB and inserts them as criterion candidates', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Seven Samurai', year: 1954 }])
    vi.mocked(searchByTitle).mockResolvedValue(tmdbDetails({ tmdbId: 345911, title: 'Seven Samurai' }))
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    const count = await refillCandidates()

    expect(count).toBe(1)
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tmdbId: 345911, source: 'criterion' })],
    })
  })

  it('skips a resolved title that already exists as a Movie', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Seven Samurai', year: 1954 }])
    vi.mocked(prisma.movie.findMany).mockResolvedValue([{ tmdbId: 345911 }] as any)
    vi.mocked(searchByTitle).mockResolvedValue(tmdbDetails({ tmdbId: 345911 }))
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    const count = await refillCandidates()
    expect(count).toBe(0)
  })

  it('skips a resolved title that already exists as a SwipeCandidate', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Seven Samurai', year: 1954 }])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([{ tmdbId: 345911 }] as any)
    vi.mocked(searchByTitle).mockResolvedValue(tmdbDetails({ tmdbId: 345911 }))
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    const count = await refillCandidates()
    expect(count).toBe(0)
  })

  it('adds TMDB popular results as tmdb-source candidates', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(fetchPopularMovies).mockResolvedValue([tmdbDetails({ tmdbId: 99 })])

    const count = await refillCandidates()
    expect(count).toBe(1)
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tmdbId: 99, source: 'tmdb' })],
    })
  })

  it('continues with TMDB-only results when a Criterion title fails to resolve', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Unresolvable Title' }])
    vi.mocked(searchByTitle).mockRejectedValue(new Error('timeout'))
    vi.mocked(fetchPopularMovies).mockResolvedValue([tmdbDetails({ tmdbId: 99 })])

    const count = await refillCandidates()
    expect(count).toBe(1)
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tmdbId: 99, source: 'tmdb' })],
    })
  })

  it('persists the TMDB popular page cursor after a refill', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'match_night_tmdb_popular_page', value: '3' } as any)
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    await refillCandidates()
    expect(fetchPopularMovies).toHaveBeenCalledWith(3)
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'match_night_tmdb_popular_page' } })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/match-night.test.ts`
Expected: FAIL — `Cannot find module '@/lib/match-night'`

- [ ] **Step 3: Implement `src/lib/match-night.ts` (refill portion only)**

```typescript
// src/lib/match-night.ts
import { prisma } from './db'
import { getCriterionCatalog } from './criterion-catalog'
import { searchByTitle, fetchPopularMovies } from './tmdb'
import type { TmdbMovieDetails } from '@/types'

export const REFILL_THRESHOLD = 5
export const REFILL_BATCH_SIZE = 20

const CRITERION_CURSOR_KEY = 'match_night_criterion_cursor'
const TMDB_PAGE_CURSOR_KEY = 'match_night_tmdb_popular_page'
const MAX_TMDB_PAGES_PER_REFILL = 5

interface NewCandidate extends TmdbMovieDetails {
  source: 'criterion' | 'tmdb'
}

async function getCursor(key: string): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row ? parseInt(row.value, 10) || 0 : 0
}

async function setCursor(key: string, value: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  })
}

async function getExistingTmdbIds(): Promise<Set<number>> {
  const [movies, candidates] = await Promise.all([
    prisma.movie.findMany({ select: { tmdbId: true } }),
    prisma.swipeCandidate.findMany({ select: { tmdbId: true } }),
  ])
  return new Set<number>([
    ...movies.map((m) => m.tmdbId),
    ...candidates.map((c) => c.tmdbId),
  ])
}

export async function refillCandidates(): Promise<number> {
  const existingTmdbIds = await getExistingTmdbIds()
  const toInsert: NewCandidate[] = []
  const halfBatch = REFILL_BATCH_SIZE / 2

  // Criterion: resolve forward from the saved cursor through the static catalog
  const catalog = getCriterionCatalog()
  let criterionCursor = await getCursor(CRITERION_CURSOR_KEY)
  const criterionCollected = () => toInsert.filter((c) => c.source === 'criterion').length

  while (criterionCursor < catalog.length && criterionCollected() < halfBatch) {
    const entry = catalog[criterionCursor]
    criterionCursor++
    const details = await searchByTitle(entry.title, entry.year).catch(() => null)
    if (details && !existingTmdbIds.has(details.tmdbId)) {
      existingTmdbIds.add(details.tmdbId)
      toInsert.push({ ...details, source: 'criterion' })
    }
  }
  await setCursor(CRITERION_CURSOR_KEY, criterionCursor)

  // TMDB popular: page forward from the saved cursor
  let page = (await getCursor(TMDB_PAGE_CURSOR_KEY)) || 1
  let pagesFetched = 0

  while (toInsert.length < REFILL_BATCH_SIZE && pagesFetched < MAX_TMDB_PAGES_PER_REFILL) {
    const results = await fetchPopularMovies(page).catch(() => [])
    pagesFetched++
    page++
    for (const details of results) {
      if (existingTmdbIds.has(details.tmdbId)) continue
      existingTmdbIds.add(details.tmdbId)
      toInsert.push({ ...details, source: 'tmdb' })
      if (toInsert.length >= REFILL_BATCH_SIZE) break
    }
  }
  await setCursor(TMDB_PAGE_CURSOR_KEY, page)

  if (toInsert.length > 0) {
    await prisma.swipeCandidate.createMany({ data: toInsert })
  }
  return toInsert.length
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/match-night.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/match-night.ts tests/match-night.test.ts
git commit -m "feat: add Match Night deck refill logic with cursor-tracked sourcing"
```

---

### Task 5: Next-candidate lookup and swipe/match transaction

**Files:**
- Modify: `src/lib/match-night.ts`
- Modify: `tests/match-night.test.ts`

**Interfaces:**
- Consumes: `otherUser` from `@/lib/user-utils`, `Prisma` from `@prisma/client`, `syncMovieProviders` from `@/lib/streaming`, `REFILL_THRESHOLD`/`refillCandidates` (same file, Task 4).
- Produces: `getNextCandidateForUser(user: User): Promise<SwipeCandidateRecord | null>` and `recordSwipe(candidateId: number, user: User, vote: SwipeVote): Promise<SwipeResult>` where `SwipeResult = { status: 'recorded' } | { status: 'matched'; movie: Movie } | { status: 'ignored' }` — Task 6's API routes call both.

- [ ] **Step 1: Write the failing tests**

Append to `tests/match-night.test.ts` (update the mocks at the top first — add `deleteMany` is not needed, but add `vi.mock('@/lib/streaming', ...)`):

Add this mock near the top of the file, alongside the other `vi.mock` calls:

```typescript
vi.mock('@/lib/streaming', () => ({ syncMovieProviders: vi.fn().mockResolvedValue(undefined) }))
```

Update the import line to add the two new functions:

```typescript
import { refillCandidates, getNextCandidateForUser, recordSwipe } from '@/lib/match-night'
```

Add new `describe` blocks:

```typescript
describe('getNextCandidateForUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the next candidate without refilling when the pending count is at or above threshold', async () => {
    vi.mocked(prisma.swipeCandidate.count).mockResolvedValue(5)
    const candidate = { id: 5, status: 'pending' }
    vi.mocked(prisma.swipeCandidate.findFirst).mockResolvedValue(candidate as any)

    const result = await getNextCandidateForUser('user1')

    expect(result).toEqual(candidate)
    expect(prisma.swipeCandidate.count).toHaveBeenCalledWith({
      where: { status: 'pending', swipes: { none: { user: 'user1' } } },
    })
    expect(prisma.swipeCandidate.findFirst).toHaveBeenCalledWith({
      where: { status: 'pending', swipes: { none: { user: 'user1' } } },
      orderBy: { createdAt: 'asc' },
    })
    expect(getCriterionCatalog).not.toHaveBeenCalled()
  })

  it('refills before returning when the pending count is below threshold', async () => {
    vi.mocked(prisma.swipeCandidate.count).mockResolvedValue(2)
    vi.mocked(prisma.swipeCandidate.findFirst).mockResolvedValue({ id: 7 } as any)
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(fetchPopularMovies).mockResolvedValue([tmdbDetails({ tmdbId: 42 })])
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)

    const result = await getNextCandidateForUser('user1')

    expect(result).toEqual({ id: 7 })
    expect(getCriterionCatalog).toHaveBeenCalled()
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalled()
  })

  it('returns null when the pending count is below threshold and a refill adds nothing', async () => {
    vi.mocked(prisma.swipeCandidate.count).mockResolvedValue(0)
    vi.mocked(prisma.swipeCandidate.findFirst).mockResolvedValue(null)
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(fetchPopularMovies).mockResolvedValue([])
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)

    const result = await getNextCandidateForUser('user1')

    expect(result).toBeNull()
  })
})

describe('recordSwipe', () => {
  beforeEach(() => vi.clearAllMocks())

  const pendingCandidate = {
    id: 1, tmdbId: 345911, imdbId: 'tt0047478', title: 'Seven Samurai',
    year: 1954, runtime: 207, description: 'desc', posterUrl: 'p.jpg', status: 'pending',
  }

  it('marks the candidate dead on a down vote and does not touch Movie', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)

    const result = await recordSwipe(1, 'user1', 'down')

    expect(result).toEqual({ status: 'recorded' })
    expect(prisma.swipe.create).toHaveBeenCalledWith({ data: { candidateId: 1, user: 'user1', vote: 'down' } })
    expect(prisma.swipeCandidate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'dead' } })
    expect(prisma.movie.create).not.toHaveBeenCalled()
  })

  it('just records the vote when the other user has not voted up yet', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue(null)

    const result = await recordSwipe(1, 'user1', 'up')

    expect(result).toEqual({ status: 'recorded' })
    expect(prisma.movie.create).not.toHaveBeenCalled()
  })

  it('creates the Movie and marks matched when both users are up', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue({ candidateId: 1, user: 'user2', vote: 'up' } as any)
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 4 } } as any)
    const createdMovie = { id: 10, title: 'Seven Samurai', tmdbId: 345911 }
    vi.mocked(prisma.movie.create).mockResolvedValue(createdMovie as any)

    const result = await recordSwipe(1, 'user1', 'up')

    expect(result).toEqual({ status: 'matched', movie: createdMovie })
    expect(prisma.movie.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tmdbId: 345911, title: 'Seven Samurai', sortOrder: 5, matchedViaSwipe: true,
      }),
    })
    expect(prisma.swipeCandidate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'matched' } })
  })

  it('triggers syncMovieProviders after a match', async () => {
    const { syncMovieProviders } = await import('@/lib/streaming')
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue({ vote: 'up' } as any)
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 0 } } as any)
    vi.mocked(prisma.movie.create).mockResolvedValue({ id: 10, tmdbId: 345911 } as any)

    await recordSwipe(1, 'user1', 'up')
    await new Promise((r) => setTimeout(r, 0))
    expect(syncMovieProviders).toHaveBeenCalledWith(10, 345911)
  })

  it('is a no-op when the candidate is no longer pending', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue({ ...pendingCandidate, status: 'dead' } as any)

    const result = await recordSwipe(1, 'user1', 'up')

    expect(result).toEqual({ status: 'ignored' })
    expect(prisma.swipe.create).not.toHaveBeenCalled()
  })

  it('is a no-op when the candidate does not exist', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(null)

    const result = await recordSwipe(999, 'user1', 'up')
    expect(result).toEqual({ status: 'ignored' })
  })

  it('falls back to the existing Movie on a unique constraint race instead of erroring', async () => {
    const { Prisma } = await import('@prisma/client')
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue({ vote: 'up' } as any)
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 0 } } as any)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002', clientVersion: '7.0.0',
    })
    vi.mocked(prisma.movie.create).mockRejectedValue(p2002)
    const existingMovie = { id: 10, tmdbId: 345911 }
    vi.mocked(prisma.movie.findUniqueOrThrow).mockResolvedValue(existingMovie as any)

    const result = await recordSwipe(1, 'user1', 'up')
    expect(result).toEqual({ status: 'matched', movie: existingMovie })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/match-night.test.ts`
Expected: FAIL — `getNextCandidateForUser`/`recordSwipe` not exported

- [ ] **Step 3: Implement the rest of `src/lib/match-night.ts`**

Add these imports to the top of `src/lib/match-night.ts` (alongside the existing ones):

```typescript
import { Prisma } from '@prisma/client'
import { otherUser } from './user-utils'
import { syncMovieProviders } from './streaming'
import type { Movie, SwipeCandidateRecord, SwipeVote, User } from '@/types'
```

Append to the end of `src/lib/match-night.ts`:

```typescript
export async function getNextCandidateForUser(user: User): Promise<SwipeCandidateRecord | null> {
  const pendingCount = await prisma.swipeCandidate.count({
    where: { status: 'pending', swipes: { none: { user } } },
  })
  if (pendingCount < REFILL_THRESHOLD) {
    await refillCandidates()
  }

  return (await findNextPending(user)) as unknown as SwipeCandidateRecord | null
}

function findNextPending(user: User) {
  return prisma.swipeCandidate.findFirst({
    where: { status: 'pending', swipes: { none: { user } } },
    orderBy: { createdAt: 'asc' },
  })
}

export type SwipeResult =
  | { status: 'recorded' }
  | { status: 'matched'; movie: Movie }
  | { status: 'ignored' }

export async function recordSwipe(
  candidateId: number,
  user: User,
  vote: SwipeVote
): Promise<SwipeResult> {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.swipeCandidate.findUnique({ where: { id: candidateId } })
    if (!candidate || candidate.status !== 'pending') {
      return { status: 'ignored' }
    }

    await tx.swipe.create({ data: { candidateId, user, vote } })

    if (vote === 'down') {
      await tx.swipeCandidate.update({ where: { id: candidateId }, data: { status: 'dead' } })
      return { status: 'recorded' }
    }

    const other = otherUser(user)
    const otherSwipe = await tx.swipe.findUnique({
      where: { candidateId_user: { candidateId, user: other } },
    })
    if (!otherSwipe || otherSwipe.vote !== 'up') {
      return { status: 'recorded' }
    }

    const { _max } = await tx.movie.aggregate({ _max: { sortOrder: true } })
    let movie
    try {
      movie = await tx.movie.create({
        data: {
          title: candidate.title,
          year: candidate.year,
          runtime: candidate.runtime,
          description: candidate.description,
          posterUrl: candidate.posterUrl,
          imdbId: candidate.imdbId,
          tmdbId: candidate.tmdbId,
          sortOrder: (_max.sortOrder ?? 0) + 1,
          matchedViaSwipe: true,
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        movie = await tx.movie.findUniqueOrThrow({ where: { tmdbId: candidate.tmdbId } })
      } else {
        throw err
      }
    }

    await tx.swipeCandidate.update({ where: { id: candidateId }, data: { status: 'matched' } })
    return { status: 'matched', movie }
  }).then((result: SwipeResult) => {
    if (result.status === 'matched') {
      syncMovieProviders(result.movie.id, result.movie.tmdbId).catch((err) =>
        console.error('[match-night] Failed to sync providers for matched movie:', err)
      )
    }
    return result
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/match-night.test.ts`
Expected: PASS (all tests in the file, ~14 total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/match-night.ts tests/match-night.test.ts
git commit -m "feat: add Match Night swipe/match transaction with concurrency safeguards"
```

---

### Task 6: API routes

**Files:**
- Create: `src/app/api/match-night/next/route.ts`
- Create: `src/app/api/match-night/swipe/route.ts`
- Test: `tests/api.match-night.test.ts`

**Interfaces:**
- Consumes: `getNextCandidateForUser`, `recordSwipe` from `@/lib/match-night` (Task 5); `USER_KEYS` from `@/lib/user-utils`.
- Produces: `GET /api/match-night/next?user=<user1|user2>` → `{ candidate: SwipeCandidateRecord | null }`; `POST /api/match-night/swipe` (body `{ candidateId, user, vote }`) → the `SwipeResult` JSON — consumed by Task 8's page.

- [ ] **Step 1: Write the failing test**

Create `tests/api.match-night.test.ts`:

```typescript
// tests/api.match-night.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/match-night', () => ({
  getNextCandidateForUser: vi.fn(),
  recordSwipe: vi.fn(),
}))

import { getNextCandidateForUser, recordSwipe } from '@/lib/match-night'
import { GET } from '@/app/api/match-night/next/route'
import { POST } from '@/app/api/match-night/swipe/route'

describe('GET /api/match-night/next', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the next candidate for a valid user', async () => {
    vi.mocked(getNextCandidateForUser).mockResolvedValue({ id: 1, title: 'Seven Samurai' } as any)
    const req = new Request('http://localhost/api/match-night/next?user=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ candidate: { id: 1, title: 'Seven Samurai' } })
    expect(getNextCandidateForUser).toHaveBeenCalledWith('user1')
  })

  it('returns candidate: null when the deck is empty', async () => {
    vi.mocked(getNextCandidateForUser).mockResolvedValue(null)
    const req = new Request('http://localhost/api/match-night/next?user=user2')
    const res = await GET(req)
    expect(await res.json()).toEqual({ candidate: null })
  })

  it('returns 422 for a missing/invalid user', async () => {
    const req = new Request('http://localhost/api/match-night/next?user=nobody')
    const res = await GET(req)
    expect(res.status).toBe(422)
  })
})

describe('POST /api/match-night/swipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records a valid swipe', async () => {
    vi.mocked(recordSwipe).mockResolvedValue({ status: 'recorded' })
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'user1', vote: 'up' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'recorded' })
    expect(recordSwipe).toHaveBeenCalledWith(1, 'user1', 'up')
  })

  it('returns the matched movie payload on a match', async () => {
    vi.mocked(recordSwipe).mockResolvedValue({ status: 'matched', movie: { id: 10 } as any })
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'user2', vote: 'up' }),
    })
    const res = await POST(req)
    expect(await res.json()).toEqual({ status: 'matched', movie: { id: 10 } })
  })

  it('returns 422 for an invalid user', async () => {
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'nobody', vote: 'up' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns 422 for a missing candidateId', async () => {
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ user: 'user1', vote: 'up' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns 422 for an invalid vote value', async () => {
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'user1', vote: 'sideways' }),
    })
    expect((await POST(req)).status).toBe(422)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api.match-night.test.ts`
Expected: FAIL — route modules don't exist

- [ ] **Step 3: Implement the routes**

Create `src/app/api/match-night/next/route.ts`:

```typescript
// src/app/api/match-night/next/route.ts
import { NextResponse } from 'next/server'
import { getNextCandidateForUser } from '@/lib/match-night'
import { USER_KEYS } from '@/lib/user-utils'
import type { User } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const user = searchParams.get('user')
  if (!USER_KEYS.includes(user as User)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }

  const candidate = await getNextCandidateForUser(user as User)
  return NextResponse.json({ candidate })
}
```

Create `src/app/api/match-night/swipe/route.ts`:

```typescript
// src/app/api/match-night/swipe/route.ts
import { NextResponse } from 'next/server'
import { recordSwipe } from '@/lib/match-night'
import { USER_KEYS } from '@/lib/user-utils'
import type { SwipeVote, User } from '@/types'

interface SwipeBody {
  candidateId?: number
  user?: User
  vote?: SwipeVote
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SwipeBody

  if (!body.candidateId || !USER_KEYS.includes(body.user as User)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 422 })
  }
  if (body.vote !== 'up' && body.vote !== 'down') {
    return NextResponse.json({ error: 'vote must be "up" or "down"' }, { status: 422 })
  }

  const result = await recordSwipe(body.candidateId, body.user as User, body.vote)
  return NextResponse.json(result)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api.match-night.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/match-night tests/api.match-night.test.ts
git commit -m "feat: add /api/match-night/next and /api/match-night/swipe routes"
```

---

### Task 7: `MatchNightCard` component

**Files:**
- Create: `src/components/match-night-card.tsx`
- Test: `tests/match-night-card.test.tsx`

**Interfaces:**
- Consumes: `MoviePoster` from `./movie-poster`, `Button` from `@/components/ui/button`, `SwipeCandidateRecord` from `@/types`.
- Produces: `<MatchNightCard candidate voting onVote />` — consumed by Task 8's page.

- [ ] **Step 1: Write the failing test**

Create `tests/match-night-card.test.tsx`:

```typescript
// tests/match-night-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MatchNightCard } from '@/components/match-night-card'
import type { SwipeCandidateRecord } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const candidate: SwipeCandidateRecord = {
  id: 1, tmdbId: 345911, imdbId: 'tt0047478', title: 'Seven Samurai', year: 1954,
  runtime: 207, description: 'A poor village recruits seven samurai.', posterUrl: 'poster.jpg',
  source: 'criterion', status: 'pending', createdAt: new Date().toISOString(),
}

describe('MatchNightCard', () => {
  it('renders the title, year, and description', () => {
    render(<MatchNightCard candidate={candidate} voting={false} onVote={vi.fn()} />)
    expect(screen.getByText('Seven Samurai')).toBeInTheDocument()
    expect(screen.getByText('1954')).toBeInTheDocument()
    expect(screen.getByText(/seven samurai\.$/i)).toBeInTheDocument()
  })

  it('calls onVote("up") when the thumbs-up button is clicked', () => {
    const onVote = vi.fn()
    render(<MatchNightCard candidate={candidate} voting={false} onVote={onVote} />)
    fireEvent.click(screen.getByRole('button', { name: /thumbs up/i }))
    expect(onVote).toHaveBeenCalledWith('up')
  })

  it('calls onVote("down") when the thumbs-down button is clicked', () => {
    const onVote = vi.fn()
    render(<MatchNightCard candidate={candidate} voting={false} onVote={onVote} />)
    fireEvent.click(screen.getByRole('button', { name: /thumbs down/i }))
    expect(onVote).toHaveBeenCalledWith('down')
  })

  it('disables both buttons while voting', () => {
    render(<MatchNightCard candidate={candidate} voting={true} onVote={vi.fn()} />)
    expect(screen.getByRole('button', { name: /thumbs up/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /thumbs down/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/match-night-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the component**

Create `src/components/match-night-card.tsx`:

```typescript
// src/components/match-night-card.tsx
'use client'
import { MoviePoster } from './movie-poster'
import { Button } from '@/components/ui/button'
import type { SwipeCandidateRecord, SwipeVote } from '@/types'

interface MatchNightCardProps {
  candidate: SwipeCandidateRecord
  voting: boolean
  onVote: (vote: SwipeVote) => void
}

export function MatchNightCard({ candidate, voting, onVote }: MatchNightCardProps) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm max-w-xs mx-auto">
      <MoviePoster posterUrl={candidate.posterUrl} title={candidate.title} size="lg" />
      <div className="p-4">
        <h2 className="font-bold text-stone-900 text-lg leading-tight">{candidate.title}</h2>
        <p className="text-stone-400 text-sm mb-2">{candidate.year}</p>
        <p className="text-stone-600 text-sm line-clamp-4">{candidate.description}</p>
      </div>
      <div className="flex gap-3 justify-center pb-4">
        <Button
          size="lg"
          variant="outline"
          className="text-2xl px-6 border-stone-200 disabled:opacity-40"
          disabled={voting}
          onClick={() => onVote('down')}
          aria-label="Thumbs down"
        >
          👎
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="text-2xl px-6 border-amber-300 disabled:opacity-40"
          disabled={voting}
          onClick={() => onVote('up')}
          aria-label="Thumbs up"
        >
          👍
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/match-night-card.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/match-night-card.tsx tests/match-night-card.test.tsx
git commit -m "feat: add MatchNightCard component"
```

---

### Task 8: Match Night page

**Files:**
- Create: `src/app/match-night/page.tsx`
- Test: `tests/match-night-page.test.tsx`

**Interfaces:**
- Consumes: `MatchNightCard` (Task 7), `USER_KEYS` from `@/lib/user-utils`, `/api/user-names`, `/api/match-night/next`, `/api/match-night/swipe`.

- [ ] **Step 1: Write the failing test**

Create `tests/match-night-page.test.tsx`:

```typescript
// tests/match-night-page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MatchNightPage from '@/app/match-night/page'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const candidate = {
  id: 1, tmdbId: 345911, imdbId: 'tt0047478', title: 'Seven Samurai', year: 1954,
  runtime: 207, description: 'desc', posterUrl: 'poster.jpg', source: 'criterion',
  status: 'pending', createdAt: new Date().toISOString(),
}

function jsonResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: async () => data })
}

describe('MatchNightPage', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user-names')) return jsonResponse({ user1: 'Ian', user2: 'Krista' })
      if (url.includes('/api/match-night/next')) return jsonResponse({ candidate })
      if (url.includes('/api/match-night/swipe')) return jsonResponse({ status: 'recorded' })
      return jsonResponse({})
    })
  })

  it('shows a user picker before swiping starts', async () => {
    render(<MatchNightPage />)
    await waitFor(() => expect(screen.getByText('Ian')).toBeInTheDocument())
    expect(screen.getByText('Krista')).toBeInTheDocument()
  })

  it('loads the next candidate after picking a user', async () => {
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => expect(screen.getByText('Seven Samurai')).toBeInTheDocument())
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/match-night/next?user=user1'))
  })

  it('submits a swipe and requests the next card', async () => {
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => screen.getByText('Seven Samurai'))

    fireEvent.click(screen.getByRole('button', { name: /thumbs up/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/match-night/swipe',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('shows a match banner when the swipe result is a match', async () => {
    mockFetch.mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/user-names')) return jsonResponse({ user1: 'Ian', user2: 'Krista' })
      if (url.includes('/api/match-night/next')) return jsonResponse({ candidate })
      if (url.includes('/api/match-night/swipe')) return jsonResponse({ status: 'matched', movie: { id: 10 } })
      return jsonResponse({})
    })
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => screen.getByText('Seven Samurai'))
    fireEvent.click(screen.getByRole('button', { name: /thumbs up/i }))
    await waitFor(() => expect(screen.getByText(/it's a match/i)).toBeInTheDocument())
  })

  it('shows an empty state when there is no next candidate', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user-names')) return jsonResponse({ user1: 'Ian', user2: 'Krista' })
      if (url.includes('/api/match-night/next')) return jsonResponse({ candidate: null })
      return jsonResponse({})
    })
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/match-night-page.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the page**

Create `src/app/match-night/page.tsx`:

```typescript
// src/app/match-night/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { MatchNightCard } from '@/components/match-night-card'
import { Button } from '@/components/ui/button'
import { USER_KEYS } from '@/lib/user-utils'
import type { SwipeCandidateRecord, SwipeVote, User } from '@/types'

export default function MatchNightPage() {
  const [userNames, setUserNames] = useState<Record<User, string>>({ user1: 'User 1', user2: 'User 2' })
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [candidate, setCandidate] = useState<SwipeCandidateRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [voting, setVoting] = useState(false)
  const [justMatched, setJustMatched] = useState(false)

  useEffect(() => {
    fetch('/api/user-names')
      .then((r) => r.json())
      .then(setUserNames)
      .catch(() => {})
  }, [])

  const loadNext = useCallback(async (user: User) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/match-night/next?user=${user}`)
      const data = await res.json()
      setCandidate(data.candidate)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectUser = (user: User) => {
    setCurrentUser(user)
    loadNext(user)
  }

  const handleVote = async (vote: SwipeVote) => {
    if (!currentUser || !candidate) return
    setVoting(true)
    setJustMatched(false)
    try {
      const res = await fetch('/api/match-night/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, user: currentUser, vote }),
      })
      const data = await res.json()
      if (data.status === 'matched') setJustMatched(true)
      await loadNext(currentUser)
    } finally {
      setVoting(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-amber-900 mb-6">Match Night 💕</h1>
        <p className="text-sm text-stone-600 mb-4">Who&apos;s swiping?</p>
        <div className="space-y-3">
          {USER_KEYS.map((user) => (
            <Button
              key={user}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => handleSelectUser(user)}
            >
              {userNames[user]}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-amber-900 mb-2 text-center">Match Night 💕</h1>
      <p className="text-xs text-stone-500 text-center mb-6">Swiping as {userNames[currentUser]}</p>

      {justMatched && (
        <p className="text-center text-green-700 bg-green-50 border border-green-200 rounded-lg py-2 mb-4 text-sm font-medium">
          It&apos;s a match! 🎉 Added to your watchlist.
        </p>
      )}

      {loading ? (
        <div className="text-center text-amber-600 mt-16 animate-pulse">Loading next film…</div>
      ) : candidate ? (
        <MatchNightCard candidate={candidate} voting={voting} onVote={handleVote} />
      ) : (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">🎬</div>
          <p className="font-medium">You&apos;re all caught up!</p>
          <p className="text-sm text-amber-500 mt-1">Check back later for more films to swipe on.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/match-night-page.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/match-night tests/match-night-page.test.tsx
git commit -m "feat: add Match Night swipe page"
```

---

### Task 9: Sidebar and mobile nav entries

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-bottom-nav.tsx`
- Modify: `tests/sidebar.test.tsx`
- Modify: `tests/mobile-bottom-nav.test.tsx`

**Interfaces:**
- No new exports — this task only adds a nav entry to each existing component's `navItems`/`tabs` array.

- [ ] **Step 1: Update the failing assertions in existing tests**

In `tests/sidebar.test.tsx`, add an assertion to the first test:

```typescript
  it('renders primary nav links', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /watch list/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /watched/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add movie/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /recommend/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /match night/i })).toBeInTheDocument()
  })
```

In `tests/mobile-bottom-nav.test.tsx`, change the "four" test to five and add assertions:

```typescript
  it('renders all five navigation tabs', () => {
    render(<MobileBottomNav />)
    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Watched')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Recs')).toBeInTheDocument()
    expect(screen.getByText('Match')).toBeInTheDocument()
  })
```

And add a route assertion inside the existing "links to the correct routes" test:

```typescript
  it('links to the correct routes', () => {
    render(<MobileBottomNav />)
    expect(screen.getByRole('link', { name: /list/i })).toHaveAttribute('href', '/watchlist')
    expect(screen.getByRole('link', { name: /watched/i })).toHaveAttribute('href', '/watched')
    expect(screen.getByRole('link', { name: /add/i })).toHaveAttribute('href', '/add')
    expect(screen.getByRole('link', { name: /recs/i })).toHaveAttribute('href', '/recommendations')
    expect(screen.getByRole('link', { name: /match/i })).toHaveAttribute('href', '/match-night')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sidebar.test.tsx tests/mobile-bottom-nav.test.tsx`
Expected: FAIL — "Match Night" / "Match" link not found

- [ ] **Step 3: Add the nav entries**

In `src/components/sidebar.tsx`, update `navItems`:

```typescript
const navItems = [
  { href: '/watchlist', label: 'Watch List', icon: '📋' },
  { href: '/watched', label: 'Watched', icon: '✅' },
  { href: '/add', label: 'Add Movie', icon: '➕' },
  { href: '/match-night', label: 'Match Night', icon: '💕' },
  { href: '/recommendations', label: 'Recommend', icon: '🎯' },
]
```

In `src/components/mobile-bottom-nav.tsx`, update `tabs`:

```typescript
const tabs = [
  { href: '/watchlist', label: 'List',     icon: '📋' },
  { href: '/watched',   label: 'Watched',  icon: '✅' },
  { href: '/add',       label: 'Add',      icon: '➕' },
  { href: '/match-night', label: 'Match',  icon: '💕' },
  { href: '/recommendations', label: 'Recs', icon: '🎯' },
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sidebar.test.tsx tests/mobile-bottom-nav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/components/mobile-bottom-nav.tsx tests/sidebar.test.tsx tests/mobile-bottom-nav.test.tsx
git commit -m "feat: add Match Night entry to sidebar and mobile bottom nav"
```

---

### Task 10: "It's a match!" badge on the watchlist

**Files:**
- Modify: `src/components/movie-row.tsx`
- Modify: `tests/movie-row.test.tsx`

**Interfaces:**
- Consumes: `movie.matchedViaSwipe` (Task 1's `Movie` type addition).

- [ ] **Step 1: Write the failing test**

Add to `tests/movie-row.test.tsx`, inside a new `describe` block:

```typescript
describe('MovieRow match badge', () => {
  beforeEach(() => mockFetch.mockReset())

  it('shows the match badge when matchedViaSwipe is true', () => {
    render(<MovieRow movie={makeMovie({ matchedViaSwipe: true })} {...defaultProps} />)
    expect(screen.getByText(/it's a match/i)).toBeInTheDocument()
  })

  it('does not show the match badge for regularly-added movies', () => {
    render(<MovieRow movie={makeMovie({ matchedViaSwipe: false })} {...defaultProps} />)
    expect(screen.queryByText(/it's a match/i)).not.toBeInTheDocument()
  })
})
```

Also add `matchedViaSwipe: false` to the `makeMovie()` default object in the same file (it's a required field per Task 1's type change):

```typescript
function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1,
    title: 'Jeanne Dielman',
    year: 1975,
    runtime: 201,
    description: '',
    posterUrl: '',
    imdbId: 'tt0073198',
    tmdbId: 11650,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: 1,
    status: 'watchlist',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'not_requested',
    watchedAt: null,
    createdAt: new Date().toISOString(),
    streamingLastChecked: new Date().toISOString(),
    streamingLink: null,
    matchedViaSwipe: false,
    ratings: [],
    streamingProviders: [],
    ...overrides,
  }
}
```

(If Task 1 already added this line while fixing `tsc` errors, skip this part — just add the two new tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/movie-row.test.tsx`
Expected: FAIL — badge text not found

- [ ] **Step 3: Add the badge**

In `src/components/movie-row.tsx`, inside the pills row (the `<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">` block), add the badge as the first pill:

```tsx
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {movie.matchedViaSwipe && (
                <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-pink-50 text-pink-600 border-pink-200">
                  It&apos;s a match! 🎉
                </span>
              )}
              {isStreamable && (
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/movie-row.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/movie-row.tsx tests/movie-row.test.tsx
git commit -m "feat: show It's a match! badge on watchlist rows added via Match Night"
```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all test files pass (previous count + this feature's new files), 0 failures

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Run the full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, then in a browser:
1. Set `TMDB_API_KEY` in `.env.local` to a real key (required — Match Night can't resolve any candidates without it).
2. Visit `/match-night`, pick a user, confirm a card loads with poster/title/year/description.
3. Thumbs-down it, confirm a new card loads.
4. Thumbs-up a card, switch users (reload page, pick the other name), find the same title (deck order is FIFO so it should reappear for the other user), thumbs-up it too, confirm the "It's a match!" banner appears.
5. Visit `/watchlist`, confirm the matched movie appears with the "It's a match! 🎉" badge.

No commit for this task — it's verification only. If any step fails, fix the underlying issue and re-run from Step 1.
