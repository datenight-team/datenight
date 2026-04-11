# Watchlist & Watched Filter Design

**Date:** 2026-04-11
**Status:** Approved

## Overview

Add client-side filtering to the watchlist and watched views so the user can quickly narrow long lists by title text and by a category button (download status on the watchlist; agreement outcome on the watched view).

## Approach

All filtering is in-memory on the client — no new API routes, no server round-trips. With ~100 movies the data is already loaded, so this is instant and keeps the code simple.

## Components

### New: `src/components/filter-bar.tsx`

A fully controlled, reusable component. Props:

- `search: string` — current text input value
- `onSearchChange: (value: string) => void`
- `buttons: { label: string; value: string }[]` — ordered list of pill buttons to render
- `activeButton: string | null` — which button is active (null = "All")
- `onButtonChange: (value: string | null) => void`

Renders a text input (placeholder "Search titles…") followed by a row of pill buttons. The first button is always "All" and clears the active filter. All state lives in the parent; `FilterBar` is purely presentational.

## Watchlist Changes (`src/app/watchlist/page.tsx`)

Add state:
- `search: string` (default `''`)
- `activeStatus: string | null` (default `null`)

Derive `filteredMovies` from `movies` before the render:
1. Title filter: case-insensitive substring match on `movie.title`
2. Status filter: exact match on `movie.seerrStatus` (skipped when `activeStatus` is null)

Pass `filteredMovies` to `SortableContext` and the `MovieRow` map. Drag-and-drop reorder operations continue to use the full `movies` array (IDs are stable regardless of filter state).

Status button options (matching existing `StatusBadge` labels):
- All (null)
- Not Requested (`not_requested`)
- Queued (`pending`)
- Downloading (`processing`)
- Ready (`available`)

## Watched Page Changes

### `src/app/watched/page.tsx` (server component — minimal change)

Keep the existing Prisma fetch unchanged. Replace the inline grid JSX with a `<WatchedClient movies={movies} userNames={userNames} />` call.

### New: `src/components/watched-client.tsx` (client component)

Owns:
- `search: string` (default `''`)
- `activeAgreement: 'agreed' | 'disagreed' | null` (default `null`)

Derives `filteredMovies` from props:
1. Title filter: case-insensitive substring match
2. Agreement filter: `bothRated && ratings[0].rating === ratings[1].rating` (same logic already used in `MovieCard`)

Renders `FilterBar` followed by the movie grid. Preserves the existing empty-state message for when no movies match.

Agreement button options:
- All (null)
- 🤝 Agreed (`agreed`)
- ⚔️ Disagreed (`disagreed`)

## Data Flow

```
Watchlist page (client)
  movies[] ──► filteredMovies[] ──► MovieRow × N
  FilterBar controls: search, activeStatus

Watched page (server) ──► WatchedClient (client)
  movies[] ──► filteredMovies[] ──► MovieCard × N
  FilterBar controls: search, activeAgreement
```

## What Is Not Changing

- No new API routes
- No changes to drag-and-drop reorder logic
- No changes to `MovieRow`, `MovieCard`, or `StatusBadge`
- No URL param persistence (filter resets on navigation — fine for this use case)
