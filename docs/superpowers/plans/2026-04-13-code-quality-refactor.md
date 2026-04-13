# Code Quality Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seven targeted cleanup changes — remove dead deps, parallelize sync, fix a type escape hatch, extract two shared utilities, deduplicate validation logic, and fix Prisma error detection — with no behavior changes and all 68 tests staying green.

**Architecture:** Each task is independent and self-contained. Tasks 1–5 can be done in any order. Tasks 6 and 7 both touch `src/app/api/ratings/route.ts` — do them consecutively. Run `npm run test:run` after every commit.

**Tech Stack:** Next.js 14, TypeScript, Prisma 7 (`@prisma/client`), Vitest, shadcn/ui, Tailwind CSS

---

## File Map

| File | Change |
|---|---|
| `package.json` | Remove 3 dead deps; move 1 dep to devDependencies |
| `src/lib/sync.ts` | Replace two serial `for` loops with `Promise.all` |
| `src/types/index.ts` | Widen `watchedAt` and `createdAt` to `Date \| string` |
| `src/app/watched/page.tsx` | Drop `as unknown as Movie[]` cast; remove `Promise.resolve()` wrapper |
| `src/lib/utils.ts` | Add `formatRuntime(minutes: number): string` |
| `src/components/movie-row.tsx` | Use `formatRuntime`; use `<MoviePoster>` |
| `src/app/add/page.tsx` | Use `formatRuntime` |
| `src/app/recommendations/page.tsx` | Use `formatRuntime`; use `<MoviePoster>` |
| `src/components/movie-poster.tsx` | **New** — shared poster + placeholder component |
| `src/components/movie-card.tsx` | Use `<MoviePoster>` |
| `src/app/api/ratings/route.ts` | Extract `validateRatingBody`; use `Prisma.PrismaClientKnownRequestError` |
| `tests/utils.test.ts` | **New** — tests for `formatRuntime` |
| `tests/api.ratings.test.ts` | Update P2025 mock to use proper Prisma error type |

---

## Task 1: Remove dead dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove the four package entries**

Open `package.json`. In the `"dependencies"` block, delete the three `@dnd-kit` lines and the `@eslint/eslintrc` line:

```json
// DELETE these four lines from "dependencies":
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2",
"@eslint/eslintrc": "^3.3.5",
```

Then add `@eslint/eslintrc` to the `"devDependencies"` block:

```json
"devDependencies": {
  "@eslint/eslintrc": "^3.3.5",
  ...existing entries...
}
```

- [ ] **Step 2: Reinstall to update lockfile**

```bash
npm install
```

Expected: lockfile updated, no errors.

- [ ] **Step 3: Verify build and tests still pass**

```bash
npm run test:run
```

Expected: all 68 tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused dnd-kit deps; move eslintrc to devDependencies"
```

---

## Task 2: Parallelize Seerr API calls in sync.ts

**Files:**
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: Replace the serial request loop with Promise.all**

In `src/lib/sync.ts`, replace the first `for` loop (lines ~29–46) with:

```ts
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
```

- [ ] **Step 2: Replace the serial status-poll loop with Promise.all**

Replace the second `for` loop (lines ~51–63) with:

```ts
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
```

- [ ] **Step 3: Run the sync tests**

```bash
npm run test:run -- tests/sync.test.ts
```

Expected: all 6 sync tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync.ts
git commit -m "perf: parallelize Seerr request and status-poll loops in sync"
```

---

## Task 3: Fix Movie type and watched/page.tsx

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/app/watched/page.tsx`

- [ ] **Step 1: Widen date fields in the Movie type**

In `src/types/index.ts`, change two lines in the `Movie` interface:

```ts
// Before:
watchedAt?: string | null
createdAt: string

// After:
watchedAt?: Date | string | null
createdAt: Date | string
```

- [ ] **Step 2: Fix watched/page.tsx**

Replace the entire file `src/app/watched/page.tsx` with:

```ts
// src/app/watched/page.tsx
import { prisma } from '@/lib/db'
import { getUserNames } from '@/lib/users'
import { WatchedClient } from '@/components/watched-client'
import type { Movie } from '@/types'

