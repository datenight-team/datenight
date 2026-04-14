# Watched View: Expandable Review Modal

**Date:** 2026-04-13
**Status:** Approved

## Problem

The watched view displays movie cards in a grid. Each card shows both users' written reviews, but they are truncated with `line-clamp-2` due to space constraints. There is no way to read a full review from the watched view.

## Solution

Clicking a movie card opens a modal dialog showing both users' full, untruncated reviews side by side.

## Interaction Design

### Trigger

Clicking the poster or the title/year header area of a `MovieCard` opens the review modal. Existing interactive elements — Edit buttons, Add Review links, and the Clean up from Plex button — call `e.stopPropagation()` so they do not accidentally open the modal.

### Modal Layout

**Header**
- Movie poster (medium size)
- Title, year
- Agree/disagree badge (🤝 You agreed / ⚔️ You disagreed) when both users have rated

**Body**
- Two review panels, side by side (CSS grid, 2 columns)
- Each panel shows:
  - User name (bold)
  - Thumbs rating emoji (👍 or 👎)
  - Full quote, untruncated, italic
- If a user has not rated yet, their panel shows a placeholder: "No review yet"
- If neither user has rated, the body shows a single centered message: "No reviews yet"

**Footer**
- "Edit [User1]'s review" text link
- "Edit [User2]'s review" text link
- Close button (amber, primary)

### Edit Flow

Clicking an edit link in the modal footer:
1. Closes the modal (`reviewModalOpen = false`)
2. Opens the existing `EditRatingDialog` for that user (`editDialogUser = user`)

This reuses the existing edit flow without modification. After saving or deleting, `localRatings` updates as it does today.

## Implementation

### New component: `MovieReviewModal`

A new `src/components/movie-review-modal.tsx` component:

```
interface MovieReviewModalProps {
  movie: Movie
  ratings: Rating[]
  userNames: Record<User, string>
  open: boolean
  onClose: () => void
  onEditUser: (user: User) => void
}
```

Uses `shadcn/ui Dialog` — the same pattern as `EditRatingDialog`. Read-only display only; no API calls.

### Changes to `MovieCard`

- Add `reviewModalOpen: boolean` state (default `false`)
- Wrap the poster + title/year block in a `<button>` (or add `onClick` + `cursor-pointer`) that sets `reviewModalOpen = true`
- All existing interactive child elements get `e.stopPropagation()` on their click handlers
- Render `<MovieReviewModal>` at the bottom of the card, passing `localRatings` so it reflects any edits made mid-session
- Pass `onEditUser` handler that closes the modal and opens `EditRatingDialog`

### Card display unchanged

The existing `line-clamp-2` truncation on card quotes stays. The modal is the full-read surface; the card is the at-a-glance surface.

## Files Affected

| File | Change |
|------|--------|
| `src/components/movie-review-modal.tsx` | New component |
| `src/components/movie-card.tsx` | Add modal state, click trigger, `stopPropagation` on buttons, render modal |

## Out of Scope

- No changes to the watchlist view
- No changes to the rating or edit flows themselves
- No new API endpoints
