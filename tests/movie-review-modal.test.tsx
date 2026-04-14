// tests/movie-review-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MovieReviewModal } from '@/components/movie-review-modal'
import type { Movie, Rating } from '@/types'

// next/image doesn't work in jsdom — render a plain img instead
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const movie: Movie = {
  id: 1,
  title: 'The Grand Illusion',
  year: 1937,
  runtime: 114,
  description: '',
  posterUrl: '/poster.jpg',
  imdbId: 'tt0029050',
  tmdbId: 12345,
  sortOrder: 0,
  status: 'watched',
  seerrStatus: 'available',
  createdAt: '2024-01-01',
}

const userNames = { user1: 'Alice', user2: 'Bob' }

const ratings: Rating[] = [
  { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'A masterpiece of world cinema.', submittedAt: '2024-01-01' },
  { id: 2, movieId: 1, user: 'user2', rating: 'up', quote: 'Deeply moving from start to finish.', submittedAt: '2024-01-01' },
]

describe('MovieReviewModal', () => {
  const onClose = vi.fn()
  const onEditUser = vi.fn()

  beforeEach(() => {
    onClose.mockClear()
    onEditUser.mockClear()
  })

  it('shows the movie title and year', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('The Grand Illusion')).toBeInTheDocument()
    expect(screen.getByText('1937')).toBeInTheDocument()
  })

  it('shows both users full review quotes', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText(/A masterpiece of world cinema/)).toBeInTheDocument()
    expect(screen.getByText(/Deeply moving from start to finish/)).toBeInTheDocument()
  })

  it('shows agree badge when both users rated the same', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('🤝 You agreed')).toBeInTheDocument()
  })

  it('shows disagree badge when users rated differently', () => {
    const mixedRatings: Rating[] = [
      { ...ratings[0], rating: 'up' },
      { ...ratings[1], rating: 'down' },
    ]
    render(
      <MovieReviewModal
        movie={movie} ratings={mixedRatings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('⚔️ You disagreed')).toBeInTheDocument()
  })

  it('shows No review yet placeholder for a user with no rating', () => {
    const oneRating: Rating[] = [ratings[0]]
    render(
      <MovieReviewModal
        movie={movie} ratings={oneRating} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('No review yet')).toBeInTheDocument()
    expect(screen.getByText(/A masterpiece of world cinema/)).toBeInTheDocument()
  })

  it('shows No reviews yet when no ratings at all', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={[]} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
  })

  it('calls onEditUser with user1 when Alice edit link is clicked', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    fireEvent.click(screen.getByText("Edit Alice's review"))
    expect(onEditUser).toHaveBeenCalledWith('user1')
  })

  it('calls onEditUser with user2 when Bob edit link is clicked', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    fireEvent.click(screen.getByText("Edit Bob's review"))
    expect(onEditUser).toHaveBeenCalledWith('user2')
  })

  it('calls onClose when Close button is clicked', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={true} onClose={onClose} onEditUser={onEditUser}
      />
    )
    fireEvent.click(screen.getByTestId('modal-close-btn'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render content when open is false', () => {
    render(
      <MovieReviewModal
        movie={movie} ratings={ratings} userNames={userNames}
        open={false} onClose={onClose} onEditUser={onEditUser}
      />
    )
    expect(screen.queryByText('The Grand Illusion')).not.toBeInTheDocument()
  })
})
