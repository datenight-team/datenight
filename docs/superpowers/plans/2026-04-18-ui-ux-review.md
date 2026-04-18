# UI/UX Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 9 UI/UX review findings across two PRs — PR 1 fixes usability (high/medium priority), PR 2 fixes polish and accessibility (low priority).

**Architecture:** All changes are purely presentational — no API routes, no Prisma schema changes, no new endpoints. Tests live in `tests/` and use `@testing-library/react` + Vitest + jsdom. The `makeMovie()` helper pattern from `tests/movie-card.test.tsx` is the established way to build Movie fixtures.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS · Vitest · @testing-library/react

---

## PR 1 — Usability Fixes (Fixes 1–5)

---

### Task 1: Status pill color hierarchy (Fix 5)

**Files:**
- Create: `tests/movie-row.test.tsx`
- Modify: `src/components/movie-row.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/movie-row.test.tsx`:

```tsx
// tests/movie-row.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MovieRow } from '@/components/movie-row'
import type { Movie, User } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

vi.stubGlobal('fetch', vi.fn())

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
    ratings: [],
    streamingProviders: [],
    ...overrides,
  }
}

const defaultProps = {
  position: 1,
  seerrUrl: null,
  streamingProviders: [],
  streamingLink: null,
  onMarkWatched: vi.fn(),
  onForceDownload: vi.fn(),
  onRemove: vi.fn(),
}

describe('MovieRow status pill colors', () => {
  it('renders not_requested pill with stone classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'not_requested' })} {...defaultProps} />)
    const pill = screen.getByText('Not Requested')
    expect(pill).toHaveClass('bg-stone-100', 'text-stone-500', 'border-stone-200')
  })

  it('renders pending pill with indigo classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'pending' })} {...defaultProps} />)
    const pill = screen.getByText('Queued')
    expect(pill).toHaveClass('bg-indigo-50', 'text-indigo-600', 'border-indigo-200')
  })

  it('renders processing pill with amber classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'processing' })} {...defaultProps} />)
    const pill = screen.getByText('Downloading')
    expect(pill).toHaveClass('bg-amber-50', 'text-amber-600', 'border-amber-200')
  })

  it('renders available pill with green classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'available' })} {...defaultProps} />)
    const pill = screen.getByText('Ready')
    expect(pill).toHaveClass('bg-green-50', 'text-green-700', 'border-green-200')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/user/src/ianchesal/datenight && npm run test:run -- tests/movie-row.test.tsx
```

Expected: 4 FAIL — pills have wrong colour classes.

- [ ] **Step 3: Replace seerrPillClass with a full map in movie-row.tsx**

In `src/components/movie-row.tsx`, replace lines 50–53:

```tsx
// Remove this:
const seerrPillClass =
  movie.seerrStatus === "available"
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-stone-100 text-stone-500 border-stone-200";

// Add this:
const SEERR_PILL_CLASS: Record<string, string> = {
  not_requested: "bg-stone-100 text-stone-500 border-stone-200",
  pending:       "bg-indigo-50 text-indigo-600 border-indigo-200",
  processing:    "bg-amber-50 text-amber-600 border-amber-200",
  available:     "bg-green-50 text-green-700 border-green-200",
  deleted:       "bg-stone-100 text-stone-500 border-stone-200",
};
const seerrPillClass = SEERR_PILL_CLASS[movie.seerrStatus] ?? "bg-stone-100 text-stone-500 border-stone-200";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/movie-row.test.tsx
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/movie-row.test.tsx src/components/movie-row.tsx
git commit -m "fix: add stepped colour system to Seerr status pills"
```

---

### Task 2: MovieRow layout restructure — pills into info section (Fix 1)

**Files:**
- Modify: `tests/movie-row.test.tsx`
- Modify: `src/components/movie-row.tsx`

- [ ] **Step 1: Add failing tests**

Append to the `describe('MovieRow status pill colors')` block in `tests/movie-row.test.tsx`:

