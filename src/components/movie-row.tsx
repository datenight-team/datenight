// src/components/movie-row.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { StatusBadge } from './status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Movie } from '@/types'

interface MovieRowProps {
  movie: Movie
  position: number
  onMarkWatched: (movie: Movie) => void
  onForceDownload: (movieId: number) => void
  onRemove: (movieId: number, opts: { seerr: boolean }) => void
}

export function MovieRow({ movie, position, onMarkWatched, onForceDownload, onRemove }: MovieRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [askSeerr, setAskSeerr] = useState(false)

  const handleConfirmRemove = () => {
    setConfirming(false)
    if (movie.seerrMediaId) {
      setAskSeerr(true)
    } else {
      onRemove(movie.id, { seerr: false })
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 bg-white border border-amber-200 rounded-xl px-4 py-3 mb-2 shadow-sm">
        {/* Position */}
        <span className="text-amber-700 font-bold text-sm w-5 text-center flex-shrink-0">
          {position}
        </span>

        {/* Poster */}
        <div className="w-9 h-14 bg-amber-100 rounded flex-shrink-0 overflow-hidden">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              width={36}
              height={56}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-400 text-xs">🎥</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-900 text-sm truncate">{movie.title}</div>
          <div className="text-stone-400 text-xs">
            {movie.year} · {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={movie.seerrStatus} />
          {movie.seerrStatus === 'available' && (
            <Button
              size="sm"
              className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => onMarkWatched(movie)}
            >
              Mark Watched
            </Button>
          )}
          {(movie.seerrStatus === 'not_requested' || movie.seerrStatus === 'pending') && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => onForceDownload(movie.id)}
            >
              Download Now
            </Button>
          )}
          {/* Remove — two-tap confirm so it's hard to trigger accidentally */}
          {confirming ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleConfirmRemove}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-stone-200 text-stone-400 hover:bg-stone-50"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-stone-300 hover:text-red-400 text-xs transition-colors"
              aria-label="Remove from list"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Seerr cleanup dialog — only shown when movie has a Seerr entry */}
      <Dialog open={askSeerr} onOpenChange={(o) => !o && setAskSeerr(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-amber-900">Remove from Plex too?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-stone-600">
              <em>{movie.title}</em> is in your Plex library. Remove it from Plex and Radarr as well?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => { setAskSeerr(false); onRemove(movie.id, { seerr: true }) }}
              >
                Yes, remove from Plex
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-stone-200 text-stone-600 hover:bg-stone-50"
                onClick={() => { setAskSeerr(false); onRemove(movie.id, { seerr: false }) }}
              >
                No, just the list
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
