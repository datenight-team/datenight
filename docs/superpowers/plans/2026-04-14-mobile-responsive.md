# Mobile Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Date Night usable on iPhone by hiding the desktop sidebar and adding a bottom tab bar + "More" sheet on screens narrower than 768px.

**Architecture:** Single `md` breakpoint separates mobile from desktop. Two new components (`MobileHeader`, `MobileBottomNav`) are added to `layout.tsx` with `md:hidden`; the existing `Sidebar` gains `hidden md:flex` at its call site. Utility link logic (`PlexSyncButton`, `AskClaudeLink`) is extracted to a shared module so both the sidebar and the mobile "More" sheet can import them without duplication.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui (Sheet — needs install), Vitest + @testing-library/react

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/sidebar-utils.tsx` | Shared `PlexSyncButton` and `AskClaudeLink` — extracted from sidebar |
| Create | `src/components/mobile-bottom-nav.tsx` | 4-tab bottom nav, `md:hidden`, active state via `usePathname` |
| Create | `src/components/mobile-header.tsx` | Slim amber header bar + "More" Sheet trigger, `md:hidden` |
| Create | `src/components/ui/sheet.tsx` | shadcn Sheet component (installed via CLI) |
| Modify | `src/components/sidebar.tsx` | Import `PlexSyncButton`/`AskClaudeLink` from `sidebar-utils` instead of defining inline |
| Modify | `src/app/layout.tsx` | Add `MobileHeader`, `MobileBottomNav`; add `hidden md:flex` to Sidebar; add `pb-20 md:pb-0` to `<main>` |
| Create | `tests/sidebar-utils.test.tsx` | PlexSyncButton idle render test |
| Create | `tests/mobile-bottom-nav.test.tsx` | Renders 4 tabs; active tab highlighted |
| Create | `tests/mobile-header.test.tsx` | Renders app name; More button opens sheet |

---

### Task 1: Extract shared utility components

`PlexSyncButton` and `AskClaudeLink` are currently private functions inside `sidebar.tsx`. Extract them so `MobileHeader` can import them without duplication.

**Files:**
- Create: `src/components/sidebar-utils.tsx`
- Modify: `src/components/sidebar.tsx`
- Test: `tests/sidebar-utils.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/sidebar-utils.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// AskClaudeLink fetches /api/watched-titles on mount
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

import { PlexSyncButton } from '@/components/sidebar-utils'

describe('PlexSyncButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders in idle state', () => {
    render(<PlexSyncButton />)
    expect(screen.getByText('🎭 Sync Plex')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- tests/sidebar-utils.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/sidebar-utils'`

- [ ] **Step 3: Create `src/components/sidebar-utils.tsx`**

```typescript
// src/components/sidebar-utils.tsx
'use client'
import { useState, useEffect } from 'react'

export function PlexSyncButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/plex-sync', { method: 'POST' })
      setState(res.ok ? 'ok' : 'error')
    } catch {
      setState('error')
    } finally {
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label =
    state === 'loading' ? '⏳ Syncing…'
    : state === 'ok'    ? '✅ Synced!'
    : state === 'error' ? '❌ Failed'
    :                     '🎭 Sync Plex'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  )
}

export function AskClaudeLink() {
  const [href, setHref] = useState('https://claude.ai/')

  useEffect(() => {
    fetch('/api/watched-titles')
      .then((r) => r.json())
      .then((titles: Array<{ title: string; year: number }>) => {
        if (titles.length === 0) return
        const list = titles.map((t) => `- ${t.title} (${t.year})`).join('\n')
        const prompt = `We love Criterion Collection films. Here are the last ${titles.length} films we watched:\n${list}\n\nBased on these, can you recommend other Criterion Collection films we might enjoy?`
        setHref(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`)
      })
      .catch(() => {})
  }, [])

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
    >
      ✨ Ask Claude
    </a>
  )
}
```

- [ ] **Step 4: Update `src/components/sidebar.tsx` to import from sidebar-utils**

Replace the two private function definitions at the bottom with imports. The file after editing:

```typescript
// src/components/sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PlexSyncButton, AskClaudeLink } from './sidebar-utils'

