'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/watchlist', label: 'List',     icon: '📋' },
  { href: '/watched',   label: 'Watched',  icon: '✅' },
  { href: '/add',       label: 'Add',      icon: '➕' },
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
            aria-hidden="true"
            className={cn(
              'text-xl mb-0.5 px-3 py-0.5 rounded-full',
              pathname === href ? 'bg-amber-600' : ''
            )}
          >
            {icon}
          </span>
          <span className={cn(pathname === href ? 'font-bold' : 'font-medium')}>
            {label}
          </span>
        </Link>
      ))}
    </nav>
  )
}
