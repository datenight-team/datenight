'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PlexSyncButton, AskClaudeLink, StreamingRefreshButton } from './sidebar-utils'

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
              <span aria-hidden="true">🎞️</span>
              <span>Browse Criterion</span>
            </a>
            <a
              href="https://www.imdb.com/search/title/?title_type=feature"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <span aria-hidden="true">🎬</span>
              <span>Browse IMDB</span>
            </a>
            <PlexSyncButton />
            <StreamingRefreshButton />
            <AskClaudeLink />
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">⚙️</span>
              <span>Settings</span>
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
