# Mobile Responsive Design

**Date:** 2026-04-14  
**Status:** Approved  
**Branch:** ian/mobile-view

## Problem

The app is unusable on small screens (iPhone). The sidebar is always rendered at `w-48` (192px), leaving very little space for content. There is no mobile navigation, no responsive breakpoints on the layout shell, and no safe-area padding for the iPhone home bar.

## Approach

Approach B: Responsive layout with mobile Sheet drawer.

- Below `md` (768px): sidebar hidden, replaced by a slim amber header + 4-tab bottom nav. Utility links surface in a shadcn Sheet that slides up from the bottom.
- At `md` and above: existing desktop layout completely unchanged — sidebar stays, no bottom nav shown.

## Architecture

### Breakpoint strategy

Single breakpoint: `md` (768px). Below it is "mobile", at or above it is "desktop". This covers iPhones (< 430px wide) and small Android phones while keeping the desktop sidebar for tablets in landscape and larger.

### New components

**`src/components/mobile-header.tsx`**  
Slim top bar rendered only on mobile (`md:hidden`). Contains:
- Left: 🎬 icon + "Date Night" wordmark (matches sidebar header style)
- Right: ⋯ button that opens the More Sheet

Uses `useState` to track sheet open state and renders a shadcn `Sheet` (bottom variant) containing the utility links.

Sheet contents (in order):
1. 🎞️ Browse Criterion — external link (same href as sidebar)
2. 🎬 Browse IMDB — external link (same href as sidebar)
3. 🎭 Sync Plex — button with idle/loading/ok/error states (logic shared or duplicated from `PlexSyncButton` in sidebar)
4. ✨ Ask Claude — dynamic link built from watched titles (logic shared or duplicated from `AskClaudeLink` in sidebar)

**`src/components/mobile-bottom-nav.tsx`**  
4-tab nav bar rendered only on mobile (`md:hidden`). Fixed to the bottom of the viewport. Tabs:

| Tab | Icon | Route |
|-----|------|-------|
| List | 📋 | `/watchlist` |
| Watched | ✅ | `/watched` |
| Add | ➕ | `/add` |
| Recs | 🎯 | `/recommendations` |

Active tab uses `bg-amber-600 text-white` pill highlight (matches sidebar active state). Uses `usePathname()` for active detection. Includes bottom padding to clear the iPhone home indicator bar. Use `pb-6` as a universal safe default, or add `style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}` for precise safe-area inset support.

### Modified files

**`src/app/layout.tsx`**  
- Add `<MobileHeader />` above the existing `flex` shell — only visible on mobile via `md:hidden` on the component itself
- Add `hidden md:flex` to the `<aside>` wrapper (or directly on `<Sidebar />`) so the sidebar disappears on mobile
- Add `<MobileBottomNav />` after the main scroll area — only visible on mobile
- Add `pb-20 md:pb-0` to the `<main>` scroll container so content isn't obscured by the bottom nav on mobile

**`src/components/sidebar.tsx`**  
No logic changes. The `md:hidden` / `hidden md:flex` class is applied at the call site in `layout.tsx`, not inside the component itself, so sidebar remains reusable.

### Shared utility logic

`PlexSyncButton` and `AskClaudeLink` are currently private functions inside `sidebar.tsx`. They need to be accessible from `mobile-header.tsx` as well. Two options:

1. **Extract to `src/components/sidebar-utils.tsx`** and import from both — cleanest, avoids duplication.
2. **Duplicate** the two small functions into `mobile-header.tsx` — acceptable since they're ~20 lines each and the Sheet is the only other consumer.

Prefer option 1 (extract) to avoid drift between the two copies.

## Content area padding

The bottom nav is approximately `64px` tall (tabs + safe area). The main scroll container in `layout.tsx` needs `pb-20 md:pb-0` (80px) to ensure the last list item is fully visible above the tab bar on mobile. Individual page components (`p-6`) do not need changes.

## What is not changing

- Desktop layout: zero changes visible at `md` and above
- All page components (`watchlist/page.tsx`, `watched/page.tsx`, etc.): no changes
- The `FilterBar` component: already uses `flex-wrap`, adapts naturally to narrow screens
- The `MovieRow` component: horizontal flex layout adapts to narrow screens without changes
- The `watched-client.tsx` grid: already has `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` — works correctly on mobile

## Testing

- Verify at iPhone SE width (375px): bottom nav visible, header visible, sidebar hidden, all 4 tabs navigate correctly
- Verify ⋯ opens Sheet with all 4 utility links functional
- Verify at iPad landscape (1024px): sidebar visible, no bottom nav, no mobile header
- Verify no layout regression on desktop (> 768px)
- Existing 68 tests should continue to pass unchanged
