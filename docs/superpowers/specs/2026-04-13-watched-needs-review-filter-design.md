# Watched View: "Needs Review" Per-User Filter

**Date:** 2026-04-13
**Status:** Approved

## Problem

The `/watched` view lets partners filter by agreement state (🤝 Agreed / ⚔️ Disagreed), but both filters require two ratings to be meaningful. There is no way for a partner to quickly find movies they personally haven't rated yet.

## Goal

Add two per-user filter buttons to the watched view so each partner can surface movies they still need to review.

## Design

### Data model

No changes. The existing `Rating` table already provides everything needed:

- Each row is unique on `[movieId, user]`
- `user` is `'user1'` or `'user2'`
- A missing row means that user hasn't rated the movie

A movie **needs user1's review** if `m.ratings` contains no entry where `user === 'user1'`.  
A movie **needs user2's review** if `m.ratings` contains no entry where `user === 'user2'`.

### Components changed

#### `src/components/watched-client.tsx` (only file changed)

1. **Button array becomes dynamic.** `AGREEMENT_BUTTONS` moves from a static top-level constant to a helper built inside the component from `userNames`:

   ```ts
   const buttons = [
     { label: '🤝 Agreed',                  value: 'agreed' },
     { label: '⚔️ Disagreed',               value: 'disagreed' },
     { label: `📋 Needs ${userNames.user1}`, value: 'needs_user1' },
     { label: `📋 Needs ${userNames.user2}`, value: 'needs_user2' },
   ]
   ```

2. **Filter type expands.**

   ```ts
   type ActiveFilter = 'agreed' | 'disagreed' | 'needs_user1' | 'needs_user2'
   ```

   State and `FilterBar` wiring are unchanged — `activeFilter` (renamed from `activeAgreement`) remains a single `ActiveFilter | null`.

3. **Filter logic adds two branches.**

   ```ts
   if (activeFilter === 'needs_user1') {
     return !ratings.some((r) => r.user === 'user1')
   }
   if (activeFilter === 'needs_user2') {
     return !ratings.some((r) => r.user === 'user2')
   }
   ```

   The existing `agreed` / `disagreed` branches are unchanged.

#### `src/components/filter-bar.tsx` — no changes

#### `src/app/watched/page.tsx` — no changes

### UX behaviour

- All four toggle buttons sit in the same pill row as today.
- Selecting a "needs review" button is exclusive with all other filters (same single-active-button behaviour as today).
- The empty-state message already handles any active filter generically ("No movies match your filter").
- Button labels use the configured display names (`USER1_NAME` / `USER2_NAME` env vars), falling back to "User 1" / "User 2".

## Out of scope

- Backend/API changes
- New components
- Changes to the rating submission flow
