'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MoviePoster } from './movie-poster'
import { ThumbRating } from './thumb-rating'
import type { Movie, Rating, User, RatingValue } from '@/types'

interface MovieReviewModalProps {
  movie: Movie
  ratings: Rating[]
  userNames: Record<User, string>
  open: boolean
  onClose: () => void
  onEditUser: (user: User) => void
}

export function MovieReviewModal({
  movie,
  ratings,
  userNames,
  open,
  onClose,
  onEditUser,
}: MovieReviewModalProps) {
  const r1 = ratings.find((r) => r.user === 'user1')
  const r2 = ratings.find((r) => r.user === 'user2')
  const bothRated = !!r1 && !!r2
  const agreed = bothRated && r1.rating === r2.rating

  const renderReviewPanel = (user: User, rating: Rating | undefined) => {
    if (!rating) {
      return (
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
          <p className="text-xs font-bold text-stone-400 mb-2">{userNames[user]}</p>
          <p className="text-sm text-stone-400 italic">No review yet</p>
        </div>
      )
    }
    return (
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-amber-900">{userNames[user]}</span>
          <ThumbRating value={rating.rating as RatingValue} readonly size="sm" />
        </div>
        <p className="text-sm text-stone-600 italic leading-relaxed">
          &ldquo;{rating.quote}&rdquo;
        </p>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex gap-4 items-start">
            <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="md" />
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-stone-900 leading-tight mb-1">
                {movie.title}
              </DialogTitle>
              <p className="text-sm text-stone-400 mb-2">{movie.year}</p>
              {bothRated && (
                <span className="inline-flex items-center gap-1.5 bg-stone-100 rounded-full px-2.5 py-1 text-xs font-medium text-stone-600">
                  {agreed ? '🤝 You agreed' : '⚔️ You disagreed'}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {ratings.length === 0 ? (
          <p className="text-sm text-stone-400 italic text-center py-6">No reviews yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-2">
            {renderReviewPanel('user1', r1)}
            {renderReviewPanel('user2', r2)}
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onEditUser('user1')}
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors"
            >
              Edit {userNames.user1}&apos;s review
            </button>
            <button
              type="button"
              onClick={() => onEditUser('user2')}
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors"
            >
              Edit {userNames.user2}&apos;s review
            </button>
          </div>
          <Button data-testid="modal-close-btn" size="sm" onClick={onClose} className="bg-amber-500 hover:bg-amber-600 text-white">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
