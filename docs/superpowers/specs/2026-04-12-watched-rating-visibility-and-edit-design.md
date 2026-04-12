# Watched View: Rating Visibility & Inline Edit

**Date:** 2026-04-12
**Branch:** ian/seerr-status

## Problem

The watched view's `MovieCard` currently shows "Waiting for both ratings…" when only one person has rated. There is no way to tell who has already submitted, and neither person can change their rating after submitting.

## Goals

1. Show *who* has rated on each card, even before both ratings are in — but hide the actual thumb/quote until both are submitted.
2. Let a person who has already rated edit their thumb verdict and critic's quote directly on the card.

## Card States

| Ratings in | Display |
|---|---|
| 0 | "Waiting for both ratings…" — unchanged |
| 1 | Rated person: name + ✓ indicator + Edit link (no thumb or quote shown). Unrated person: name + "—". No agreement emoji. |
| 2 | Both: name + thumb + quote + Edit link. Agreement emoji (🤝 / ⚔️) shown as today. |

## Inline Edit UX

- Each person's row in the 2-rating state (and the rated person's row in the 1-rating state) has a small **Edit** text link.
- Clicking Edit replaces that person's display row with:
  - Thumb picker (pre-filled with current value)
  - Textarea (pre-filled with current quote)
  - **Save** and **Cancel** buttons
- Only one user can be in edit mode at a time. Opening edit for one user collapses any open edit for the other.
- On Save: call `PATCH /api/ratings`, update `localRatings` in component state (no page reload needed).
- On Cancel: discard changes, return to display.

## Components Changed

### `MovieCard` (`src/components/movie-card.tsx`)

New local state:
- `localRatings: Rating[]` — initialized from `movie.ratings`, updated after a successful save
- `editingUser: User | null` — which user's row is in edit mode
- `editRating: RatingValue | undefined` — thumb value in the edit form
- `editQuote: string` — quote text in the edit form

No props changes. `WatchedPage` and `WatchedClient` are untouched.

## New API Endpoint

**`PATCH /api/ratings`**

Request body: `{ movieId: number, user: string, rating: "up" | "down", quote: string }`

Behaviour:
- Validates `user` is a known user key, `rating` is `"up"` or `"down"`, `quote` is non-empty.
- Looks up the existing `Rating` row for `(movieId, user)`. Returns **404** if none exists — PATCH cannot create.
- Updates the row and returns `{ ratings }` (all ratings for the movie), status 200.

## Tests

New tests in `tests/ratings-patch.test.ts`:
- Happy path: existing rating is updated, returns 200 + updated ratings array.
- 404 when no prior rating exists for that user+movie.
- 422 for invalid user, invalid rating value, missing quote.

## Out of Scope

- Adding a "Rate Now" button for the unrated person on the watched card (separate feature).
- Any changes to `RatingDialog`, `WatchedPage`, or `WatchedClient`.
- Hiding/revealing ratings differently from the current two-rating reveal behaviour.
