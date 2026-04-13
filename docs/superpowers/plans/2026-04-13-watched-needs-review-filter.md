# Watched Needs-Review Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user "Needs [Name]'s review" filter buttons to the `/watched` view so each partner can quickly find movies they haven't rated yet.

**Architecture:** Extend `WatchedClient` — the sole component that owns filtering state for the watched page. The filter type union expands to include `needs_user1` and `needs_user2`. The buttons array becomes dynamic (built from the `userNames` prop at render time). No other files change.

**Tech Stack:** Next.js 14, TypeScript, Vitest, @testing-library/react, jsdom

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/components/watched-client.tsx` | Modify | Extend filter type, dynamic buttons, new filter branches |
| `tests/watched-client.test.tsx` | Create | Verify filter logic for all four filter values |

---

### Task 1: Write failing tests for the needs-review filter

**Files:**
- Create: `tests/watched-client.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// tests/watched-client.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WatchedClient } from '@/components/watched-client'
import type { Movie } from '@/types'

const userNames = { user1: 'Alice', user2: 'Bob' }

function makeMovie(id: number, overrides: Partial<Movie> = {}): Movie {
  return {
    id,
    title: `Movie ${id}`,
    year: 2000,
    runtime: 100,
    description: '',
    posterUrl: '',
    imdbId: `tt000000${id}`,
    tmdbId: id,
    sortOrder: id,
    status: 'watched',
    seerrStatus: 'not_requested',
    createdAt: '2024-01-01T00:00:00.000Z',
    watchedAt: '2024-01-01T00:00:00.000Z',
    ratings: [],
    ...overrides,
  }
}

const bothRated = makeMovie(1, {
  title: 'Both Rated',
  ratings: [
    { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: '', submittedAt: '' },
    { id: 2, movieId: 1, user: 'user2', rating: 'up', quote: '', submittedAt: '' },
  ],
})

const onlyAliceRated = makeMovie(2, {
  title: 'Only Alice Rated',
  ratings: [
    { id: 3, movieId: 2, user: 'user1', rating: 'up', quote: '', submittedAt: '' },
  ],
})

const onlyBobRated = makeMovie(3, {
  title: 'Only Bob Rated',
  ratings: [
    { id: 4, movieId: 3, user: 'user2', rating: 'down', quote: '', submittedAt: '' },
  ],
})

const neitherRated = makeMovie(4, {
  title: 'Neither Rated',
  ratings: [],
})

const movies = [bothRated, onlyAliceRated, onlyBobRated, neitherRated]

describe('WatchedClient needs-review filters', () => {
  it('renders "Needs Alice" and "Needs Bob" buttons using userNames', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    expect(screen.getByRole('button', { name: /Needs Alice/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Needs Bob/i })).toBeInTheDocument()
  })

  it('"Needs Alice" shows movies where user1 has not rated', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs Alice/i }))
    expect(screen.queryByText('Both Rated')).not.toBeInTheDocument()
    expect(screen.queryByText('Only Alice Rated')).not.toBeInTheDocument()
    expect(screen.getByText('Only Bob Rated')).toBeInTheDocument()
    expect(screen.getByText('Neither Rated')).toBeInTheDocument()
  })

  it('"Needs Bob" shows movies where user2 has not rated', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs Bob/i }))
    expect(screen.queryByText('Both Rated')).not.toBeInTheDocument()
    expect(screen.queryByText('Only Bob Rated')).not.toBeInTheDocument()
    expect(screen.getByText('Only Alice Rated')).toBeInTheDocument()
    expect(screen.getByText('Neither Rated')).toBeInTheDocument()
  })

  it('"All" button clears a needs-review filter', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs Alice/i }))
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }))
    expect(screen.getByText('Both Rated')).toBeInTheDocument()
    expect(screen.getByText('Only Alice Rated')).toBeInTheDocument()
    expect(screen.getByText('Only Bob Rated')).toBeInTheDocument()
    expect(screen.getByText('Neither Rated')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/watched-client.test.tsx
```

Expected: tests FAIL (component does not yet have `needs_user1`/`needs_user2` logic or dynamic button labels)

---

### Task 2: Implement the filter in WatchedClient

**Files:**
- Modify: `src/components/watched-client.tsx`

- [ ] **Step 1: Replace the file with the updated implementation**

Replace the entire contents of `src/components/watched-client.tsx` with:

```tsx
'use client'
import { useState } from 'react'
import { FilterBar } from './filter-bar'
import { MovieCard } from './movie-card'
import type { Movie, User } from '@/types'

type ActiveFilter = 'agreed' | 'disagreed' | 'needs_user1' | 'needs_user2'

interface WatchedClientProps {
  movies: Movie[]
  userNames: Record<User, string>
}

export function WatchedClient({ movies, userNames }: WatchedClientProps) {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null)

  const buttons = [
    { label: '🤝 Agreed',                       value: 'agreed' },
    { label: '⚔️ Disagreed',                    value: 'disagreed' },
    { label: `📋 Needs ${userNames.user1}`,      value: 'needs_user1' },
    { label: `📋 Needs ${userNames.user2}`,      value: 'needs_user2' },
  ]

  const lowerSearch = search.toLowerCase()
  const filteredMovies = movies.filter((m) => {
    if (!m.title.toLowerCase().includes(lowerSearch)) return false
    if (activeFilter === null) return true
    const ratings = m.ratings ?? []
    if (activeFilter === 'needs_user1') return !ratings.some((r) => r.user === 'user1')
    if (activeFilter === 'needs_user2') return !ratings.some((r) => r.user === 'user2')
    if (ratings.length < 2) return false
    const agreed = ratings[0].rating === ratings[1].rating
    return activeFilter === 'agreed' ? agreed : !agreed
  })

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        buttons={buttons}
        activeButton={activeFilter}
        onButtonChange={(v) => setActiveFilter(v as ActiveFilter | null)}
      />

      {filteredMovies.length === 0 ? (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium">
            {search || activeFilter ? 'No movies match your filter' : 'Nothing watched yet'}
          </p>
          <p className="text-sm text-amber-500 mt-1">
            {search || activeFilter
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

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test:run -- tests/watched-client.test.tsx
```

Expected: all 4 tests PASS

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
npm run test:run
```

Expected: all tests pass (68+ tests passing, 0 failing)

- [ ] **Step 4: Commit**

```bash
git add src/components/watched-client.tsx tests/watched-client.test.tsx
git commit -m "feat: add per-user needs-review filter buttons to watched view"
```
