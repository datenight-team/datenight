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
