# Watchlist & Watched Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a text search input and category filter buttons to the watchlist and watched views so the user can quickly narrow long lists.

**Architecture:** All filtering is in-memory on the client — no new API routes. A shared `FilterBar` component is used in both views. The watchlist already owns its state as a client component; the watched page extracts a thin `WatchedClient` wrapper that receives server-fetched movies as props and owns the filter state locally.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Vitest + @testing-library/react

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/filter-bar.tsx` | Controlled search input + pill buttons |
| Create | `src/components/watched-client.tsx` | Client wrapper for watched grid with filter state |
| Modify | `src/app/watchlist/page.tsx` | Add search + status filter state; render FilterBar |
| Modify | `src/app/watched/page.tsx` | Pass movies/userNames to WatchedClient |
| Create | `tests/filter-bar.test.tsx` | Unit tests for FilterBar |
| Create | `tests/watched-client.test.tsx` | Unit tests for WatchedClient |

---

## Task 1: FilterBar component

**Files:**
- Create: `src/components/filter-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/filter-bar.tsx
'use client'

interface FilterButton {
  label: string
  value: string
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  buttons: FilterButton[]
  activeButton: string | null
  onButtonChange: (value: string | null) => void
}

export function FilterBar({
  search,
  onSearchChange,
  buttons,
  activeButton,
  onButtonChange,
}: FilterBarProps) {
  return (
    <div className="mb-4 space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search titles…"
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
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write tests**

```tsx
// tests/filter-bar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '@/components/filter-bar'

const buttons = [
  { label: 'Ready', value: 'available' },
  { label: 'Queued', value: 'pending' },
]

describe('FilterBar', () => {
  it('renders search input with correct placeholder', () => {
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton={null} onButtonChange={() => {}} />
    )
    expect(screen.getByPlaceholderText('Search titles…')).toBeInTheDocument()
  })

  it('calls onSearchChange when typing', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={onChange} buttons={buttons} activeButton={null} onButtonChange={() => {}} />
    )
    fireEvent.change(screen.getByPlaceholderText('Search titles…'), { target: { value: 'akira' } })
    expect(onChange).toHaveBeenCalledWith('akira')
  })

  it('renders All button plus provided buttons', () => {
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton={null} onButtonChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Queued' })).toBeInTheDocument()
  })

  it('calls onButtonChange with null when All is clicked', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton="available" onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onButtonChange with button value when a button is clicked', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton={null} onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    expect(onChange).toHaveBeenCalledWith('available')
  })

  it('toggles off when the active button is clicked again', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton="available" onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- tests/filter-bar.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/filter-bar.tsx tests/filter-bar.test.tsx
git commit -m "feat: add FilterBar component with text search and pill buttons"
```

---

## Task 2: Integrate FilterBar into the watchlist

**Files:**
- Modify: `src/app/watchlist/page.tsx`

- [ ] **Step 1: Add filter state, filteredMovies derivation, and FilterBar to the watchlist page**

Replace the entire file with:

```tsx
// src/app/watchlist/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { MovieRow } from '@/components/movie-row'
import { RatingDialog } from '@/components/rating-dialog'
import { FilterBar } from '@/components/filter-bar'
import type { Movie, User } from '@/types'

const STATUS_BUTTONS = [
  { label: 'Not Requested', value: 'not_requested' },
  { label: 'Queued', value: 'pending' },
  { label: 'Downloading', value: 'processing' },
  { label: 'Ready', value: 'available' },
]

export default function WatchlistPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null)
  const [userNames, setUserNames] = useState<Record<User, string>>({ user1: 'User 1', user2: 'User 2' })
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  const fetchMovies = useCallback(async () => {
    const data = await fetch('/api/movies').then((r) => r.json())
    setMovies(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMovies()
    fetch('/api/user-names')
      .then((r) => r.json())
      .then(setUserNames)
      .catch(() => {})
  }, [fetchMovies])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const filteredMovies = movies
    .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => activeStatus === null || m.seerrStatus === activeStatus)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = movies.findIndex((m) => m.id === active.id)
    const newIndex = movies.findIndex((m) => m.id === over.id)

    setMovies(arrayMove(movies, oldIndex, newIndex))

    await fetch(`/api/movies/${active.id}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newIndex }),
    })

    fetchMovies()
  }

  const handleForceDownload = async (movieId: number) => {
    await fetch(`/api/movies/${movieId}/download`, { method: 'POST' })
    fetchMovies()
  }

  const handleRemove = async (movieId: number) => {
    setMovies((prev) => prev.filter((m) => m.id !== movieId))
    await fetch(`/api/movies/${movieId}`, { method: 'DELETE' })
  }

  const readyCount = movies.filter((m) => m.seerrStatus === 'available').length

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-amber-900">Up Next</h1>
        {!loading && (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 rounded-full">
            {movies.length} movies · {readyCount} ready
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white border border-amber-100 rounded-xl px-4 py-3 animate-pulse"
            >
              <div className="w-5 h-5 bg-amber-100 rounded" />
              <div className="w-5 h-5 bg-amber-100 rounded" />
              <div className="w-9 h-14 bg-amber-100 rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-amber-100 rounded w-2/3" />
                <div className="h-2 bg-amber-50 rounded w-1/3" />
              </div>
              <div className="w-16 h-5 bg-amber-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            buttons={STATUS_BUTTONS}
            activeButton={activeStatus}
            onButtonChange={setActiveStatus}
          />

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredMovies.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              {filteredMovies.map((movie, index) => (
                <MovieRow
                  key={movie.id}
                  movie={movie}
                  position={index + 1}
                  onMarkWatched={setRatingTarget}
                  onForceDownload={handleForceDownload}
                  onRemove={handleRemove}
                />
              ))}
            </SortableContext>
          </DndContext>

          {filteredMovies.length === 0 && (
            <div className="text-center text-amber-600 mt-16">
              <div className="text-5xl mb-4">🎬</div>
              <p className="font-medium">{search || activeStatus ? 'No movies match your filter' : 'No movies yet'}</p>
              <p className="text-sm text-amber-500 mt-1">
                {search || activeStatus ? 'Try clearing the search or filter' : 'Add some from the sidebar'}
              </p>
            </div>
          )}
        </>
      )}

      {ratingTarget && (
        <RatingDialog
          movie={ratingTarget}
          open={true}
          userNames={userNames}
          onClose={() => setRatingTarget(null)}
          onComplete={() => {
            setRatingTarget(null)
            fetchMovies()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npm run test:run
```

Expected: all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/watchlist/page.tsx
git commit -m "feat: add text search and status filter to watchlist"
```

---

## Task 3: WatchedClient component

**Files:**
- Create: `src/components/watched-client.tsx`
- Create: `tests/watched-client.test.tsx`

- [ ] **Step 1: Create the WatchedClient component**

```tsx
// src/components/watched-client.tsx
'use client'
import { useState } from 'react'
import { FilterBar } from './filter-bar'
import { MovieCard } from './movie-card'
import type { Movie, User } from '@/types'

const AGREEMENT_BUTTONS = [
  { label: '🤝 Agreed', value: 'agreed' },
  { label: '⚔️ Disagreed', value: 'disagreed' },
]

interface WatchedClientProps {
  movies: Movie[]
  userNames: Record<User, string>
}

export function WatchedClient({ movies, userNames }: WatchedClientProps) {
  const [search, setSearch] = useState('')
  const [activeAgreement, setActiveAgreement] = useState<string | null>(null)

  const filteredMovies = movies
    .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => {
      if (activeAgreement === null) return true
      const ratings = m.ratings ?? []
      if (ratings.length < 2) return false
      const agreed = ratings[0].rating === ratings[1].rating
      return activeAgreement === 'agreed' ? agreed : !agreed
    })

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        buttons={AGREEMENT_BUTTONS}
        activeButton={activeAgreement}
        onButtonChange={setActiveAgreement}
      />

      {filteredMovies.length === 0 ? (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium">
            {search || activeAgreement ? 'No movies match your filter' : 'Nothing watched yet'}
          </p>
          <p className="text-sm text-amber-500 mt-1">
            {search || activeAgreement
              ? 'Try clearing the search or filter'
              : 'Your finished films will appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} userNames={userNames} />
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Write tests**

```tsx
// tests/watched-client.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WatchedClient } from '@/components/watched-client'
import type { Movie, User, Rating } from '@/types'

// next/image doesn't work in jsdom — render a plain img instead
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

function makeRating(id: number, movieId: number, user: User, rating: 'up' | 'down'): Rating {
  return { id, movieId, user, rating, quote: 'A quote', submittedAt: new Date().toISOString() }
}

function makeMovie(id: number, title: string, ratings: Rating[] = []): Movie {
  return {
    id,
    title,
    year: 2000,
    runtime: 90,
    description: '',
    posterUrl: '',
    imdbId: `tt${id}`,
    tmdbId: id,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: id,
    status: 'watched',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'available',
    watchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ratings,
  }
}

const agreedMovie = makeMovie(1, 'Akira', [
  makeRating(1, 1, 'user1', 'up'),
  makeRating(2, 1, 'user2', 'up'),
])
const disagreedMovie = makeMovie(2, 'Breathless', [
  makeRating(3, 2, 'user1', 'up'),
  makeRating(4, 2, 'user2', 'down'),
])
const unratedMovie = makeMovie(3, 'Sunrise', [])

const movies = [agreedMovie, disagreedMovie, unratedMovie]

describe('WatchedClient', () => {
  it('renders all movies by default', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.getByText('Breathless')).toBeInTheDocument()
    expect(screen.getByText('Sunrise')).toBeInTheDocument()
  })

  it('filters by title text (case-insensitive)', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.change(screen.getByPlaceholderText('Search titles…'), { target: { value: 'akira' } })
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.queryByText('Breathless')).not.toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('filters to agreed movies when 🤝 Agreed is clicked', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '🤝 Agreed' }))
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.queryByText('Breathless')).not.toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('filters to disagreed movies when ⚔️ Disagreed is clicked', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '⚔️ Disagreed' }))
    expect(screen.queryByText('Akira')).not.toBeInTheDocument()
    expect(screen.getByText('Breathless')).toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('excludes unrated movies from agreement filters', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '🤝 Agreed' }))
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('shows filter-specific empty state when no movies match', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.change(screen.getByPlaceholderText('Search titles…'), { target: { value: 'zzznomatch' } })
    expect(screen.getByText('No movies match your filter')).toBeInTheDocument()
  })

  it('restores all movies when All is clicked', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '🤝 Agreed' }))
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.getByText('Breathless')).toBeInTheDocument()
    expect(screen.getByText('Sunrise')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- tests/watched-client.test.tsx
```

Expected: 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/watched-client.tsx tests/watched-client.test.tsx
git commit -m "feat: add WatchedClient component with text search and agreement filter"
```

---

## Task 4: Wire WatchedClient into the watched page

**Files:**
- Modify: `src/app/watched/page.tsx`

- [ ] **Step 1: Update the watched page to delegate rendering to WatchedClient**

Replace the entire file with:

```tsx
// src/app/watched/page.tsx
import { prisma } from '@/lib/db'
import { getUserNames } from '@/lib/users'
import { WatchedClient } from '@/components/watched-client'
import type { Movie } from '@/types'

export const dynamic = 'force-dynamic'

export default async function WatchedPage() {
  const [movies, userNames] = await Promise.all([
    prisma.movie.findMany({
      where: { status: 'watched' },
      orderBy: { watchedAt: 'desc' },
      include: { ratings: true },
    }),
    Promise.resolve(getUserNames()),
  ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Watched</h1>
      <WatchedClient movies={movies as unknown as Movie[]} userNames={userNames} />
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/watched/page.tsx
git commit -m "feat: wire WatchedClient into watched page"
```
