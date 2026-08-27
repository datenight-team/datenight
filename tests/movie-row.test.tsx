// tests/movie-row.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MovieRow } from '@/components/movie-row'
import type { Movie } from '@/types'

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
    matchedViaSwipe: false,
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

  it('renders not_requested pill with muted classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'not_requested' })} {...defaultProps} />)
    const pill = screen.getByText('Not Requested')
    expect(pill).toHaveClass('bg-muted', 'text-muted-foreground', 'border-transparent')
  })

  it('renders pending pill with queued classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'pending' })} {...defaultProps} />)
    const pill = screen.getByText('Queued')
    expect(pill).toHaveClass('bg-queued-bg', 'text-queued', 'border-transparent')
  })

  it('renders processing pill with downloading classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'processing' })} {...defaultProps} />)
    const pill = screen.getByText('Downloading')
    expect(pill).toHaveClass('bg-downloading-bg', 'text-downloading', 'border-transparent')
  })

  it('renders available pill with success classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'available' })} {...defaultProps} />)
    const pill = screen.getByText('Ready')
    expect(pill).toHaveClass('bg-success-bg', 'text-success', 'border-transparent')
  })

  it('renders deleted pill with muted classes', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'deleted' })} {...defaultProps} />)
    const pill = screen.getByText('Deleted')
    expect(pill).toHaveClass('bg-muted', 'text-muted-foreground', 'border-transparent')
  })
})

describe('MovieRow layout', () => {
  it('renders streaming badge inside the info section (not actions column)', () => {
    render(
      <MovieRow
        movie={makeMovie({ seerrStatus: 'available' })}
        {...defaultProps}
        streamingProviders={[{ id: 99, movieId: 1, providerId: 8, providerName: 'Netflix' }]}
        streamingLink="https://netflix.com"
      />
    )
    const infoSection = screen.getByText('Jeanne Dielman').closest('div')
    expect(infoSection).toContainElement(screen.getByText('Streaming'))
  })

  it('renders the Seerr status pill inside the info section', () => {
    render(<MovieRow movie={makeMovie({ seerrStatus: 'pending' })} {...defaultProps} />)
    const infoSection = screen.getByText('Jeanne Dielman').closest('div')
    expect(infoSection).toContainElement(screen.getByText('Queued'))
  })

  it('renders Watch link with a primary-tinted outline instead of a dark fill', () => {
    render(
      <MovieRow
        movie={makeMovie({ seerrStatus: 'available' })}
        {...defaultProps}
        streamingProviders={[{ id: 99, movieId: 1, providerId: 8, providerName: 'Netflix' }]}
        streamingLink="https://netflix.com"
      />
    )
    const watchLink = screen.getByRole('link', { name: /watch/i })
    expect(watchLink).not.toHaveClass('bg-stone-800')
    expect(watchLink).toHaveClass('border-primary/40')
  })
})

describe('MovieRow match badge', () => {
  beforeEach(() => mockFetch.mockReset())

  it('shows the match badge when matchedViaSwipe is true', () => {
    render(<MovieRow movie={makeMovie({ matchedViaSwipe: true })} {...defaultProps} />)
    expect(screen.getByText(/it's a match/i)).toBeInTheDocument()
  })

  it('does not show the match badge for regularly-added movies', () => {
    render(<MovieRow movie={makeMovie({ matchedViaSwipe: false })} {...defaultProps} />)
    expect(screen.queryByText(/it's a match/i)).not.toBeInTheDocument()
  })
})
