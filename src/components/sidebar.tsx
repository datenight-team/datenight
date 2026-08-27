// src/components/sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { List, CheckCircle2, PlusCircle, Heart, Target, Settings, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlexSyncButton, StreamingRefreshButton, AskClaudeLink } from './sidebar-utils'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/watchlist', label: 'Watch List', icon: List },
  { href: '/watched', label: 'Watched', icon: CheckCircle2 },
  { href: '/add', label: 'Add Movie', icon: PlusCircle },
  { href: '/match-night', label: 'Match Night', icon: Heart },
  { href: '/recommendations', label: 'Recommend', icon: Target },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 bg-card border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
          <Clapperboard className="w-4 h-4" aria-hidden="true" />
        </div>
        <span className="font-display font-bold text-foreground text-sm">Date Night</span>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Utility links */}
      <div className="px-3 py-3 border-t border-border flex flex-col gap-0.5">
        <PlexSyncButton />
        <StreamingRefreshButton />
        <AskClaudeLink />
        <div className="h-px bg-border my-1.5 mx-1" />
        <ThemeToggle />
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors',
            pathname === '/settings' && 'bg-accent font-semibold text-foreground'
          )}
        >
          <Settings className="w-3.5 h-3.5" aria-hidden="true" /> Settings
        </Link>
      </div>
    </aside>
  )
}