const navItems = [
  { href: '/watchlist', label: 'Watch List', icon: '📋' },
  { href: '/watched', label: 'Watched', icon: '✅' },
  { href: '/add', label: 'Add Movie', icon: '➕' },
  { href: '/recommendations', label: 'Recommend', icon: '🎯' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-48 flex-shrink-0 bg-amber-50 border-r border-amber-200 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-amber-200">
        <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white text-sm">
          🎬
        </div>
        <span className="font-extrabold text-amber-900 text-sm">Date Night</span>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-1">
        {navItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-amber-600 text-white'
                : 'text-amber-800 hover:bg-amber-100'
            )}
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Utility links */}
      <div className="px-2 py-4 border-t border-amber-200 flex flex-col gap-1">
        <a
          href="https://www.criterion.com/shop/browse/list?q=&format=all"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
        >
          🎞️ Browse Criterion
        </a>
        <a
          href="https://www.imdb.com/search/title/?title_type=feature"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
        >
          🎬 Browse IMDB
        </a>
        <PlexSyncButton />
        <AskClaudeLink />
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- tests/sidebar-utils.test.tsx
```

Expected: PASS — 1 test passing

- [ ] **Step 6: Run full suite to check no regressions**

```bash
npm run test:run
```

Expected: All 68 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/sidebar-utils.tsx src/components/sidebar.tsx tests/sidebar-utils.test.tsx
git commit -m "refactor: extract PlexSyncButton and AskClaudeLink to sidebar-utils"
```

---

### Task 2: Install shadcn Sheet component

`MobileHeader` will use `Sheet` (a bottom-drawer panel) from shadcn/ui. The component doesn't exist yet and must be added via the shadcn CLI.

**Files:**
- Create: `src/components/ui/sheet.tsx` (generated by CLI)

- [ ] **Step 1: Install the Sheet component**

```bash
npx shadcn@latest add sheet
```

Expected output: `✔ Done` — creates `src/components/ui/sheet.tsx`

- [ ] **Step 2: Verify the file was created**

```bash
ls src/components/ui/sheet.tsx
```

Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/sheet.tsx
git commit -m "chore: add shadcn Sheet component"
```

---

### Task 3: Create MobileBottomNav

A 4-tab nav bar fixed to the bottom of the viewport on mobile screens only.

**Files:**
- Create: `src/components/mobile-bottom-nav.tsx`
- Test: `tests/mobile-bottom-nav.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/mobile-bottom-nav.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/watchlist',
}))

import { MobileBottomNav } from '@/components/mobile-bottom-nav'

