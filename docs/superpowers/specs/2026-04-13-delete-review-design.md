# Delete Review Feature Design

**Date:** 2026-04-13  
**Branch:** ian/delete-reviews  
**Status:** Approved

## Overview

Add a "Delete Review" button to the `EditRatingDialog` component in the watched view. The button only appears when editing an existing review (not when adding a new one). Deletion requires inline confirmation before proceeding.

## API

**New handler:** `DELETE /api/ratings` in `src/app/api/ratings/route.ts`

- **Request body:** `{ movieId: number, user: User }`
- **Action:** Deletes the matching `Rating` record via Prisma (`deleteMany` with `movieId_user` composite key)
- **Response:** `{ ratings: Rating[] }` — the remaining ratings for that movie (200)
- **Error:** 404 if the rating does not exist

No new route file is needed — the handler is added to the existing `route.ts`.

## Components

### `EditRatingDialog` (`src/components/edit-rating-dialog.tsx`)

**New prop:**
- `onDeleted?: () => void` — called after a successful delete; only wired up when `existingRating` is set

**New state:**
- `confirmDelete: boolean` — whether the inline confirmation is visible (default `false`)
- `deleting: boolean` — whether the delete request is in flight (default `false`)

**Behaviour:**
- When `existingRating` is set, a "Delete Review" button appears below the Cancel button
- Clicking "Delete Review" sets `confirmDelete = true`; the button is replaced by:
  - Text: "Are you sure?"
  - "Yes, delete" button — calls `DELETE /api/ratings`, then calls `onDeleted()`
  - "Cancel" button — resets `confirmDelete = false`
- While `deleting` is true, both confirmation buttons are disabled
- On error, `deleting` resets to `false` and the existing `error` state is used to display a message

### `MovieCard` (`src/components/movie-card.tsx`)

**New `onDeleted` callback passed to `EditRatingDialog`:**
- Filters the deleted user's rating out of `localRatings`
- Sets `editDialogUser` to `null` to close the dialog

## Data Flow

```
User clicks "Delete Review"
  → confirmDelete = true (inline confirmation shown)
User clicks "Yes, delete"
  → DELETE /api/ratings { movieId, user }
  → API deletes rating, returns remaining ratings
  → onDeleted() called in MovieCard
  → MovieCard: remove rating from localRatings, close dialog
```

## Error Handling

- Network/server errors during delete set `error` state and reset `deleting` to `false`; the confirmation UI remains visible so the user can retry or cancel
- The delete button is disabled while `saving` (save in flight) to prevent concurrent operations

## Testing

- Existing rating tests remain unchanged (POST/PATCH)
- New: DELETE handler unit test — valid delete returns 200 with updated ratings; missing rating returns 404