```tsx
describe('MovieRow layout', () => {
  it('renders streaming badge inside the info section (not actions column)', () => {
    render(
      <MovieRow
        movie={makeMovie({ seerrStatus: 'available' })}
        {...defaultProps}
        streamingProviders={[{ id: 99, movieId: 1, providerId: 8, providerName: 'Netflix' }]}
        streamingLink="https://netflix.com"
      />
    )
    const infoSection = screen.getByText('Jeanne Dielman').closest('div')
    expect(infoSection).toContainElement(screen.getByText('Streaming'))
  })

  it('renders the Seerr status pill inside the info section', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'pending' })} {...defaultProps} />)
    const infoSection = screen.getByText('Jeanne Dielman').closest('div')
    expect(infoSection).toContainElement(screen.getByText('Queued'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/movie-row.test.tsx
```

Expected: 2 FAIL — pills are currently in the actions column, not the info div.

- [ ] **Step 3: Restructure MovieRow JSX**

Replace the entire return JSX in `src/components/movie-row.tsx` (from `<div className="flex items-start gap-3 ...">` through the closing `</>`) with:

```tsx
  return (
    <>
      <div className="flex items-center gap-3 bg-white border border-amber-200 rounded-xl px-4 py-3 mb-2 shadow-sm">
        {/* Position */}
        <span className="text-amber-700 font-bold text-sm w-5 text-center flex-shrink-0">
          {position}
        </span>

        {/* Poster */}
        <div className="flex-shrink-0">
          <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="sm" />
        </div>

        {/* Info — title, year, pills, streaming */}
        <div className="flex-1 min-w-0">
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

          {/* Status pills + streaming info live here */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {isStreamable && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200">
                Streaming
              </span>
            )}
            {isCheckingStreaming && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-500 border-amber-200">
                Checking…
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${seerrPillClass}`}>
              {SEERR_LABEL[movie.seerrStatus] ?? movie.seerrStatus}
            </span>
            {isStreamable && streamingProviders.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.providerId}
                src={`/streaming-logos/${p.providerId}.png`}
                alt={p.providerName}
                title={p.providerName}
                width={16}
                height={16}
                className="rounded-sm object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none"
                }}
              />
            ))}
            {isStreamable && streamingLink && (
              <a
                href={streamingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-stone-600 bg-stone-800 text-white px-2 py-0.5 text-xs font-medium hover:bg-stone-700 transition-colors"
              >
                Watch ↗
              </a>
            )}
          </div>
        </div>

        {/* Actions — single row */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
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

          {confirming ? (
            <>
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
            </>
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

      {/* Seerr cleanup dialog — unchanged */}
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
                  setAskSeerr(false)
                  onRemove(movie.id, { seerr: true })
                }}
              >
                Yes, remove from Plex
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-stone-200 text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  setAskSeerr(false)
                  onRemove(movie.id, { seerr: false })
                }}
              >
                No, just the list
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
```

- [ ] **Step 4: Run all tests**

```bash
npm run test:run -- tests/movie-row.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/movie-row.tsx tests/movie-row.test.tsx
git commit -m "fix: move status pills and streaming info into movie row info section"
```

---

### Task 3: Rating dialog — required field indication and submit guard (Fix 2)

**Files:**
- Create: `tests/rating-dialog.test.tsx`
- Modify: `src/components/rating-dialog.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/rating-dialog.test.tsx`:

```tsx
// tests/rating-dialog.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RatingDialog } from '@/components/rating-dialog'
import type { Movie, User } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

const movie: Movie = {
  id: 1,
  title: 'Beau Travail',
  year: 1999,
  runtime: 93,
  description: '',
  posterUrl: '',
  imdbId: 'tt0165227',
  tmdbId: 10066,
  criterionUrl: null,
  imdbUrl: null,
  sortOrder: 1,
  status: 'watchlist',
  seerrRequestId: null,
  seerrMediaId: null,
  seerrStatus: 'not_requested',
  watchedAt: null,
  createdAt: new Date().toISOString(),
  streamingLastChecked: null,
  streamingLink: null,
  ratings: [],
  streamingProviders: [],
}

