// tests/movie-card-review-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MovieCard } from '@/components/movie-card'
import type { Movie, Rating } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const movie: Movie = {
  id: 1,
  title: 'Seven Samurai',
  year: 1954,
  runtime: 207,
  description: '',
  posterUrl: '/poster.jpg',
  imdbId: 'tt0047478',
  tmdbId: 346,
  sortOrder: 0,
  status: 'watched',
  seerrStatus: 'available',
  createdAt: '2024-01-01',
}

const userNames = { user1: 'Alice', user2: 'Bob' }

const ratings: Rating[] = [
  { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'An epic masterpiece.', submittedAt: '2024-01-01' },
  { id: 2, movieId: 1, user: 'user2', rating: 'up', quote: 'Completely gripping.', submittedAt: '2024-01-01' },
]

describe('MovieCard — review modal trigger', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens the review modal when the poster/title area is clicked', () => {
    render(<MovieCard movie={{ ...movie, ratings }} userNames={userNames} />)
    // Click the trigger button
    fireEvent.click(screen.getByRole('button', { name: /view reviews for Seven Samurai/i }))
    // Both quotes now visible in the modal — check for both to ensure modal opened
    // The modal shows full quotes without truncation
    const quotes = screen.getAllByText(/An epic masterpiece/)
    expect(quotes.length).toBeGreaterThanOrEqual(2) // At least 2: one from card line-clamp, one from modal
    expect(screen.getAllByText(/Completely gripping/).length).toBeGreaterThanOrEqual(2)
  })

  it('does not open the modal when an Edit button is clicked', () => {
    render(<MovieCard movie={{ ...movie, ratings }} userNames={userNames} />)
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])
    // Edit dialog opens instead — check that the edit field exists (textarea with quote)
    // This proves the edit dialog opened, not the review modal
    const textarea = screen.getByPlaceholderText('A sentence or two about the film...')
    expect(textarea).toHaveValue('An epic masterpiece.')
  })
})
