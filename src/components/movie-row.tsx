// src/components/movie-row.tsx
'use client'
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Image from 'next/image'
import { StatusBadge } from './status-badge'
import { Button } from '@/components/ui/button'
import type { Movie } from '@/types'

interface MovieRowProps {
  movie: Movie
  position: number
  onMarkWatched: (movie: Movie) => void
  onForceDownload: (movieId: number) => void
  onRemove: (movieId: number) => void
}

export function MovieRow({ movie, position, onMarkWatched, onForceDownload, onRemove }: MovieRowProps) {
  const [confirming, setConfirming] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: movie.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-amber-200 rounded-xl px-4 py-3 mb-2 shadow-sm"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-amber-400 hover:text-amber-600 cursor-grab active:cursor-grabbing text-xl leading-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>

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
              onClick={() => onRemove(movie.id)}
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
  )
}