async function advanceToFormStep() {
  // Click first user to advance from 'who' → 'form'
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  fireEvent.click(screen.getByText('Alice'))
  await waitFor(() => expect(screen.getByText(/Alice's verdict/)).toBeInTheDocument())
}

describe('RatingDialog required field indication', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    render(
      <RatingDialog
        movie={movie}
        open={true}
        userNames={userNames}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    )
  })

  it('shows an asterisk on the Critic\'s Quote label', async () => {
    await advanceToFormStep()
    expect(screen.getByText("Critic's Quote")).toBeInTheDocument()
    // The asterisk lives in the same label row
    const label = screen.getByText("Critic's Quote").closest('p') ?? screen.getByText("Critic's Quote").parentElement
    expect(label?.textContent).toContain('*')
  })

  it('disables Submit when neither verdict nor quote is filled', async () => {
    await advanceToFormStep()
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('keeps Submit disabled when only quote is filled', async () => {
    await advanceToFormStep()
    fireEvent.change(screen.getByPlaceholderText(/a sentence or two/i), {
      target: { value: 'A great film.' },
    })
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('enables Submit when both verdict and quote are filled', async () => {
    await advanceToFormStep()
    // Click the thumbs-up button (rendered by ThumbRating)
    fireEvent.click(screen.getByLabelText(/thumbs up/i))
    fireEvent.change(screen.getByPlaceholderText(/a sentence or two/i), {
      target: { value: 'Magnificent.' },
    })
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Check the aria-label on ThumbRating's thumbs-up button**

Before running tests, verify the ThumbRating component uses `aria-label="thumbs up"` (or similar):

```bash
grep -n "aria-label" /home/user/src/ianchesal/datenight/src/components/thumb-rating.tsx
```

If the label is different, update the `getByLabelText` in the test to match.

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test:run -- tests/rating-dialog.test.tsx
```

Expected: FAIL — Submit is not disabled, asterisk not present.

- [ ] **Step 4: Update RatingDialog**

In `src/components/rating-dialog.tsx`, make three targeted changes:

**Add a `canSubmit` computed value** after the state declarations (after line 32, the `const [submitting, ...]` line):

```tsx
  const canSubmit = rating !== undefined && quote.trim().length > 0
```

**Update the Critic's Quote label** (around line 109) — add asterisk:

```tsx
              <p className="text-xs text-stone-500 mb-1">
                Critic&apos;s Quote <span aria-hidden="true" className="text-red-500">*</span>
              </p>
```

**Disable the Submit button** (around line 119) — add `disabled` prop:

```tsx
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
```

Leave the existing `error` state and the `if (!currentUser || !rating || !quote.trim())` guard in `handleSubmit` as-is — they act as a safety net and don't need to be removed.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run -- tests/rating-dialog.test.tsx
```

Expected: 4 PASS.

- [ ] **Step 6: Run the full test suite**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/rating-dialog.tsx tests/rating-dialog.test.tsx
git commit -m "fix: disable rating submit until verdict and quote are both filled"
```

---

### Task 4: FilterBar extraPills prop — unify Streamable toggle (Fix 3)

**Files:**
- Create: `tests/filter-bar.test.tsx`
- Modify: `src/components/filter-bar.tsx`
- Modify: `src/app/watchlist/page.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/filter-bar.test.tsx`:

```tsx
// tests/filter-bar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '@/components/filter-bar'

const buttons = [
  { label: 'Not Requested', value: 'not_requested' },
  { label: 'Ready', value: 'available' },
]

describe('FilterBar', () => {
  it('renders search input and status pills', () => {
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Search titles…')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Not Requested')).toBeInTheDocument()
  })

  it('renders extraPills in the same pill row as status buttons', () => {
    const onToggle = vi.fn()
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
        extraPills={[{ label: '▶ Streamable', active: false, onToggle }]}
      />
    )
    const streamablePill = screen.getByText('▶ Streamable')
    expect(streamablePill).toBeInTheDocument()
    // Should sit in the same flex row as 'All'
    expect(streamablePill.closest('div')).toBe(
      screen.getByText('All').closest('div')
    )
  })

  it('calls onToggle when an extraPill is clicked', () => {
    const onToggle = vi.fn()
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
        extraPills={[{ label: '▶ Streamable', active: false, onToggle }]}
      />
    )
    fireEvent.click(screen.getByText('▶ Streamable'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('applies active styles when an extraPill is active', () => {
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
        extraPills={[{ label: '▶ Streamable', active: true, onToggle: vi.fn() }]}
      />
    )
    expect(screen.getByText('▶ Streamable')).toHaveClass('bg-green-500')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/filter-bar.test.tsx
```

Expected: FAIL — `extraPills` prop doesn't exist.

- [ ] **Step 3: Update FilterBar to accept extraPills**

Replace the contents of `src/components/filter-bar.tsx` with:

```tsx
// src/components/filter-bar.tsx
'use client'

interface FilterButton {
  label: string
  value: string
}

interface ExtraPill {
  label: string
  active: boolean
  onToggle: () => void
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  buttons: FilterButton[]
  activeButton: string | null
  onButtonChange: (value: string | null) => void
  extraPills?: ExtraPill[]
}

export function FilterBar({
  search,
  onSearchChange,
  buttons,
  activeButton,
  onButtonChange,
  extraPills,
}: FilterBarProps) {
  return (
    <div className="mb-4 space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search titles…"
        aria-label="Search titles"
        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onButtonChange(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeButton === null
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
          }`}
        >
          All
        </button>
        {buttons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => onButtonChange(activeButton === btn.value ? null : btn.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeButton === btn.value
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            {btn.label}
          </button>
        ))}
        {extraPills?.map((pill) => (
          <button
            key={pill.label}
            onClick={pill.onToggle}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              pill.active
                ? 'border-green-500 bg-green-500 text-white'
                : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update watchlist/page.tsx to pass Streamable as an extraPill**

In `src/app/watchlist/page.tsx`:

1. Remove the `import { Play } from 'lucide-react'` line.
2. Remove the standalone streamable toggle block (the `{streamingServiceIds.length > 0 && (<div className="mb-3">...)}` block, roughly lines 148–163).
3. Update the `<FilterBar>` call to add the `extraPills` prop:

```tsx
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            buttons={STATUS_BUTTONS}
            activeButton={activeFilter}
            onButtonChange={setActiveFilter}
            extraPills={
              streamingServiceIds.length > 0
                ? [{ label: '▶ Streamable', active: streamableOnly, onToggle: () => setStreamableOnly((v) => !v) }]
                : undefined
            }
          />
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/filter-bar.tsx src/app/watchlist/page.tsx tests/filter-bar.test.tsx
git commit -m "fix: integrate Streamable toggle into FilterBar as an extraPill"
```

---

### Task 5: Navigation — Settings demoted from mobile bottom nav to header sheet (Fix 4)

**Files:**
- Modify: `tests/mobile-bottom-nav.test.tsx`
- Modify: `tests/mobile-header.test.tsx`
- Modify: `src/components/mobile-bottom-nav.tsx`
- Modify: `src/components/mobile-header.tsx`

- [ ] **Step 1: Update the existing mobile-bottom-nav test to assert Settings is absent**

In `tests/mobile-bottom-nav.test.tsx`, add one test inside `describe('MobileBottomNav')`:

```tsx
  it('does not include Settings in the bottom nav tabs', () => {
    render(<MobileBottomNav />)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })
```

Also update the `'highlights the active tab'` test: the active icon pill class will change from `bg-amber-100` to `bg-amber-600` in Task 8. Leave it as-is for now — Task 8 will update it.

- [ ] **Step 2: Update the mobile-header test to assert Settings appears in the sheet**

In `tests/mobile-header.test.tsx`, add inside the `'opens the More sheet'` test:

```tsx
    await waitFor(() => {
      expect(screen.getByText('Browse Criterion')).toBeInTheDocument()
      expect(screen.getByText('Browse IMDB')).toBeInTheDocument()
      expect(screen.getByText('🎭 Sync Plex')).toBeInTheDocument()
      expect(screen.getByText('✨ Ask Claude')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    })
```

- [ ] **Step 3: Run tests to verify the new assertions fail**

```bash
npm run test:run -- tests/mobile-bottom-nav.test.tsx tests/mobile-header.test.tsx
```

Expected: `'does not include Settings'` FAIL (Settings IS in nav), `'opens the More sheet'` FAIL (Settings link not in sheet).

- [ ] **Step 4: Remove Settings from mobile-bottom-nav.tsx**

In `src/components/mobile-bottom-nav.tsx`, remove the Settings entry from the `tabs` array:

```tsx
const tabs = [
  { href: '/watchlist', label: 'List',     icon: '📋' },
  { href: '/watched',   label: 'Watched',  icon: '✅' },
  { href: '/add',       label: 'Add',      icon: '➕' },
  { href: '/recommendations', label: 'Recs', icon: '🎯' },
]
```

- [ ] **Step 5: Add Settings to the mobile-header.tsx sheet**

In `src/components/mobile-header.tsx`, add a Settings `Link` after the `<AskClaudeLink />` line. Add the `Link` import from `next/link` at the top:

```tsx
import Link from 'next/link'
```

Then inside the `<div className="flex flex-col gap-1 mt-2">`, after `<AskClaudeLink />`:

```tsx
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">⚙️</span>
              <span>Settings</span>
            </Link>
```

- [ ] **Step 6: Run all tests**

```bash
npm run test:run
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mobile-bottom-nav.tsx src/components/mobile-header.tsx \
  tests/mobile-bottom-nav.test.tsx tests/mobile-header.test.tsx
git commit -m "fix: demote Settings from mobile bottom nav to header more sheet"
```

---

### Task 6: Open PR 1

- [ ] **Step 1: Push the branch and open PR**

```bash
git push -u origin ian/ui-ux-review
```

Then open a PR targeting `main` with title: `fix: UI/UX review — usability fixes (PR 1 of 2)`

Body:
```
Addresses the High and Medium priority findings from the UI/UX expert review.

- **Fix 1:** Status pills and streaming badges move from the actions column into the movie info section — row heights are now uniform
- **Fix 2:** Rating Submit disabled until verdict + quote both filled; asterisk on required label
- **Fix 3:** Streamable toggle integrated into FilterBar as an extraPill — all filters in one visual group
- **Fix 4:** Settings removed from mobile bottom nav; appears in the ⋯ header more sheet instead
- **Fix 5:** Stepped colour system for Seerr status pills: grey → indigo → amber → green
```

---

## PR 2 — Polish & Accessibility (Fixes 6, 8, 9, 10)

> Start a clean branch from main after PR 1 merges, or branch from PR 1 if you want to stack them.

---

### Task 7: Watch ↗ button palette fix (Fix 6)

**Files:**
- Modify: `tests/movie-row.test.tsx`
- Modify: `src/components/movie-row.tsx`

- [ ] **Step 1: Add a failing test**

Append inside `describe('MovieRow layout')` in `tests/movie-row.test.tsx`:

```tsx
  it('renders Watch link with amber outline instead of dark stone', () => {
    render(
      <MovieRow
        movie={makeMovie({ seerrStatus: 'available' })}
        {...defaultProps}
        streamingProviders={[{ id: 99, movieId: 1, providerId: 8, providerName: 'Netflix' }]}
        streamingLink="https://netflix.com"
      />
    )
    const watchLink = screen.getByRole('link', { name: /watch/i })
    expect(watchLink).not.toHaveClass('bg-stone-800')
    expect(watchLink).toHaveClass('border-amber-400')
  })
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:run -- tests/movie-row.test.tsx
```

Expected: FAIL — Watch link currently has `bg-stone-800`.

- [ ] **Step 3: Update the Watch link classes in movie-row.tsx**

In the restructured JSX from Task 2, find the Watch link and change its className:

```tsx
              className="rounded border border-amber-400 bg-white text-amber-700 px-2 py-0.5 text-xs font-medium hover:bg-amber-50 transition-colors"
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- tests/movie-row.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/movie-row.tsx tests/movie-row.test.tsx
git commit -m "fix: restyle Watch link to amber outline to match palette"
```

---

### Task 8: Sidebar — remove Browse links; add to Add page (Fix 8)

**Files:**
- Create: `tests/sidebar.test.tsx`
- Create: `tests/add-page.test.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/add/page.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/sidebar.test.tsx`:

```tsx
// tests/sidebar.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/watchlist',
}))

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
}))

import { Sidebar } from '@/components/sidebar'

describe('Sidebar', () => {
  it('renders primary nav links', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /watch list/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /watched/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add movie/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /recommend/i })).toBeInTheDocument()
  })

  it('does not render Browse Criterion or Browse IMDB in the utility footer', () => {
    render(<Sidebar />)
    expect(screen.queryByText(/browse criterion/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/browse imdb/i)).not.toBeInTheDocument()
  })
})
```

Create `tests/add-page.test.tsx`:

```tsx
// tests/add-page.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.stubGlobal('fetch', vi.fn())

import AddMoviePage from '@/app/add/page'

describe('AddMoviePage', () => {
  it('shows Browse Criterion and Browse IMDB helper links', () => {
    render(<AddMoviePage />)
    expect(screen.getByRole('link', { name: /browse criterion/i })).toHaveAttribute(
      'href',
      'https://www.criterion.com/shop/browse/list?q=&format=all'
    )
    expect(screen.getByRole('link', { name: /browse imdb/i })).toHaveAttribute(
      'href',
      'https://www.imdb.com/search/title/?title_type=feature'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/sidebar.test.tsx tests/add-page.test.tsx
```

Expected: `sidebar` FAIL (Browse links still present), `add-page` FAIL (Browse links not present yet).

- [ ] **Step 3: Remove Browse links from sidebar.tsx**

In `src/components/sidebar.tsx`, delete the two `<a>` elements for Browse Criterion and Browse IMDB from the utility footer `<div>`. The footer should then contain only: `<PlexSyncButton />`, `<StreamingRefreshButton />`, `<AskClaudeLink />`, and the Settings `<Link>`.

- [ ] **Step 4: Add Browse links to add/page.tsx**

In `src/app/add/page.tsx`, after the hint paragraph (`Supports imdb.com/title/... and criterion.com/films/... URLs`), add:

```tsx
      <div className="flex gap-4 text-xs text-amber-600 mb-6">
        <a
          href="https://www.criterion.com/shop/browse/list?q=&format=all"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-amber-800 underline transition-colors"
        >
          🎞️ Browse Criterion
        </a>
        <a
          href="https://www.imdb.com/search/title/?title_type=feature"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-amber-800 underline transition-colors"
        >
          🎬 Browse IMDB
        </a>
      </div>
```

Also remove the `<p className="text-xs text-amber-600 mb-6">` hint paragraph (the one that said `Supports imdb.com/...`) since the Browse links now carry that context. Or keep it if you prefer — either way the tests pass.

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/app/add/page.tsx \
  tests/sidebar.test.tsx tests/add-page.test.tsx
git commit -m "fix: move Browse Criterion/IMDB links from sidebar to Add page"
```

---

### Task 9: Mobile bottom nav — stronger active state (Fix 9)

**Files:**
- Modify: `tests/mobile-bottom-nav.test.tsx`
- Modify: `src/components/mobile-bottom-nav.tsx`

- [ ] **Step 1: Update the failing active-state test**

In `tests/mobile-bottom-nav.test.tsx`, update the `'highlights the active tab'` test. Change `bg-amber-100` → `bg-amber-600`:

```tsx
  it('highlights the active tab', () => {
    render(<MobileBottomNav />)
    const listLink = screen.getByRole('link', { name: /list/i })
    expect(listLink).toHaveClass('text-amber-600')
    const iconSpan = listLink.querySelector('span')
    expect(iconSpan).toHaveClass('bg-amber-600')
    const watchedLink = screen.getByRole('link', { name: /watched/i })
    expect(watchedLink).not.toHaveClass('text-amber-600')
    const inactiveIconSpan = watchedLink.querySelector('span')
    expect(inactiveIconSpan).not.toHaveClass('bg-amber-600')
  })
```

Also update the label active-class check — add a `'bold label on active tab'` test:

```tsx
  it('applies bold font weight to the active tab label', () => {
    render(<MobileBottomNav />)
    const listLink = screen.getByRole('link', { name: /list/i })
    // The label <span> is the second span child
    const spans = listLink.querySelectorAll('span')
    const labelSpan = spans[spans.length - 1]
    expect(labelSpan).toHaveClass('font-bold')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- tests/mobile-bottom-nav.test.tsx
```

Expected: `'highlights the active tab'` FAIL — icon span currently has `bg-amber-100`.

- [ ] **Step 3: Update mobile-bottom-nav.tsx active styles**

In `src/components/mobile-bottom-nav.tsx`, update the JSX inside the `tabs.map` to use stronger active styles:

```tsx
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-col items-center pt-2 pb-1 px-3 text-xs font-medium transition-colors min-w-0',
            pathname === href ? 'text-amber-600' : 'text-amber-800'
          )}
        >
          <span
            className={cn(
              'text-xl mb-0.5 px-3 py-0.5 rounded-full',
              pathname === href ? 'bg-amber-600' : ''
            )}
          >
            {icon}
          </span>
          <span className={cn(pathname === href ? 'font-bold' : 'font-medium')}>
            {label}
          </span>
        </Link>
```

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile-bottom-nav.tsx tests/mobile-bottom-nav.test.tsx
git commit -m "fix: strengthen mobile bottom nav active tab indicator"
```

---

### Task 10: aria-hidden on decorative emoji icons (Fix 10)

**Files:**
- Modify: `tests/sidebar.test.tsx`
- Modify: `tests/mobile-bottom-nav.test.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-bottom-nav.tsx`

- [ ] **Step 1: Add aria-hidden assertions to existing tests**

Append inside `describe('Sidebar')` in `tests/sidebar.test.tsx`:

```tsx
  it('wraps nav emoji icons with aria-hidden', () => {
    render(<Sidebar />)
    const navLinks = screen.getAllByRole('link')
    navLinks.forEach((link) => {
      const iconSpan = link.querySelector('span[aria-hidden="true"]')
      // Every nav link should have at least one aria-hidden emoji span
      expect(iconSpan).not.toBeNull()
    })
  })
```

Append inside `describe('MobileBottomNav')` in `tests/mobile-bottom-nav.test.tsx`:

```tsx
  it('wraps tab emoji icons with aria-hidden', () => {
    render(<MobileBottomNav />)
    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      const iconSpan = link.querySelector('span[aria-hidden="true"]')
      expect(iconSpan).not.toBeNull()
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/sidebar.test.tsx tests/mobile-bottom-nav.test.tsx
```

Expected: FAIL — emoji spans don't have `aria-hidden="true"`.

- [ ] **Step 3: Add aria-hidden to sidebar.tsx**

In `src/components/sidebar.tsx`, update the `navItems` map icon span and the logo emoji:

```tsx
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-amber-200">
        <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white text-sm">
          <span aria-hidden="true">🎬</span>
        </div>
        <span className="font-extrabold text-amber-900 text-sm">Date Night</span>
      </div>
```

And in the `navItems.map`:

```tsx
          <Link ...>
            <span aria-hidden="true">{icon}</span>
            {label}
          </Link>
```

Also wrap the emoji in the utility footer links (`🎞️`, `🎬`, `⚙️`) with `aria-hidden="true"` where applicable — but since the Browse links are removed (Task 8), only the Settings link needs it:

```tsx
        <Link href="/settings" ...>
          <span aria-hidden="true">⚙️</span> Settings
        </Link>
```

- [ ] **Step 4: Add aria-hidden to mobile-bottom-nav.tsx**

In `src/components/mobile-bottom-nav.tsx`, the icon span already exists — add `aria-hidden="true"`:

```tsx
          <span
            aria-hidden="true"
            className={cn(
              'text-xl mb-0.5 px-3 py-0.5 rounded-full',
              pathname === href ? 'bg-amber-600' : ''
            )}
          >
            {icon}
          </span>
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/components/mobile-bottom-nav.tsx \
  tests/sidebar.test.tsx tests/mobile-bottom-nav.test.tsx
git commit -m "fix: add aria-hidden to decorative emoji icons in nav components"
```

---

### Task 11: Open PR 2

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin <pr2-branch-name>
```

Open a PR targeting `main` (or PR 1's branch if stacked) with title: `fix: UI/UX review — polish and accessibility (PR 2 of 2)`

Body:
```
Addresses the Low priority findings from the UI/UX expert review.

- **Fix 6:** Watch ↗ link restyled from dark stone to amber outline — consistent with palette
- **Fix 8:** Browse Criterion/IMDB links removed from sidebar; added to Add Movie page where contextually useful
- **Fix 9:** Mobile bottom nav active tab uses filled amber-600 pill + bold label — unmissable at a glance
- **Fix 10:** Decorative emoji icons wrapped in aria-hidden spans in sidebar and mobile nav
```

---

## Quick Reference

| Fix | Files | Task |
|-----|-------|------|
| 5 (pill colours) | movie-row.tsx | Task 1 |
| 1 (row layout) | movie-row.tsx | Task 2 |
| 2 (submit guard) | rating-dialog.tsx | Task 3 |
| 3 (filter bar) | filter-bar.tsx, watchlist/page.tsx | Task 4 |
| 4 (nav settings) | mobile-bottom-nav.tsx, mobile-header.tsx | Task 5 |
| 6 (watch button) | movie-row.tsx | Task 7 |
| 8 (sidebar) | sidebar.tsx, add/page.tsx | Task 8 |
| 9 (active tab) | mobile-bottom-nav.tsx | Task 9 |
| 10 (aria-hidden) | sidebar.tsx, mobile-bottom-nav.tsx | Task 10 |

Run the full suite at any time: `npm run test:run`