export const dynamic = 'force-dynamic'

export default async function WatchedPage() {
  const movies = await prisma.movie.findMany({
    where: { status: 'watched' },
    orderBy: { watchedAt: 'desc' },
    include: { ratings: true },
  })
  const userNames = getUserNames()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Watched</h1>
      <WatchedClient movies={movies as Movie[]} userNames={userNames} />
    </div>
  )
}
```

Note: `as Movie[]` (not `as unknown as Movie[]`) is now valid because the type accepts `Date | string`.

- [ ] **Step 3: Run build to verify TypeScript is clean**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```

Expected: all 68 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/app/watched/page.tsx
git commit -m "fix: widen Movie date types to Date|string; drop type escape hatch in watched page"
```

---

## Task 4: Extract formatRuntime utility

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `tests/utils.test.ts`
- Modify: `src/components/movie-row.tsx`
- Modify: `src/app/add/page.tsx`
- Modify: `src/app/recommendations/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatRuntime } from '@/lib/utils'

describe('formatRuntime', () => {
  it('formats whole hours with zero minutes', () => {
    expect(formatRuntime(120)).toBe('2h 0m')
  })

  it('formats hours and minutes', () => {
    expect(formatRuntime(207)).toBe('3h 27m')
  })

  it('formats sub-hour runtimes', () => {
    expect(formatRuntime(45)).toBe('0h 45m')
  })

  it('formats a single minute', () => {
    expect(formatRuntime(1)).toBe('0h 1m')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- tests/utils.test.ts
```

Expected: FAIL — `formatRuntime is not a function` (or similar import error).

- [ ] **Step 3: Add formatRuntime to utils.ts**

In `src/lib/utils.ts`, add the export after `cn`:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRuntime(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
```

- [ ] **Step 4: Run the utils test to verify it passes**

```bash
npm run test:run -- tests/utils.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Update movie-row.tsx**

In `src/components/movie-row.tsx`, add the import at the top:

```ts
import { formatRuntime } from '@/lib/utils'
```

Then replace the inline runtime expression on line ~74:

```tsx
// Before:
{movie.year} · {Math.floor(movie.runtime / 60)}h{" "}
{movie.runtime % 60}m

// After:
{movie.year} · {formatRuntime(movie.runtime)}
```

- [ ] **Step 6: Update add/page.tsx**

In `src/app/add/page.tsx`, add the import at the top:

```ts
import { formatRuntime } from '@/lib/utils'
```

Then replace the inline runtime expression on line ~102:

```tsx
// Before:
{preview.year} · {Math.floor(preview.runtime / 60)}h {preview.runtime % 60}m

// After:
{preview.year} · {formatRuntime(preview.runtime)}
```

- [ ] **Step 7: Update recommendations/page.tsx**

In `src/app/recommendations/page.tsx`, add the import at the top:

```ts
import { formatRuntime } from '@/lib/utils'
```

Then replace the inline runtime expression on line ~231:

```tsx
// Before:
{rec.year} · {rec.director}
{rec.tmdb?.runtime ? ` · ${Math.floor(rec.tmdb.runtime / 60)}h ${rec.tmdb.runtime % 60}m` : ''}

// After:
{rec.year} · {rec.director}
{rec.tmdb?.runtime ? ` · ${formatRuntime(rec.tmdb.runtime)}` : ''}
```

- [ ] **Step 8: Run all tests**

```bash
npm run test:run
```

Expected: 72 tests pass (68 existing + 4 new utils tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/utils.ts tests/utils.test.ts src/components/movie-row.tsx src/app/add/page.tsx src/app/recommendations/page.tsx
git commit -m "refactor: extract formatRuntime utility; add tests"
```

---

## Task 5: Extract MoviePoster component

**Files:**
- Create: `src/components/movie-poster.tsx`
- Modify: `src/components/movie-row.tsx`
- Modify: `src/components/movie-card.tsx`
- Modify: `src/app/recommendations/page.tsx`

- [ ] **Step 1: Create src/components/movie-poster.tsx**

```tsx
// src/components/movie-poster.tsx
import Image from 'next/image'

interface MoviePosterProps {
  posterUrl: string | null | undefined
  title: string
  size: 'sm' | 'md' | 'lg'
}

const sizeConfig = {
  sm: {
    container: 'w-9 h-14 bg-amber-100 rounded flex-shrink-0 overflow-hidden',
    imgWidth: 36,
    imgHeight: 56,
    placeholder: 'text-amber-400 text-xs',
    fill: false as const,
  },
  md: {
    container: 'w-16 h-24 bg-amber-100 rounded-lg flex-shrink-0 overflow-hidden',
    imgWidth: 64,
    imgHeight: 96,
    placeholder: 'text-amber-300 text-2xl',
    fill: false as const,
  },
  lg: {
    container: 'relative w-full aspect-[2/3] bg-amber-100',
    imgWidth: 0,
    imgHeight: 0,
    placeholder: 'text-amber-300 text-4xl',
    fill: true as const,
  },
}

export function MoviePoster({ posterUrl, title, size }: MoviePosterProps) {
  const cfg = sizeConfig[size]
  return (
    <div className={cfg.container}>
      {posterUrl ? (
        cfg.fill ? (
          <Image src={posterUrl} alt={title} fill className="object-cover" />
        ) : (
          <Image
            src={posterUrl}
            alt={title}
            width={cfg.imgWidth}
            height={cfg.imgHeight}
            className="object-cover w-full h-full"
          />
        )
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${cfg.placeholder}`}>
          🎥
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update movie-row.tsx**

Add the import at the top of `src/components/movie-row.tsx`:

```ts
import { MoviePoster } from './movie-poster'
```

Replace the poster block (the `<div className="w-9 h-14 ...">` section, approximately lines 51–65):

```tsx
// Before:
<div className="w-9 h-14 bg-amber-100 rounded flex-shrink-0 overflow-hidden">
  {movie.posterUrl ? (
    <Image
      src={movie.posterUrl}
      alt={movie.title}
      width={36}
      height={56}
      className="object-cover w-full h-full"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-amber-400 text-xs">
      🎥
    </div>
  )}
</div>

// After:
<MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="sm" />
```

Also remove the `Image` import from `next/image` if it is no longer used in the file after this change.

- [ ] **Step 3: Update movie-card.tsx**

Add the import at the top of `src/components/movie-card.tsx`:

```ts
import { MoviePoster } from './movie-poster'
```

Replace the poster block (the `<div className="relative w-full aspect-[2/3] ...">` section, approximately lines 84–89):

```tsx
// Before:
<div className="relative w-full aspect-[2/3] bg-amber-100">
  {movie.posterUrl ? (
    <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-amber-300 text-4xl">🎥</div>
  )}
</div>

// After:
<MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="lg" />
```

Also remove the `Image` import from `next/image` if it is no longer used in the file after this change.

- [ ] **Step 4: Update recommendations/page.tsx**

Add the import at the top of `src/app/recommendations/page.tsx`:

```ts
import { MoviePoster } from '@/components/movie-poster'
```

Replace the poster block (the `<div className="w-16 h-24 ...">` section, approximately lines 206–220):

```tsx
// Before:
<div className="w-16 h-24 bg-amber-100 rounded-lg flex-shrink-0 overflow-hidden">
  {rec.tmdb?.posterUrl ? (
    <Image
      src={rec.tmdb.posterUrl}
      alt={rec.title}
      width={64}
      height={96}
      className="object-cover w-full h-full"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-amber-300 text-2xl">
      🎥
    </div>
  )}
</div>

// After:
<MoviePoster posterUrl={rec.tmdb?.posterUrl} title={rec.title} size="md" />
```

Also remove the `Image` import from `next/image` if it is no longer used in the file after this change.

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all 72 tests pass. The `movie-card.test.tsx` mocks `next/image` at the module level — this mock covers `next/image` imported inside `MoviePoster` as well, so those tests continue to work.

- [ ] **Step 6: Commit**

```bash
git add src/components/movie-poster.tsx src/components/movie-row.tsx src/components/movie-card.tsx src/app/recommendations/page.tsx
git commit -m "refactor: extract MoviePoster component; replace three inline poster blocks"
```

---

## Task 6: Extract validation helper in ratings/route.ts

**Files:**
- Modify: `src/app/api/ratings/route.ts`

- [ ] **Step 1: Rewrite ratings/route.ts with shared validateRatingBody**

Replace the entire file `src/app/api/ratings/route.ts` with:

```ts
// src/app/api/ratings/route.ts
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { USER_KEYS } from '@/lib/users'

interface RatingBody {
  movieId: number
  user: string
  rating: string
  quote: string
}

function validateRatingBody(body: Partial<RatingBody>): NextResponse | null {
  if (!USER_KEYS.includes(body.user as any)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }
  if (!['up', 'down'].includes(body.rating ?? '')) {
    return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 422 })
  }
  if (!body.quote?.trim()) {
    return NextResponse.json({ error: 'quote required' }, { status: 422 })
  }
  return null
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const invalid = validateRatingBody(body)
  if (invalid) return invalid

  const { movieId, user, rating, quote } = body as RatingBody

  await prisma.rating.create({
    data: { movieId, user, rating, quote: quote.trim() },
  })

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  const complete = ratings.length === 2

  return NextResponse.json({ complete, ratings }, { status: 201 })
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const invalid = validateRatingBody(body)
  if (invalid) return invalid

  const { movieId, user, rating, quote } = body as RatingBody

  try {
    await prisma.rating.update({
      where: { movieId_user: { movieId, user } },
      data: { rating, quote: quote.trim() },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'rating not found' }, { status: 404 })
    }
    throw err
  }

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  return NextResponse.json({ ratings }, { status: 200 })
}
```

Note: This step implements both Tasks 6 and 7 in one file rewrite. The `validateRatingBody` extraction and the `Prisma.PrismaClientKnownRequestError` fix are applied together since they're in the same file. The test mock update (Task 7) must also be applied before running tests — proceed immediately to Task 7.

- [ ] **Step 2: Do not run tests yet — proceed to Task 7 to update the test mock first**

---

## Task 7: Fix Prisma error mock in ratings test

**Files:**
- Modify: `tests/api.ratings.test.ts`

- [ ] **Step 1: Update the P2025 mock to use the proper Prisma type**

In `tests/api.ratings.test.ts`, find the test `'returns 404 when no prior rating exists'` (approximately line 106). Replace the mock error construction:

```ts
// Before:
const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' })

// After:
const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
  code: 'P2025',
  clientVersion: '7.0.0',
})
```

Also add the `Prisma` import at the top of the test file (after the existing imports):

```ts
import { Prisma } from '@prisma/client'
```

- [ ] **Step 2: Run ratings tests to verify all pass**

```bash
npm run test:run -- tests/api.ratings.test.ts
```

Expected: all 9 ratings tests pass, including the P2025 → 404 path.

- [ ] **Step 3: Run the full test suite**

```bash
npm run test:run
```

Expected: all 72 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ratings/route.ts tests/api.ratings.test.ts
git commit -m "refactor: extract validateRatingBody; use Prisma SDK type for P2025 detection"
```

---

## Final verification

- [ ] **Run the full test suite one last time**

```bash
npm run test:run
```

Expected: 72 tests pass (68 original + 4 new `formatRuntime` tests).

- [ ] **Run the linter**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Run a production build**

```bash
npm run build
```

Expected: build succeeds with no type errors.
