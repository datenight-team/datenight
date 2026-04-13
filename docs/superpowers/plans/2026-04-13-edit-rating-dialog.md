# EditRatingDialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline editing on watched movie cards with a popup `EditRatingDialog` that matches the style of the existing `RatingDialog`.

**Architecture:** A new `EditRatingDialog` component handles the edit-only flow (no 'who'/'waiting'/'reveal' steps). `MovieCard` drops its inline edit state and renders this dialog instead. A `key` prop on the dialog forces a fresh mount — and fresh pre-filled state — each time a different user's rating is opened for editing.

**Tech Stack:** Next.js 14 · TypeScript · shadcn/ui Dialog · Vitest + React Testing Library

---

## Files

| Action | Path | Purpose |
|---|---|---|
| **Create** | `src/components/edit-rating-dialog.tsx` | New single-step edit dialog |
| **Create** | `tests/edit-rating-dialog.test.tsx` | Component tests for EditRatingDialog |
| **Modify** | `src/components/movie-card.tsx` | Remove inline edit; add EditRatingDialog |
| **Modify** | `tests/movie-card.test.tsx` | Update Edit button tests |

---

## Task 1: Create `EditRatingDialog` component

**Files:**
- Create: `src/components/edit-rating-dialog.tsx`
- Create: `tests/edit-rating-dialog.test.tsx`

- [ ] **Step 1.1: Write the failing tests**

Create `tests/edit-rating-dialog.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditRatingDialog } from '@/components/edit-rating-dialog'
import type { Movie, User, Rating } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

function makeMovie(): Movie {
  return {
    id: 1,
    title: 'Seven Samurai',
    year: 1954,
    runtime: 207,
    description: '',
    posterUrl: '',
    imdbId: 'tt0047478',
    tmdbId: 345911,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: 1,
    status: 'watched',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'available',
    watchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ratings: [],
  }
}

function makeRatings(): Rating[] {
  return [
    { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'A masterwork', submittedAt: new Date().toISOString() },
    { id: 2, movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me', submittedAt: new Date().toISOString() },
  ]
}

describe('EditRatingDialog', () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    onClose.mockReset()
    onSaved.mockReset()
  })

  it('renders with pre-filled rating and quote', () => {
    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    expect(screen.getByText('Seven Samurai')).toBeInTheDocument()
    expect(screen.getByText("Alice's verdict")).toBeInTheDocument()
    expect(screen.getByDisplayValue('A masterwork')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thumbs up' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables Save Changes when quote is cleared', () => {
    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('calls PATCH /api/ratings and onSaved on successful save', async () => {
    const updatedRatings = makeRatings()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ratings: updatedRatings }) })

    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedRatings))
    expect(mockFetch).toHaveBeenCalledWith('/api/ratings', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: 'A masterwork' }),
    }))
  })

  it('shows error message on failed save', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })

    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(screen.getByText('Save failed — please try again.')).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npm run test:run -- tests/edit-rating-dialog.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/edit-rating-dialog'`

- [ ] **Step 1.3: Create `src/components/edit-rating-dialog.tsx`**

```tsx
// src/components/edit-rating-dialog.tsx
'use client'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ThumbRating } from './thumb-rating'
import type { Movie, User, Rating, RatingValue } from '@/types'

interface EditRatingDialogProps {
  movie: Movie
  user: User
  existingRating: RatingValue
  existingQuote: string
  open: boolean
  onClose: () => void
  onSaved: (updatedRatings: Rating[]) => void
  userNames: Record<User, string>
}

export function EditRatingDialog({
  movie,
  user,
  existingRating,
  existingQuote,
  open,
  onClose,
  onSaved,
  userNames,
}: EditRatingDialogProps) {
  const [rating, setRating] = useState<RatingValue>(existingRating)
  const [quote, setQuote] = useState(existingQuote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!rating || !quote.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ratings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId: movie.id, user, rating, quote: quote.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        onSaved(data.ratings)
      } else {
        setError('Save failed — please try again.')
      }
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-amber-900">{movie.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-stone-600">{userNames[user]}&apos;s verdict</p>
          <div>
            <p className="text-xs text-stone-500 mb-2">Verdict</p>
            <ThumbRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Critic&apos;s Quote</p>
            <Textarea
              placeholder="A sentence or two about the film..."
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="border-amber-300 focus:ring-amber-400 resize-none"
              rows={3}
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <Button
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSave}
            disabled={saving || !rating || !quote.trim()}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            className="w-full border-amber-300 text-amber-700"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npm run test:run -- tests/edit-rating-dialog.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add src/components/edit-rating-dialog.tsx tests/edit-rating-dialog.test.tsx
git commit -m "feat: add EditRatingDialog component"
```

---

## Task 2: Update `MovieCard` to use `EditRatingDialog`

**Files:**
- Modify: `src/components/movie-card.tsx`
- Modify: `tests/movie-card.test.tsx`

- [ ] **Step 2.1: Add Edit button tests to `tests/movie-card.test.tsx`**

Add these two tests inside the existing `describe('MovieCard cleanup button', ...)` block, after the last existing test:

```tsx
it('shows Edit button for a rated user', () => {
  const movie = makeMovie({
    ratings: [
      { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'Great film', submittedAt: new Date().toISOString() },
      { id: 2, movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me', submittedAt: new Date().toISOString() },
    ],
  })
  render(<MovieCard movie={movie} userNames={userNames} />)
  expect(screen.getAllByText('Edit')).toHaveLength(2)
})

it('opens edit dialog when Edit is clicked', async () => {
  const movie = makeMovie({
    ratings: [
      { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'Great film', submittedAt: new Date().toISOString() },
      { id: 2, movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me', submittedAt: new Date().toISOString() },
    ],
  })
  render(<MovieCard movie={movie} userNames={userNames} />)
  fireEvent.click(screen.getAllByText('Edit')[0])
  await waitFor(() => expect(screen.getByText("Alice's verdict")).toBeInTheDocument())
})
```

