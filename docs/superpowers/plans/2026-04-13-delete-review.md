# Delete Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Delete Review" button to the edit dialog in the watched view, with inline confirmation before deleting.

**Architecture:** Add a `DELETE` handler to the existing ratings API route, add delete state + inline confirmation UI to `EditRatingDialog`, and wire up a callback in `MovieCard` to remove the rating from local state after deletion.

**Tech Stack:** Next.js 14, TypeScript, Prisma + SQLite, Vitest, Tailwind CSS, shadcn/ui

---

## File Map

| File | Change |
|---|---|
| `src/app/api/ratings/route.ts` | Add `DELETE` handler |
| `src/components/edit-rating-dialog.tsx` | Add `onDeleted` prop, `confirmDelete`/`deleting` state, inline confirmation UI |
| `src/components/movie-card.tsx` | Pass `onDeleted` callback to `EditRatingDialog` |
| `tests/api.ratings.test.ts` | New test file for ratings API (DELETE + regression for POST/PATCH) |

---

### Task 1: Add DELETE handler to ratings API

**Files:**
- Modify: `src/app/api/ratings/route.ts`

- [ ] **Step 1: Add the DELETE handler**

Add this export at the end of `src/app/api/ratings/route.ts`:

```typescript
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { movieId, user } = body as { movieId?: number; user?: User }

  if (!movieId || !USER_KEYS.includes(user as User)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 422 })
  }

  const deleted = await prisma.rating.deleteMany({
    where: { movieId, user: user as User },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'rating not found' }, { status: 404 })
  }

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  return NextResponse.json({ ratings }, { status: 200 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ratings/route.ts
git commit -m "feat: add DELETE handler to ratings API"
```

---

### Task 2: Test the DELETE handler

**Files:**
- Create: `tests/api.ratings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api.ratings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    rating: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { POST, PATCH, DELETE } from '@/app/api/ratings/route'

const mockRatings = [
  { id: 1, movieId: 42, user: 'user1', rating: 'up', quote: 'Great film' },
]

describe('DELETE /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 422 when movieId is missing', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'DELETE',
      body: JSON.stringify({ user: 'user1' }),
    })
    expect((await DELETE(req)).status).toBe(422)
  })

  it('returns 422 when user is invalid', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'DELETE',
      body: JSON.stringify({ movieId: 42, user: 'baduser' }),
    })
    expect((await DELETE(req)).status).toBe(422)
  })

  it('returns 404 when rating does not exist', async () => {
    vi.mocked(prisma.rating.deleteMany).mockResolvedValue({ count: 0 })
    const req = new Request('http://localhost/api/ratings', {
      method: 'DELETE',
      body: JSON.stringify({ movieId: 42, user: 'user1' }),
    })
    expect((await DELETE(req)).status).toBe(404)
  })

  it('deletes rating and returns remaining ratings', async () => {
    vi.mocked(prisma.rating.deleteMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.rating.findMany).mockResolvedValue([])
    const req = new Request('http://localhost/api/ratings', {
      method: 'DELETE',
      body: JSON.stringify({ movieId: 42, user: 'user1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ratings).toEqual([])
    expect(prisma.rating.deleteMany).toHaveBeenCalledWith({
      where: { movieId: 42, user: 'user1' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/api.ratings.test.ts
```

Expected: FAIL — `DELETE` is not exported from the route yet (or if Task 1 is done first, the mock structure mismatch will surface).

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm run test:run -- tests/api.ratings.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
npm run test:run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add tests/api.ratings.test.ts
git commit -m "test: add DELETE /api/ratings tests"
```

---

### Task 3: Add delete UI to EditRatingDialog

**Files:**
- Modify: `src/components/edit-rating-dialog.tsx`

- [ ] **Step 1: Add the new prop and state**

Update the interface and function signature in `src/components/edit-rating-dialog.tsx`:

```typescript
interface EditRatingDialogProps {
  movie: Movie
  user: User
  existingRating?: RatingValue
  existingQuote?: string
  open: boolean
  onClose: () => void
  onSaved: (updatedRatings: Rating[]) => void
  onDeleted?: () => void   // ← add this
  userNames: Record<User, string>
}

