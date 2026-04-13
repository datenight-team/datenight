# Edit Rating Dialog Design

**Date:** 2026-04-13
**Status:** Approved

## Summary

Replace the inline editing experience on watched movie cards with a popup dialog that matches the style of the existing `RatingDialog`. Clicking "Edit" on a rating row opens a pre-filled dialog for that user.

## Problem

The current inline editing in `MovieCard` expands a rating row in place — thumb selector, textarea, Save/Cancel buttons — all squeezed into the card's narrow column layout. It's cramped and awkward compared to the original rating entry experience.

## Approach

Create a new `EditRatingDialog` component (`src/components/edit-rating-dialog.tsx`). It is a focused, single-step dialog — no 'who' selection, no 'waiting', no 'reveal'. It opens pre-filled with the user's existing rating and quote, lets them edit, and saves via `PATCH /api/ratings`.

## Component Design

### `EditRatingDialog` props

```ts
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
```

### Dialog content

- **Header:** Movie title (amber-900), subtitle "{UserName}'s verdict"
- **Verdict section:** `ThumbRating` (size "lg"), pre-selected with `existingRating`
- **Critic's Quote section:** `Textarea`, pre-filled with `existingQuote`, 3 rows, amber border
- **Error message:** shown in red if save fails
- **Save Changes button:** disabled until rating selected and quote non-empty; shows "Saving…" while in flight
- **Cancel button:** outline style, closes dialog and discards changes

### Save behaviour

`PATCH /api/ratings` with `{ movieId, user, rating, quote }`. On success, calls `onSaved(data.ratings)` and closes. On failure, shows inline error "Save failed — please try again."

## Changes to `MovieCard`

- Remove all inline edit state: `editingUser`, `editRating`, `editQuote`, `saving`, `saveError`
- Remove the inline edit form branch from `renderRatingRow`
- Add state: `editDialogUser: User | null` (which user's dialog is open)
- "Edit" button sets `editDialogUser` to that user
- Render `<EditRatingDialog>` once (outside `renderRatingRow`), driven by `editDialogUser`
- `onSaved` updates `localRatings` and clears `editDialogUser`
- `onClose` clears `editDialogUser`

## Visual Style

Matches `RatingDialog` exactly: `max-w-sm` dialog, amber-900 title, `space-y-4 py-2` body, amber-600 primary button, outline cancel button.

## Files Changed

| File | Change |
|---|---|
| `src/components/edit-rating-dialog.tsx` | New component |
| `src/components/movie-card.tsx` | Remove inline edit; add EditRatingDialog |

## Out of Scope

- No changes to `RatingDialog` (first-time rating flow unchanged)
- No changes to the API
- No changes to the watched page or filter bar
