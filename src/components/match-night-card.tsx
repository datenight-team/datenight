'use client'
import { MoviePoster } from './movie-poster'
import { Button } from '@/components/ui/button'
import type { SwipeCandidateRecord, SwipeVote } from '@/types'

interface MatchNightCardProps {
  candidate: SwipeCandidateRecord
  voting: boolean
  onVote: (vote: SwipeVote) => void
}

export function MatchNightCard({ candidate, voting, onVote }: MatchNightCardProps) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm max-w-xs mx-auto">
      <MoviePoster posterUrl={candidate.posterUrl} title={candidate.title} size="lg" />
      <div className="p-4">
        <h2 className="font-bold text-stone-900 text-lg leading-tight">{candidate.title}</h2>
        <p className="text-stone-400 text-sm mb-2">{candidate.year}</p>
        <p className="text-stone-600 text-sm line-clamp-4">{candidate.description}</p>
      </div>
      <div className="flex gap-3 justify-center pb-4">
        <Button
          size="lg"
          variant="outline"
          className="text-2xl px-6 border-stone-200 disabled:opacity-40"
          disabled={voting}
          onClick={() => onVote('down')}
          aria-label="Thumbs down"
        >
          👎
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="text-2xl px-6 border-amber-300 disabled:opacity-40"
          disabled={voting}
          onClick={() => onVote('up')}
          aria-label="Thumbs up"
        >
          👍
        </Button>
      </div>
    </div>
  )
}
