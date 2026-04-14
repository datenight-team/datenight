// src/components/movie-card.tsx
'use client'
import { useState } from 'react'
import { ThumbRating } from './thumb-rating'
import { MoviePoster } from './movie-poster'
import { EditRatingDialog } from './edit-rating-dialog'
import type { Movie, Rating, User, RatingValue } from '@/types'

type CleanupState = 'idle' | 'loading' | 'done' | 'error'

interface MovieCardProps {
  movie: Movie
  userNames: Record<User, string>
  seerrUrl?: string | null
}

export function MovieCard({ movie, userNames, seerrUrl }: MovieCardProps) {
  const [cleanupState, setCleanupState] = useState<CleanupState>('idle')
  const [localRatings, setLocalRatings] = useState<Rating[]>(movie.ratings ?? [])
  const [editDialogUser, setEditDialogUser] = useState<User | null>(null)

  const bothRated = localRatings.length === 2
  const agreed =
    bothRated &&
    localRatings.find((r) => r.user === 'user1')?.rating ===
    localRatings.find((r) => r.user === 'user2')?.rating

  const editingRating = editDialogUser
    ? localRatings.find((r) => r.user === editDialogUser)
    : null

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

  const renderRatingRow = (user: User) => {
    const r = localRatings.find((rated) => rated.user === user)
    const hasRated = !!r

    if (!hasRated) {
      return (
        <div key={user} className="bg-stone-50 rounded-lg p-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-400">{userNames[user]}</span>
          <span className="text-xs text-stone-300">—</span>
        </div>
      )
    }

    return (
      <div key={user} className="bg-amber-50 rounded-lg p-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-xs font-semibold text-amber-900">{userNames[user]}</span>
          <div className="flex items-center gap-1.5">
            {bothRated ? (
              <ThumbRating value={r.rating as RatingValue} readonly size="sm" />
            ) : (
              <span className="text-xs text-green-600">✓</span>
            )}
            <button
              onClick={() => setEditDialogUser(user)}
              className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
        {bothRated && (
          <p className="text-xs text-stone-500 italic line-clamp-2">&ldquo;{r.quote}&rdquo;</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
      {/* Poster */}
      <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="lg" />

      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-stone-900 text-sm leading-tight mb-0.5">
          {movie.title}
          {seerrUrl && (
            <a
              href={`${seerrUrl}/movie/${movie.tmdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-amber-500 hover:text-amber-700 transition-colors font-normal text-xs"
              title="View in Seerr"
            >
              ↗
            </a>
          )}
        </h3>
        <div className="flex items-center justify-between mb-3">
          <p className="text-stone-400 text-xs">{movie.year}</p>
          {bothRated && (
            <span className="text-xs text-stone-400" title={agreed ? 'You agreed' : 'You disagreed'}>
              {agreed ? '🤝' : '⚔️'}
            </span>
          )}
        </div>

        {localRatings.length === 0 ? (
          <p className="text-xs text-stone-400 italic text-center py-2">
            Waiting for both ratings…
          </p>
        ) : (
          <div className="space-y-2">
            {(['user1', 'user2'] as User[]).map((user) => renderRatingRow(user))}
          </div>
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

      {/* Edit rating dialog — key forces fresh state when switching users */}
      {editingRating && editDialogUser && (
        <EditRatingDialog
          key={editDialogUser}
          movie={movie}
          user={editDialogUser}
          existingRating={editingRating.rating}
          existingQuote={editingRating.quote}
          open={true}
          onClose={() => setEditDialogUser(null)}
          onSaved={(updatedRatings) => {
            setLocalRatings(updatedRatings)
            setEditDialogUser(null)
          }}
          userNames={userNames}
        />
      )}
    </div>
  )
}
