'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Film, Clapperboard, Settings } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PlexSyncButton, AskClaudeLink, StreamingRefreshButton } from './sidebar-utils'
import { ThemeToggle } from './theme-toggle'

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="md:hidden bg-header text-white flex items-center justify-between px-4 py-3 flex-shrink-0 z-40">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
          <Clapperboard className="w-4 h-4" aria-hidden="true" />
        </div>
        <span className="font-display font-bold text-sm">Date Night</span>
      </div>

      <button
        onClick={() => setOpen(true)}
        aria-label="More options"
        className="text-white p-1 hover:opacity-75 transition-opacity"
      >
        <MoreHorizontal className="w-6 h-6" aria-hidden="true" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left text-foreground text-sm font-bold uppercase tracking-wide">
              More
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 mt-2">
            <a
              href="https://www.criterion.com/shop/browse/list?q=&format=all"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
            >
              <Film className="w-4 h-4" aria-hidden="true" />
              <span>Browse Criterion</span>
            </a>
            <a
              href="https://www.imdb.com/search/title/?title_type=feature"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
            >
              <Clapperboard className="w-4 h-4" aria-hidden="true" />
              <span>Browse IMDB</span>
            </a>
            <PlexSyncButton />
            <StreamingRefreshButton />
            <AskClaudeLink />
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
              onClick={() => setOpen(false)}
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              <span>Settings</span>
            </Link>
            <div className="h-px bg-border my-1.5 mx-1" />
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
