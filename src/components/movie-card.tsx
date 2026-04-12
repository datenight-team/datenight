// src/components/movie-card.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { ThumbRating } from './thumb-rating'
import type { Movie, Rating, User, RatingValue } from '@/types'

type CleanupState = 'idle' | 'loading' | 'done' | 'error'

interface MovieCardProps {
  movie: Movie
  userNames: Record<User, string>
}

export function MovieCard({ movie, userNames }: MovieCardProps) {
  const [cleanupState, setCleanupState] = useState<CleanupState>('idle')
  const ratings = movie.ratings ?? []
  const bothRated = ratings.length === 2
  const agreed = bothRated && ratings[0].rating === ratings[1].rating

  const handleCleanup = async () => {
    if (cleanupState === 'loading') return
    setCleanupState('loading')
    try {
      const res = await fetch(`/api/movies/${movie.id}/seerr`, { method: 'DELETE' })
      const data = await res.json()
      setCleanupState(data.ok ? 'done' : 'error')
    } catch {
      setCleanupState('error')
    }
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] bg-amber-100">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-4xl">🎥</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-stone-900 text-sm leading-tight mb-0.5">{movie.title}</h3>
        <div className="flex items-center justify-between mb-3">
          <p className="text-stone-400 text-xs">{movie.year}</p>
          {bothRated && (
            <span className="text-xs text-stone-400" title={agreed ? 'You agreed' : 'You disagreed'}>
              {agreed ? '🤝' : '⚔️'}
            </span>
          )}
        </div>

        {bothRated ? (
          <div className="space-y-2">
            {ratings.map((r: Rating) => (
              <div key={r.user} className="bg-amber-50 rounded-lg p-2">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-semibold text-amber-900">{userNames[r.user as User]}</span>
                  <ThumbRating value={r.rating as RatingValue} readonly size="sm" />
                </div>
                <p className="text-xs text-stone-500 italic line-clamp-2">&ldquo;{r.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic text-center py-2">
            Waiting for both ratings…
          </p>
        )}

        {/* Cleanup button — only shown when movie has a Seerr entry */}
        {movie.seerrMediaId && (
          <div className="mt-2 pt-2 border-t border-amber-100 text-center">
            {cleanupState === 'idle' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-stone-400 hover:text-red-400 transition-colors"
              >
                🧹 Clean up from Plex
              </button>
            )}
            {cleanupState === 'loading' && (
              <p className="text-xs text-stone-400">Cleaning up…</p>
            )}
            {cleanupState === 'done' && (
              <p className="text-xs text-green-600">Cleaned up ✓</p>
            )}
            {cleanupState === 'error' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                Failed — try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
