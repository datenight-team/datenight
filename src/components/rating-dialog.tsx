// src/components/rating-dialog.tsx
'use client'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ThumbRating } from './thumb-rating'
import { otherUser, USER_KEYS } from '@/lib/user-utils'
import { cn } from '@/lib/utils'
import type { Movie, User, Rating, RatingValue } from '@/types'

type Step = 'who' | 'form' | 'waiting' | 'reveal'

interface RatingDialogProps {
  movie: Movie
  open: boolean
  onClose: () => void
  onComplete: () => void
  userNames: Record<User, string>
}

export function RatingDialog({ movie, open, onClose, onComplete, userNames }: RatingDialogProps) {
  const [step, setStep] = useState<Step>('who')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [rating, setRating] = useState<RatingValue | undefined>(undefined)
  const [quote, setQuote] = useState('')
  const [ratings, setRatings] = useState<Rating[]>([])
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = rating !== undefined && quote.trim().length > 0
  const [error, setError] = useState<string | null>(null)

  const handleUserSelect = async (user: User) => {
    if (step === 'who') {
      await fetch(`/api/movies/${movie.id}/watched`, { method: 'POST' })
    }
    setCurrentUser(user)
    setRating(undefined)
    setQuote('')
    setStep('form')
  }

  const handleSubmit = async () => {
    if (!currentUser || !rating || !quote.trim()) {
      setError('Please give a verdict and write your critic\'s quote.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId: movie.id, user: currentUser, rating, quote }),
      })
      const data = await res.json()
      setRatings(data.ratings)
      setRating(undefined)
      setQuote('')

      if (data.complete) {
        setStep('reveal')
        onComplete()
      } else {
        setCurrentUser(otherUser(currentUser))
        setStep('waiting')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const other = currentUser ? otherUser(currentUser) : null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-amber-900">{movie.title}</DialogTitle>
        </DialogHeader>

        {step === 'who' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-stone-600">Who&apos;s rating this one?</p>
            {USER_KEYS.map((user) => (
              <Button
                key={user}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => handleUserSelect(user)}
              >
                {userNames[user]}
              </Button>
            ))}
          </div>
        )}

        {step === 'form' && currentUser && (
          <div className={cn('space-y-4 py-2', submitting && 'pointer-events-none opacity-50')}>
            <p className="text-sm text-stone-600">
              {userNames[currentUser]}&apos;s verdict on <em>{movie.title}</em>
            </p>
            <div>
              <p className="text-xs text-stone-500 mb-2">Verdict</p>
              <ThumbRating value={rating} onChange={setRating} size="lg" />
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">
                Critic&apos;s Quote <span aria-hidden="true" className="text-red-500">*</span>
              </p>
              <Textarea
                placeholder="A sentence or two about the film..."
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                className="border-amber-300 focus:ring-amber-400 resize-none"
                rows={3}
              />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        )}

        {step === 'waiting' && other && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-3xl">⏳</p>
            <p className="text-sm text-stone-600">
              Waiting for <strong>{userNames[other]}</strong> to weigh in…
            </p>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => handleUserSelect(other)}
            >
              I&apos;m {userNames[other]} — Rate Now
            </Button>
          </div>
        )}

        {step === 'reveal' && (
          <div className="space-y-4 py-2">
            <p className="text-center text-2xl">
              {ratings.length === 2 && ratings[0].rating === ratings[1].rating ? '🤝' : '⚔️'}
            </p>
            <p className="text-sm text-center text-stone-600 font-medium">
              {ratings.length === 2 && ratings[0].rating === ratings[1].rating
                ? 'You agree!'
                : 'You disagree!'}
            </p>
            {ratings.map((r) => (
              <div key={r.user} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-amber-900 text-sm">{userNames[r.user as User]}</span>
                  <ThumbRating value={r.rating} readonly size="sm" />
                </div>
                <p className="text-stone-600 text-xs italic">&ldquo;{r.quote}&rdquo;</p>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full border-amber-300 text-amber-700"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