export function EditRatingDialog({
  movie,
  user,
  existingRating,
  existingQuote = '',
  open,
  onClose,
  onSaved,
  onDeleted,              // ← add this
  userNames,
}: EditRatingDialogProps) {
  const [rating, setRating] = useState<RatingValue | undefined>(existingRating)
  const [quote, setQuote] = useState(existingQuote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)  // ← add
  const [deleting, setDeleting] = useState(false)            // ← add
```

- [ ] **Step 2: Add the handleDelete function**

Add this function inside `EditRatingDialog`, after `handleSave`:

```typescript
const handleDelete = async () => {
  setDeleting(true)
  setError(null)
  try {
    const res = await fetch('/api/ratings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId: movie.id, user }),
    })
    if (res.ok) {
      onDeleted?.()
    } else {
      setError('Delete failed — please try again.')
    }
  } catch {
    setError('Delete failed — please try again.')
  } finally {
    setDeleting(false)
  }
}
```

- [ ] **Step 3: Add inline confirmation UI**

In the JSX, after the Cancel button (around line 96), add the delete section. The full button area should look like:

```tsx
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <Button
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSave}
            disabled={saving || !rating || !quote.trim()}
          >
            {saving ? 'Saving…' : existingRating ? 'Save Changes' : 'Submit'}
          </Button>
          <Button
            variant="outline"
            className="w-full border-amber-300 text-amber-700"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          {existingRating && !confirmDelete && (
            <Button
              variant="ghost"
              className="w-full text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              Delete Review
            </Button>
          )}
          {existingRating && confirmDelete && (
            <div className="space-y-2 pt-1 border-t border-red-100">
              <p className="text-xs text-center text-stone-500">Are you sure?</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs border-stone-200 text-stone-500"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </Button>
              </div>
            </div>
          )}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/edit-rating-dialog.tsx
git commit -m "feat: add delete review button with inline confirmation to EditRatingDialog"
```

---

### Task 4: Wire up onDeleted callback in MovieCard

**Files:**
- Modify: `src/components/movie-card.tsx`

- [ ] **Step 1: Pass onDeleted to EditRatingDialog**

In `src/components/movie-card.tsx`, find the `EditRatingDialog` usage (around line 157) and add the `onDeleted` prop:

```tsx
      {editDialogUser && (
        <EditRatingDialog
          key={editDialogUser}
          movie={movie}
          user={editDialogUser}
          existingRating={editingRating?.rating as RatingValue | undefined}
          existingQuote={editingRating?.quote}
          open={true}
          onClose={() => setEditDialogUser(null)}
          onSaved={(updatedRatings) => {
            setLocalRatings(updatedRatings)
            setEditDialogUser(null)
          }}
          onDeleted={() => {
            setLocalRatings((prev) => prev.filter((r) => r.user !== editDialogUser))
            setEditDialogUser(null)
          }}
          userNames={userNames}
        />
      )}
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass, no TypeScript errors

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/movie-card.tsx
git commit -m "feat: wire up onDeleted callback in MovieCard"
```

---

## Self-Review

**Spec coverage:**
- DELETE API handler ✓ (Task 1)
- DELETE API tests ✓ (Task 2)
- `onDeleted` prop on `EditRatingDialog` ✓ (Task 3)
- `confirmDelete` / `deleting` state ✓ (Task 3)
- Inline confirmation UI ✓ (Task 3)
- Delete button only shows when `existingRating` is set ✓ (Task 3 — guarded by `existingRating &&`)
- `deleting` disables both confirmation buttons ✓ (Task 3)
- Error displayed via existing `error` state ✓ (Task 3)
- `MovieCard` filters out deleted rating from `localRatings` ✓ (Task 4)
- `MovieCard` closes dialog after delete ✓ (Task 4)

**Placeholder scan:** None found.

**Type consistency:** `onDeleted?: () => void` defined in Task 3 interface and used as a callback in Task 4. `editDialogUser` is `User | null`; inside the `onDeleted` callback it is guaranteed non-null (we're inside `editDialogUser && ...`). Types are consistent throughout.
