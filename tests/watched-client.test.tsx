import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WatchedClient } from '@/components/watched-client'
import type { Movie, User, Rating } from '@/types'

// next/image doesn't work in jsdom — render a plain img instead
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

function makeRating(id: number, movieId: number, user: User, rating: 'up' | 'down'): Rating {
  return { id, movieId, user, rating, quote: 'A quote', submittedAt: new Date().toISOString() }
}

function makeMovie(id: number, title: string, ratings: Rating[] = []): Movie {
  return {
    id,
    title,
    year: 2000,
    runtime: 90,
    description: '',
    posterUrl: '',
    imdbId: `tt${id}`,
    tmdbId: id,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: id,
    status: 'watched',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'available',
    watchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ratings,
  }
}

const agreedMovie = makeMovie(1, 'Akira', [
  makeRating(1, 1, 'user1', 'up'),
  makeRating(2, 1, 'user2', 'up'),
])
const disagreedMovie = makeMovie(2, 'Breathless', [
  makeRating(3, 2, 'user1', 'up'),
  makeRating(4, 2, 'user2', 'down'),
])
const unratedMovie = makeMovie(3, 'Sunrise', [])

const movies = [agreedMovie, disagreedMovie, unratedMovie]

describe('WatchedClient', () => {
  it('renders all movies by default', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.getByText('Breathless')).toBeInTheDocument()
    expect(screen.getByText('Sunrise')).toBeInTheDocument()
  })

  it('filters by title text (case-insensitive)', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.change(screen.getByPlaceholderText('Search titles…'), { target: { value: 'akira' } })
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.queryByText('Breathless')).not.toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('filters to agreed movies when 🤝 Agreed is clicked', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '🤝 Agreed' }))
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.queryByText('Breathless')).not.toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('filters to disagreed movies when ⚔️ Disagreed is clicked', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '⚔️ Disagreed' }))
    expect(screen.queryByText('Akira')).not.toBeInTheDocument()
    expect(screen.getByText('Breathless')).toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('excludes unrated movies from agreement filters', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '🤝 Agreed' }))
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('shows filter-specific empty state when no movies match', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.change(screen.getByPlaceholderText('Search titles…'), { target: { value: 'zzznomatch' } })
    expect(screen.getByText('No movies match your filter')).toBeInTheDocument()
  })

  it('restores all movies when All is clicked', () => {
    render(<WatchedClient movies={movies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: '🤝 Agreed' }))
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('Akira')).toBeInTheDocument()
    expect(screen.getByText('Breathless')).toBeInTheDocument()
    expect(screen.getByText('Sunrise')).toBeInTheDocument()
  })
})

// Additional movies for needs-review filter tests
const bothRated = makeMovie(10, 'Both Rated', [
  makeRating(10, 10, 'user1', 'up'),
  makeRating(11, 10, 'user2', 'up'),
])

const onlyAliceRated = makeMovie(11, 'Only Alice Rated', [
  makeRating(12, 11, 'user1', 'up'),
])

const onlyBobRated = makeMovie(12, 'Only Bob Rated', [
  makeRating(13, 12, 'user2', 'down'),
])

const neitherRated = makeMovie(13, 'Neither Rated', [])

const needsReviewMovies = [bothRated, onlyAliceRated, onlyBobRated, neitherRated]

describe('WatchedClient needs-review filters', () => {
  it('renders "Needs Alice" and "Needs Bob" buttons using userNames', () => {
    render(<WatchedClient movies={needsReviewMovies} userNames={userNames} />)
    expect(screen.getByRole('button', { name: /Needs Alice/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Needs Bob/i })).toBeInTheDocument()
  })

  it('"Needs Alice" shows movies where user1 has not rated', () => {
    render(<WatchedClient movies={needsReviewMovies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs Alice/i }))
    expect(screen.queryByText('Both Rated')).not.toBeInTheDocument()
    expect(screen.queryByText('Only Alice Rated')).not.toBeInTheDocument()
    expect(screen.getByText('Only Bob Rated')).toBeInTheDocument()
    expect(screen.getByText('Neither Rated')).toBeInTheDocument()
  })

  it('"Needs Bob" shows movies where user2 has not rated', () => {
    render(<WatchedClient movies={needsReviewMovies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs Bob/i }))
    expect(screen.queryByText('Both Rated')).not.toBeInTheDocument()
    expect(screen.queryByText('Only Bob Rated')).not.toBeInTheDocument()
    expect(screen.getByText('Only Alice Rated')).toBeInTheDocument()
    expect(screen.getByText('Neither Rated')).toBeInTheDocument()
  })

  it('"All" button clears a needs-review filter', () => {
    render(<WatchedClient movies={needsReviewMovies} userNames={userNames} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs Alice/i }))
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }))
    expect(screen.getByText('Both Rated')).toBeInTheDocument()
    expect(screen.getByText('Only Alice Rated')).toBeInTheDocument()
    expect(screen.getByText('Only Bob Rated')).toBeInTheDocument()
    expect(screen.getByText('Neither Rated')).toBeInTheDocument()
  })
})
