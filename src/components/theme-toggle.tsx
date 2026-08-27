'use client'
import { useState } from 'react'
import { Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
  }

  return (
    <div className={cn('flex items-center justify-between gap-2 px-3 py-2 rounded-lg', className)}>
      <span className="flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
        <Moon className="w-3.5 h-3.5" aria-hidden="true" />
        Dark Mode
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Toggle dark mode"
        onClick={toggle}
        className={cn(
          'w-[34px] h-5 rounded-full transition-colors relative flex-shrink-0',
          dark ? 'bg-primary' : 'bg-border'
        )}
        suppressHydrationWarning
      >
        <span
          className={cn(
            'block w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
            dark && 'translate-x-3.5'
          )}
          suppressHydrationWarning
        />
      </button>
    </div>
  )
}
