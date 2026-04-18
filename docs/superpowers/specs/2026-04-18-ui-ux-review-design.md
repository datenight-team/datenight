# UI/UX Review — Design Spec

**Date:** 2026-04-18  
**Source:** External UI/UX expert review of the Date Night app  
**Approach:** Two PRs — PR 1 (High/Medium priority usability fixes), PR 2 (Low priority polish + accessibility)  
**Fix 7 (max-w-2xl centering) dropped** — home-lab app on a known display; centering creates an amber island; low value.

---

## PR 1 — Usability Fixes

### Fix 1: MovieRow Actions Column Overload
**File:** `src/components/movie-row.tsx`

Move status pills, streaming badge, provider logos, and Watch link out of the right-hand actions column and into the movie info section (below title/year). The actions column becomes a single horizontally-arranged row of buttons (Mark Watched / Download Now) plus the ✕ remove button inline at the end. `items-start` → `items-center` on the row container since heights are now uniform.

### Fix 2: Rating Dialog Quote Required
**File:** `src/components/rating-dialog.tsx`

- Add `<span aria-hidden="true" style="color:red">*</span>` after the "Critic's Quote" label.
- Disable the Submit button (`disabled` prop) until both `rating !== undefined` and `quote.trim().length > 0`. Use a computed `canSubmit` boolean.

### Fix 3: Streamable Filter Integrated into FilterBar
**Files:** `src/components/filter-bar.tsx`, `src/app/watchlist/page.tsx`

Add an optional `extraPills` prop to `FilterBar`:
```tsx
interface ExtraPill {
  label: string
  active: boolean
  onToggle: () => void
}
interface FilterBarProps {
  // ...existing props...
  extraPills?: ExtraPill[]
}
```
Render `extraPills` inline after the status pill buttons in the same `flex-wrap` row. In `watchlist/page.tsx`, remove the standalone streamable toggle `<div>` and pass it as an `extraPill` instead. The `Play` icon import can be kept on the pill label string or passed through the label.

### Fix 4: Navigation Inconsistency — Settings Demoted on Mobile
**Files:** `src/components/mobile-bottom-nav.tsx`, `src/components/mobile-header.tsx`

- Remove Settings from the `tabs` array in `mobile-bottom-nav.tsx` (4 primary tabs remain: List, Watched, Add, Recs).
- Add a Settings link to the existing bottom sheet in `mobile-header.tsx` (the `⋯` more menu already contains Browse Criterion, Browse IMDB, Plex Sync, Ask Claude — add Settings after Ask Claude). No header layout changes needed.

### Fix 5: Status Pill Color Hierarchy
**File:** `src/components/movie-row.tsx`

Replace the binary `seerrPillClass` with a full map:

```ts
const SEERR_PILL_CLASS: Record<string, string> = {
  not_requested: 'bg-stone-100 text-stone-500 border-stone-200',
  pending:       'bg-indigo-50 text-indigo-600 border-indigo-200',
  processing:    'bg-amber-50 text-amber-600 border-amber-200',
  available:     'bg-green-50 text-green-700 border-green-200',
  deleted:       'bg-stone-100 text-stone-500 border-stone-200',
}
```

---

## PR 2 — Polish & Accessibility

### Fix 6: Watch ↗ Button Palette
**File:** `src/components/movie-row.tsx`

Change the Watch link from `bg-stone-800 text-white border-stone-600` to `bg-white text-amber-700 border-amber-400 hover:bg-amber-50`. Keeps it clearly a link/action while fitting the warm palette.

### Fix 8: Sidebar Utility Section Trimmed
**Files:** `src/components/sidebar.tsx`, `src/app/add/page.tsx`

- Remove the Browse Criterion and Browse IMDB `<a>` links from the sidebar utility footer. Sidebar footer becomes: Plex Sync, Streaming Refresh, Ask Claude, Settings — 4 items.
- Add Browse Criterion and Browse IMDB as helper links in `src/app/add/page.tsx`, below the URL input hint text (`Supports imdb.com/title/... and criterion.com/films/... URLs`). Render them as small amber text links.
- Note: Browse links are already present in the mobile header's `⋯` more sheet (`mobile-header.tsx`) — leave those as-is. This fix only affects the desktop sidebar and Add page.

### Fix 9: Mobile Bottom Nav Active State
**File:** `src/components/mobile-bottom-nav.tsx`

Strengthen the active indicator:
- Icon pill: `bg-amber-600` (filled) instead of `bg-amber-100` (pale)
- Label text: `font-bold text-amber-600` instead of `font-medium text-amber-600`

```tsx
<span className={cn(
  'text-xl mb-0.5 px-3 py-0.5 rounded-full',
  pathname === href ? 'bg-amber-600' : ''
)}>
  {icon}
</span>
<span className={cn(
  pathname === href ? 'font-bold text-amber-600' : 'font-medium text-amber-800'
)}>
  {label}
</span>
```

### Fix 10: Emoji Icons aria-hidden
**Files:** `src/components/sidebar.tsx`, `src/components/mobile-bottom-nav.tsx`

Wrap every decorative emoji in `<span aria-hidden="true">`. The text label that follows provides the accessible name. Apply to the `navItems` map in sidebar, the logo emoji in the sidebar header, and the `tabs` map in mobile-bottom-nav.

```tsx
// Before
<span>{icon}</span>
{label}

// After
<span aria-hidden="true">{icon}</span>
{label}
```

Note: `mobile-header.tsx` already uses `aria-hidden="true"` on its emojis — no changes needed there.

---

## Files Touched

| File | Fixes |
|---|---|
| `src/components/movie-row.tsx` | 1, 5, 6 |
| `src/components/rating-dialog.tsx` | 2 |
| `src/components/filter-bar.tsx` | 3 |
| `src/app/watchlist/page.tsx` | 3 |
| `src/components/mobile-bottom-nav.tsx` | 4, 9, 10 |
| `src/components/sidebar.tsx` | 8, 10 |
| `src/app/add/page.tsx` | 8 |
| `src/components/mobile-header.tsx` | 4 |

---

## Out of Scope

- Fix 7 (max-w-2xl centering): dropped — home-lab app on known display, centering creates floating-island effect with amber on both sides; low value.
- No new routes, no data model changes, no API changes.
- All changes are purely presentational / accessibility.
