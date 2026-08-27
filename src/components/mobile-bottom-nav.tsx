'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { List, CheckCircle2, PlusCircle, Heart, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/watchlist', label: 'List',     icon: List },
  { href: '/watched',   label: 'Watched',  icon: CheckCircle2 },
  { href: '/add',       label: 'Add',      icon: PlusCircle },
  { href: '/match-night', label: 'Match',  icon: Heart },
  { href: '/recommendations', label: 'Recs', icon: Target },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center pt-2 pb-1 px-3 text-xs font-medium transition-colors min-w-0',
              active ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex items-center justify-center w-8 h-[22px] rounded-full mb-0.5',
                active ? 'bg-primary text-primary-foreground' : ''
              )}
            >
              <Icon className="w-4 h-4" />
            </span>
            <span className={cn(active ? 'font-bold' : 'font-medium')}>
              {label}
            </span>
            <span
              aria-hidden="true"
              // invisible keeps the dot in layout flow; prevents tab labels from shifting when active tab changes
              className={cn(
                'h-1 w-5 rounded-full mt-0.5 transition-colors',
                active ? 'bg-primary' : 'invisible'
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
