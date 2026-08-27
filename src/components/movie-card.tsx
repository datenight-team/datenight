// src/components/movie-card.tsx
'use client'
import { useState } from 'react'
import { ExternalLink, Handshake, Swords, PartyPopper, Sparkles } from 'lucide-react'
import { ThumbRating } from './thumb-rating'
import { MoviePoster } from './movie-poster'
import { EditRatingDialog } from './edit-rating-dialog'
import { MovieReviewModal } from './movie-review-modal'
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
  const [reviewModalOpen, setReviewModalOpen] = useState(false)

  const bothRated = localRatings.length === 2
  const agreed =
    bothRated &&
    localRatings.find((r) => r.user === 'user1')?.rating ===
    localRatings.find((r) => r.user === 'user2')?.rating

  const editingRating = editDialogUser
    ? localRatings.find((r) => r.user === editDialogUser)
    : null

  const handleCleanup = async (e: React.MouseEvent) => {
    e.stopPropagation()
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
        <div key={user} className="bg-muted rounded-lg p-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">{userNames[user]}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setEditDialogUser(user) }}
            className="text-xs text-primary hover:opacity-75 transition-opacity"
          >
            Add Review
          </button>
        </div>
      )
    }

    return (
      <div key={user} className="bg-background rounded-lg p-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-xs font-semibold text-foreground">{userNames[user]}</span>
          <div className="flex items-center gap-1.5">
            {bothRated ? (
              <ThumbRating value={r.rating as RatingValue} readonly size="sm" />
            ) : (
              <span className="text-xs text-success">✓</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setEditDialogUser(user) }}
              className="text-xs text-primary hover:opacity-75 transition-opacity"
            >
              Edit
            </button>
          </div>
        </div>
        {bothRated && (
          <p className="text-xs text-muted-foreground italic line-clamp-2">&ldquo;{r.quote}&rdquo;</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Clickable poster + header area */}
      <button
        className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setReviewModalOpen(true)}
        aria-label={`View reviews for ${movie.title}`}
      >
        <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="lg" />

        <div className="px-3 pt-3 pb-1">
          <h3 className="font-bold text-foreground text-sm leading-tight mb-0.5 flex items-center gap-1">
            {movie.title}
            {seerrUrl && (
              <a
                href={`${seerrUrl}/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-primary hover:opacity-75 transition-opacity"
                title="View in Seerr"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">{movie.year}</p>
            {bothRated && (
              <span className="text-muted-foreground" title={agreed ? 'You agreed' : 'You disagreed'}>
                {agreed
                  ? <Handshake className="w-3.5 h-3.5" aria-hidden="true" />
                  : <Swords className="w-3.5 h-3.5" aria-hidden="true" />}
              </span>
            )}
          </div>
          {movie.matchedViaSwipe && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold bg-rose-bg text-rose border-transparent">
              <PartyPopper className="w-3 h-3" aria-hidden="true" />
              It&apos;s a match!
            </span>
          )}
        </div>
      </button>

      {/* Rating rows (non-clickable area for the modal trigger) */}
      <div className="px-3 pb-3">
        <div className="mt-2">
          {localRatings.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              Waiting for both ratings…
            </p>
          ) : (
            <div className="space-y-2">
              {(['user1', 'user2'] as User[]).map((user) => renderRatingRow(user))}
            </div>
          )}
        </div>

        {/* Cleanup button — only shown when movie has a Seerr entry */}
        {movie.seerrMediaId && (
          <div className="mt-2 pt-2 border-t border-border text-center">
            {cleanupState === 'idle' && (
              <button
                onClick={handleCleanup}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Clean up from Plex
              </button>
            )}
            {cleanupState === 'loading' && (
              <p className="text-xs text-muted-foreground">Cleaning up…</p>
            )}
            {cleanupState === 'done' && (
              <p className="text-xs text-success">Cleaned up ✓</p>
            )}
            {cleanupState === 'error' && (
              <button
                onClick={handleCleanup}
                className="text-xs text-destructive hover:opacity-75 transition-opacity"
              >
                Failed — try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Review modal */}
      <MovieReviewModal
        movie={movie}
        ratings={localRatings}
        userNames={userNames}
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onEditUser={(user) => {
          setReviewModalOpen(false)
          setEditDialogUser(user)
        }}
      />

      {/* Edit/add rating dialog — key forces fresh state when switching users */}
      {editDialogUser && (
        <EditRatingDialog
          key={editDialogUser}
          movie={movie}
          user={editDialogUser}
          existingRating={editingRating?.rating as RatingValue | undefined}
          existingQuote={editingRating?.quote}
          open={true}
          onClose={() => setEditDialogUser(null)}
          onSaved={(updatedRatings) => {
            setLocalRatings(updatedRatings)
            setEditDialogUser(null)
          }}
          onDeleted={() => {
            setLocalRatings((prev) => prev.filter((r) => r.user !== editDialogUser))
            setEditDialogUser(null)
          }}
          userNames={userNames}
        />
      )}
    </div>
  )
}