describe('MobileBottomNav', () => {
  it('renders all four navigation tabs', () => {
    render(<MobileBottomNav />)
    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Watched')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Recs')).toBeInTheDocument()
  })

  it('links to the correct routes', () => {
    render(<MobileBottomNav />)
    expect(screen.getByRole('link', { name: /list/i })).toHaveAttribute('href', '/watchlist')
    expect(screen.getByRole('link', { name: /watched/i })).toHaveAttribute('href', '/watched')
    expect(screen.getByRole('link', { name: /add/i })).toHaveAttribute('href', '/add')
    expect(screen.getByRole('link', { name: /recs/i })).toHaveAttribute('href', '/recommendations')
  })

  it('highlights the active tab', () => {
    render(<MobileBottomNav />)
    // usePathname returns '/watchlist' — the List link should have the active colour
    const listLink = screen.getByRole('link', { name: /list/i })
    expect(listLink).toHaveClass('text-amber-600')
    // Inactive tabs should not have the active colour
    const watchedLink = screen.getByRole('link', { name: /watched/i })
    expect(watchedLink).not.toHaveClass('text-amber-600')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/mobile-bottom-nav.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/mobile-bottom-nav'`

- [ ] **Step 3: Create `src/components/mobile-bottom-nav.tsx`**

```typescript
// src/components/mobile-bottom-nav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/watchlist', label: 'List',    icon: '📋' },
  { href: '/watched',   label: 'Watched', icon: '✅' },
  { href: '/add',       label: 'Add',     icon: '➕' },
  { href: '/recommendations', label: 'Recs', icon: '🎯' },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 flex justify-around z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}
    >
      {tabs.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-col items-center pt-2 pb-1 px-3 text-xs font-medium transition-colors min-w-0',
            pathname === href ? 'text-amber-600' : 'text-amber-800'
          )}
        >
          <span
            className={cn(
              'text-xl mb-0.5 px-3 py-0.5 rounded-full',
              pathname === href && 'bg-amber-100'
            )}
          >
            {icon}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/mobile-bottom-nav.test.tsx
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Run full suite to check no regressions**

```bash
npm run test:run
```

Expected: All 69 tests pass (68 existing + 1 from Task 1 + 3 new = 72 total)

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile-bottom-nav.tsx tests/mobile-bottom-nav.test.tsx
git commit -m "feat: add MobileBottomNav component"
```

---

### Task 4: Create MobileHeader

A slim amber header bar visible only on mobile. Contains the app logo/name and a ⋯ button that opens a Sheet with the 4 utility links.

**Files:**
- Create: `src/components/mobile-header.tsx`
- Test: `tests/mobile-header.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/mobile-header.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/watchlist',
}))

// PlexSyncButton fetches; AskClaudeLink fetches — stub both
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

import { MobileHeader } from '@/components/mobile-header'

describe('MobileHeader', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the app name', () => {
    render(<MobileHeader />)
    expect(screen.getByText('Date Night')).toBeInTheDocument()
  })

  it('opens the More sheet when the button is clicked', async () => {
    render(<MobileHeader />)
    fireEvent.click(screen.getByRole('button', { name: /more options/i }))
    await waitFor(() => {
      expect(screen.getByText('Browse Criterion')).toBeInTheDocument()
      expect(screen.getByText('Browse IMDB')).toBeInTheDocument()
      expect(screen.getByText('🎭 Sync Plex')).toBeInTheDocument()
      expect(screen.getByText('✨ Ask Claude')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/mobile-header.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/mobile-header'`

- [ ] **Step 3: Create `src/components/mobile-header.tsx`**

```typescript
// src/components/mobile-header.tsx
'use client'
import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PlexSyncButton, AskClaudeLink } from './sidebar-utils'

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="md:hidden bg-amber-800 text-white flex items-center justify-between px-4 py-3 flex-shrink-0 z-40">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-amber-600 rounded-lg flex items-center justify-center text-sm">
          🎬
        </div>
        <span className="font-extrabold text-sm">Date Night</span>
      </div>

      <button
        onClick={() => setOpen(true)}
        aria-label="More options"
        className="text-white text-2xl leading-none px-1 hover:opacity-75 transition-opacity"
      >
        ⋯
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left text-amber-900 text-sm font-bold uppercase tracking-wide">
              More
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 mt-2">
            <a
              href="https://www.criterion.com/shop/browse/list?q=&format=all"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
            >
              🎞️ Browse Criterion
            </a>
            <a
              href="https://www.imdb.com/search/title/?title_type=feature"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
            >
              🎬 Browse IMDB
            </a>
            <PlexSyncButton />
            <AskClaudeLink />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- tests/mobile-header.test.tsx
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Run full suite to check no regressions**

```bash
npm run test:run
```

Expected: All existing tests pass plus the 5 new component tests

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile-header.tsx tests/mobile-header.test.tsx
git commit -m "feat: add MobileHeader component with More sheet"
```

---

### Task 5: Wire the responsive layout in layout.tsx

Add the two new mobile components to the root layout, hide the sidebar on mobile, and give the main scroll area bottom padding so content isn't obscured by the bottom nav.

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update `src/app/layout.tsx`**

Replace the entire file with:

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { MobileHeader } from '@/components/mobile-header'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Date Night',
  description: 'Our Criterion Collection watchlist',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col h-screen`}>
        <MobileHeader />
        <div className="flex flex-1 overflow-hidden bg-amber-50">
          <div className="hidden md:flex">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </body>
    </html>
  )
}
```

`body` is now `flex flex-col h-screen`. `MobileHeader` is `md:hidden` so on desktop it's `display:none` (zero height) and the `flex-1` container fills the full screen exactly as before. On mobile, `MobileHeader` takes its natural height and `flex-1` fills the remainder. `MobileBottomNav` is `position: fixed` so it floats above content; `pb-20 md:pb-0` on `<main>` ensures the last list item is never hidden beneath it.

- [ ] **Step 2: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass

- [ ] **Step 3: Start the dev server and verify in browser at a narrow viewport**

```bash
npm run dev
```

Open `http://localhost:3000` in DevTools with iPhone SE (375×667) emulation:
- Amber header bar visible at top with "Date Night" and ⋯ button
- Sidebar NOT visible
- Bottom tab bar visible at bottom
- Tapping ⋯ opens the More sheet with Criterion/IMDB/Plex/Claude links
- Tapping all 4 tabs navigates to correct pages
- Active tab is highlighted in amber

At 768px+ width (desktop):
- Mobile header NOT visible
- Sidebar visible on left
- Bottom tab bar NOT visible

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire mobile-responsive layout — bottom nav + header on small screens"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run the full test suite one final time**

```bash
npm run test:run
```

Expected: All tests pass, no failures

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
npm run build
```

Expected: Build completes with no errors
