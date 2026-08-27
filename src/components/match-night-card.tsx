'use client'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
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
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm max-w-xs mx-auto">
      <MoviePoster posterUrl={candidate.posterUrl} title={candidate.title} size="lg" />
      <div className="p-4">
        <h2 className="font-bold text-foreground text-lg leading-tight">{candidate.title}</h2>
        <p className="text-muted-foreground text-sm mb-2">{candidate.year}</p>
        <p className="text-muted-foreground text-sm line-clamp-4">{candidate.description}</p>
      </div>
      <div className="flex gap-3 justify-center pb-4">
        <Button
          size="lg"
          variant="outline"
          className="px-6 text-rose disabled:opacity-40"
          disabled={voting}
          onClick={() => onVote('down')}
          aria-label="Thumbs down"
        >
          <ThumbsDown className="w-6 h-6" aria-hidden="true" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="px-6 text-success disabled:opacity-40"
          disabled={voting}
          onClick={() => onVote('up')}
          aria-label="Thumbs up"
        >
          <ThumbsUp className="w-6 h-6" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
