// src/components/edit-rating-dialog.tsx
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
import type { Movie, User, Rating, RatingValue } from '@/types'

interface EditRatingDialogProps {
  movie: Movie
  user: User
  existingRating: RatingValue
  existingQuote: string
  open: boolean
  onClose: () => void
  onSaved: (updatedRatings: Rating[]) => void
  userNames: Record<User, string>
}

export function EditRatingDialog({
  movie,
  user,
  existingRating,
  existingQuote,
  open,
  onClose,
  onSaved,
  userNames,
}: EditRatingDialogProps) {
  const [rating, setRating] = useState<RatingValue>(existingRating)
  const [quote, setQuote] = useState(existingQuote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!rating || !quote.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ratings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId: movie.id, user, rating, quote: quote.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        onSaved(data.ratings)
      } else {
        setError('Save failed — please try again.')
      }
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-amber-900">{movie.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-stone-600">{userNames[user]}&apos;s verdict</p>
          <div>
            <p className="text-xs text-stone-500 mb-2">Verdict</p>
            <ThumbRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Critic&apos;s Quote</p>
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
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSave}
            disabled={saving || !rating || !quote.trim()}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            className="w-full border-amber-300 text-amber-700"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
