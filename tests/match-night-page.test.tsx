// tests/match-night-page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MatchNightPage from '@/app/match-night/page'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const candidate = {
  id: 1, tmdbId: 345911, imdbId: 'tt0047478', title: 'Seven Samurai', year: 1954,
  runtime: 207, description: 'desc', posterUrl: 'poster.jpg', source: 'criterion',
  status: 'pending', createdAt: new Date().toISOString(),
}

function jsonResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: async () => data })
}

describe('MatchNightPage', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user-names')) return jsonResponse({ user1: 'Ian', user2: 'Krista' })
      if (url.includes('/api/match-night/next')) return jsonResponse({ candidate })
      if (url.includes('/api/match-night/swipe')) return jsonResponse({ status: 'recorded' })
      return jsonResponse({})
    })
  })

  it('shows a user picker before swiping starts', async () => {
    render(<MatchNightPage />)
    await waitFor(() => expect(screen.getByText('Ian')).toBeInTheDocument())
    expect(screen.getByText('Krista')).toBeInTheDocument()
  })

  it('loads the next candidate after picking a user', async () => {
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => expect(screen.getByText('Seven Samurai')).toBeInTheDocument())
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/match-night/next?user=user1'))
  })

  it('submits a swipe and requests the next card', async () => {
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => screen.getByText('Seven Samurai'))

    fireEvent.click(screen.getByRole('button', { name: /thumbs up/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/match-night/swipe',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('requests the next card after a match, without showing any in-page match feedback', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user-names')) return jsonResponse({ user1: 'Ian', user2: 'Krista' })
      if (url.includes('/api/match-night/next')) return jsonResponse({ candidate })
      if (url.includes('/api/match-night/swipe')) return jsonResponse({ status: 'matched', movie: { id: 10 } })
      return jsonResponse({})
    })
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => screen.getByText('Seven Samurai'))
    fireEvent.click(screen.getByRole('button', { name: /thumbs up/i }))
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/match-night/next?user=user1'))
    )
    expect(screen.queryByText(/it's a match/i)).not.toBeInTheDocument()
  })

  it('shows an empty state when there is no next candidate', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user-names')) return jsonResponse({ user1: 'Ian', user2: 'Krista' })
      if (url.includes('/api/match-night/next')) return jsonResponse({ candidate: null })
      return jsonResponse({})
    })
    render(<MatchNightPage />)
    await waitFor(() => screen.getByText('Ian'))
    fireEvent.click(screen.getByText('Ian'))
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument())
  })
})
