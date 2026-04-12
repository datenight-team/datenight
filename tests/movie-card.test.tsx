// tests/movie-card.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MovieCard } from '@/components/movie-card'
import type { Movie, User } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1,
    title: 'Seven Samurai',
    year: 1954,
    runtime: 207,
    description: '',
    posterUrl: '',
    imdbId: 'tt0047478',
    tmdbId: 345911,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: 1,
    status: 'watched',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'available',
    watchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ratings: [],
    ...overrides,
  }
}

describe('MovieCard cleanup button', () => {
  beforeEach(() => mockFetch.mockReset())

  it('does not show cleanup button when seerrMediaId is null', () => {
    render(<MovieCard movie={makeMovie()} userNames={userNames} />)
    expect(screen.queryByText(/clean up/i)).not.toBeInTheDocument()
  })

  it('shows cleanup button when seerrMediaId is set', () => {
    render(<MovieCard movie={makeMovie({ seerrMediaId: '42' })} userNames={userNames} />)
    expect(screen.getByText(/clean up/i)).toBeInTheDocument()
  })

  it('shows loading state while cleanup is in progress', async () => {
    let resolve!: (v: unknown) => void
    mockFetch.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<MovieCard movie={makeMovie({ seerrMediaId: '42' })} userNames={userNames} />)
    fireEvent.click(screen.getByText(/clean up/i))
    expect(screen.getByText('Cleaning up…')).toBeInTheDocument()
    // resolve the promise so the component can settle before cleanup
    resolve({ json: async () => ({ ok: true }) })
    await waitFor(() => expect(screen.getByText(/cleaned up/i)).toBeInTheDocument())
  })

  it('shows done state on successful cleanup', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: true }) })
    render(<MovieCard movie={makeMovie({ seerrMediaId: '42' })} userNames={userNames} />)
    fireEvent.click(screen.getByText(/clean up/i))
    await waitFor(() => expect(screen.getByText(/cleaned up/i)).toBeInTheDocument())
  })

  it('shows error state when cleanup fails', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: false }) })
    render(<MovieCard movie={makeMovie({ seerrMediaId: '42' })} userNames={userNames} />)
    fireEvent.click(screen.getByText(/clean up/i))
    await waitFor(() => expect(screen.getByText(/failed/i)).toBeInTheDocument())
  })

  it('retries cleanup when error state button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: async () => ({ ok: false }) })
      .mockResolvedValueOnce({ json: async () => ({ ok: true }) })
    render(<MovieCard movie={makeMovie({ seerrMediaId: '42' })} userNames={userNames} />)
    fireEvent.click(screen.getByText(/clean up/i))
    await waitFor(() => screen.getByText(/failed/i))
    fireEvent.click(screen.getByText(/failed/i))
    await waitFor(() => expect(screen.getByText(/cleaned up/i)).toBeInTheDocument())
  })
})