- [ ] **Step 2.2: Run the new tests to verify they fail**

```bash
npm run test:run -- tests/movie-card.test.tsx
```

Expected: the two new tests FAIL (Edit does not yet open a dialog)

- [ ] **Step 2.3: Rewrite `src/components/movie-card.tsx`**

Replace the full file content:

```tsx
// src/components/movie-card.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { ThumbRating } from './thumb-rating'
import { EditRatingDialog } from './edit-rating-dialog'
import type { Movie, Rating, User, RatingValue } from '@/types'

type CleanupState = 'idle' | 'loading' | 'done' | 'error'

interface MovieCardProps {
  movie: Movie
  userNames: Record<User, string>
}

export function MovieCard({ movie, userNames }: MovieCardProps) {
  const [cleanupState, setCleanupState] = useState<CleanupState>('idle')
  const [localRatings, setLocalRatings] = useState<Rating[]>(movie.ratings ?? [])
  const [editDialogUser, setEditDialogUser] = useState<User | null>(null)

  const bothRated = localRatings.length === 2
  const agreed =
    bothRated &&
    localRatings.find((r) => r.user === 'user1')?.rating ===
    localRatings.find((r) => r.user === 'user2')?.rating

  const editingRating = editDialogUser
    ? localRatings.find((r) => r.user === editDialogUser)
    : null

  const handleCleanup = async () => {
    if (cleanupState === 'loading') return
    setCleanupState('loading')
    try {
      const res = await fetch(`/api/movies/${movie.id}/seerr`, { method: 'DELETE' })
      const data = await res.json()
      setCleanupState(data.ok ? 'done' : 'error')
    } catch {
      setCleanupState('error')
    }
  }

  const renderRatingRow = (user: User) => {
    const r = localRatings.find((rated) => rated.user === user)
    const hasRated = !!r

    if (!hasRated) {
      return (
        <div key={user} className="bg-stone-50 rounded-lg p-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-400">{userNames[user]}</span>
          <span className="text-xs text-stone-300">—</span>
        </div>
      )
    }

    return (
      <div key={user} className="bg-amber-50 rounded-lg p-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-xs font-semibold text-amber-900">{userNames[user]}</span>
          <div className="flex items-center gap-1.5">
            {bothRated ? (
              <ThumbRating value={r.rating as RatingValue} readonly size="sm" />
            ) : (
              <span className="text-xs text-green-600">✓</span>
            )}
            <button
              onClick={() => setEditDialogUser(user)}
              className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
        {bothRated && (
          <p className="text-xs text-stone-500 italic line-clamp-2">&ldquo;{r.quote}&rdquo;</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] bg-amber-100">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-4xl">🎥</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-stone-900 text-sm leading-tight mb-0.5">
          {movie.title}
          {process.env.NEXT_PUBLIC_SEERR_URL && (
            <a
              href={`${process.env.NEXT_PUBLIC_SEERR_URL}/movie/${movie.tmdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-amber-500 hover:text-amber-700 transition-colors font-normal text-xs"
              title="View in Seerr"
            >
              ↗
            </a>
          )}
        </h3>
        <div className="flex items-center justify-between mb-3">
          <p className="text-stone-400 text-xs">{movie.year}</p>
          {bothRated && (
            <span className="text-xs text-stone-400" title={agreed ? 'You agreed' : 'You disagreed'}>
              {agreed ? '🤝' : '⚔️'}
            </span>
          )}
        </div>

        {localRatings.length === 0 ? (
          <p className="text-xs text-stone-400 italic text-center py-2">
            Waiting for both ratings…
          </p>
        ) : (
          <div className="space-y-2">
            {(['user1', 'user2'] as User[]).map((user) => renderRatingRow(user))}
          </div>
        )}

        {/* Cleanup button — only shown when movie has a Seerr entry */}
        {movie.seerrMediaId && (
          <div className="mt-2 pt-2 border-t border-amber-100 text-center">
            {cleanupState === 'idle' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-stone-400 hover:text-red-400 transition-colors"
              >
                🧹 Clean up from Plex
              </button>
            )}
            {cleanupState === 'loading' && (
              <p className="text-xs text-stone-400">Cleaning up…</p>
            )}
            {cleanupState === 'done' && (
              <p className="text-xs text-green-600">Cleaned up ✓</p>
            )}
            {cleanupState === 'error' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                Failed — try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit rating dialog — key forces fresh state when switching users */}
      {editingRating && editDialogUser && (
        <EditRatingDialog
          key={editDialogUser}
          movie={movie}
          user={editDialogUser}
          existingRating={editingRating.rating}
          existingQuote={editingRating.quote}
          open={true}
          onClose={() => setEditDialogUser(null)}
          onSaved={(updatedRatings) => {
            setLocalRatings(updatedRatings)
            setEditDialogUser(null)
          }}
          userNames={userNames}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2.4: Run all tests**

```bash
npm run test:run
```

Expected: all tests PASS (68 existing + 7 new = 75 total)

- [ ] **Step 2.5: Commit**

```bash
git add src/components/movie-card.tsx tests/movie-card.test.tsx
git commit -m "feat: replace inline rating edit with EditRatingDialog popup"
```
