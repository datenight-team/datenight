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
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors',
            pathname === '/settings' && 'bg-amber-100 font-semibold'
          )}
        >
          ⚙️ Settings
        </Link>
      </div>
    </aside>
  )
}
