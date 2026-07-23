import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MatchNightCard } from '@/components/match-night-card'
import type { SwipeCandidateRecord } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const candidate: SwipeCandidateRecord = {
  id: 1, tmdbId: 345911, imdbId: 'tt0047478', title: 'Seven Samurai', year: 1954,
  runtime: 207, description: 'A poor village recruits seven samurai.', posterUrl: 'poster.jpg',
  source: 'criterion', status: 'pending', createdAt: new Date().toISOString(),
}

describe('MatchNightCard', () => {
  it('renders the title, year, and description', () => {
    render(<MatchNightCard candidate={candidate} voting={false} onVote={vi.fn()} />)
    expect(screen.getByText('Seven Samurai')).toBeInTheDocument()
    expect(screen.getByText('1954')).toBeInTheDocument()
    expect(screen.getByText(/seven samurai\.$/i)).toBeInTheDocument()
  })

  it('calls onVote("up") when the thumbs-up button is clicked', () => {
    const onVote = vi.fn()
    render(<MatchNightCard candidate={candidate} voting={false} onVote={onVote} />)
    fireEvent.click(screen.getByRole('button', { name: /thumbs up/i }))
    expect(onVote).toHaveBeenCalledWith('up')
  })

  it('calls onVote("down") when the thumbs-down button is clicked', () => {
    const onVote = vi.fn()
    render(<MatchNightCard candidate={candidate} voting={false} onVote={onVote} />)
    fireEvent.click(screen.getByRole('button', { name: /thumbs down/i }))
    expect(onVote).toHaveBeenCalledWith('down')
  })

  it('disables both buttons while voting', () => {
    render(<MatchNightCard candidate={candidate} voting={true} onVote={vi.fn()} />)
    expect(screen.getByRole('button', { name: /thumbs up/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /thumbs down/i })).toBeDisabled()
  })
})
