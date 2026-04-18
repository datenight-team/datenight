// tests/movie-row.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MovieRow } from '@/components/movie-row'
import type { Movie, User } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1,
    title: 'Jeanne Dielman',
    year: 1975,
    runtime: 201,
    description: '',
    posterUrl: '',
    imdbId: 'tt0073198',
    tmdbId: 11650,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: 1,
    status: 'watchlist',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'not_requested',
    watchedAt: null,
    createdAt: new Date().toISOString(),
    streamingLastChecked: new Date().toISOString(),
    streamingLink: null,
    ratings: [],
    streamingProviders: [],
    ...overrides,
  }
}

const defaultProps = {
  position: 1,
  seerrUrl: null,
  streamingProviders: [],
  streamingLink: null,
  onMarkWatched: vi.fn(),
  onForceDownload: vi.fn(),
  onRemove: vi.fn(),
}

describe('MovieRow status pill colors', () => {
  beforeEach(() => mockFetch.mockReset())

  it('renders not_requested pill with stone classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'not_requested' })} {...defaultProps} />)
    const pill = screen.getByText('Not Requested')
    expect(pill).toHaveClass('bg-stone-100', 'text-stone-500', 'border-stone-200')
  })

  it('renders pending pill with indigo classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'pending' })} {...defaultProps} />)
    const pill = screen.getByText('Queued')
    expect(pill).toHaveClass('bg-indigo-50', 'text-indigo-600', 'border-indigo-200')
  })

  it('renders processing pill with amber classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'processing' })} {...defaultProps} />)
    const pill = screen.getByText('Downloading')
    expect(pill).toHaveClass('bg-amber-50', 'text-amber-600', 'border-amber-200')
  })

  it('renders available pill with green classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'available' })} {...defaultProps} />)
    const pill = screen.getByText('Ready')
    expect(pill).toHaveClass('bg-green-50', 'text-green-700', 'border-green-200')
  })

  it('renders deleted pill with stone classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'deleted' })} {...defaultProps} />)
    const pill = screen.getByText('Deleted')
    expect(pill).toHaveClass('bg-stone-100', 'text-stone-500', 'border-stone-200')
  })
})
