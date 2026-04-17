// tests/tmdb.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}))

import { getConfig } from '@/lib/config'
const { findByImdbId, searchByTitle, lookupCriterionSlug, fetchWatchProviders, fetchProviderList } = await import('@/lib/tmdb')

const mockConfig = {
  tmdbApiKey: 'test-key',
  user1Name: 'User 1', user2Name: 'User 2',
  seerrUrl: '', seerrPublicUrl: '', seerrApiKey: '', seerrConcurrency: '',
  plexUrl: '', plexToken: '', anthropicApiKey: '',
  streamingRegion: 'US', streamingServices: '[]',
}

const detailsResponse = {
  id: 345911,
  title: 'Seven Samurai',
  release_date: '1954-04-26',
  runtime: 207,
  overview: 'A poor village under attack by bandits recruits seven samurai.',
  poster_path: '/8OKmBV5BUFzmozIC3pPWKHy17kx.jpg',
  imdb_id: 'tt0047478',
}

describe('findByImdbId', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns movie details for a valid IMDB ID', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ movie_results: [{ id: 345911 }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => detailsResponse })

    const result = await findByImdbId('tt0047478')
    expect(result).toMatchObject({
      tmdbId: 345911,
      title: 'Seven Samurai',
      year: 1954,
      runtime: 207,
      imdbId: 'tt0047478',
      posterUrl: expect.stringContaining('8OKmBV5BUFzmozIC3pPWKHy17kx.jpg'),
    })
  })

  it('returns null when IMDB ID yields no TMDB results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ movie_results: [] }),
    })
    expect(await findByImdbId('tt9999999')).toBeNull()
  })

  it('returns null on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await findByImdbId('tt0047478')).toBeNull()
  })
})

describe('searchByTitle', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns first result for a title search', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 345911 }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => detailsResponse })

    const result = await searchByTitle('Seven Samurai')
    expect(result?.title).toBe('Seven Samurai')
  })

  it('returns null when no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    })
    expect(await searchByTitle('xyzzy not real')).toBeNull()
  })
})

describe('lookupCriterionSlug', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('extracts title from og:title and searches TMDB', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<meta property="og:title" content="Seven Samurai | The Criterion Collection">',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 345911 }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => detailsResponse })

    const result = await lookupCriterionSlug('28630-seven-samurai')
    expect(result?.title).toBe('Seven Samurai')
  })

  it('falls back to slug-derived title search when Criterion page is blocked', async () => {
    // Criterion page blocked (e.g. Cloudflare) → fall back to slug title → TMDB search succeeds
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // Criterion page blocked
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 345911 }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => detailsResponse })

    const result = await lookupCriterionSlug('28630-seven-samurai')
    expect(result?.title).toBe('Seven Samurai')
  })

  it('returns null when Criterion page is blocked and slug search finds nothing', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // Criterion page blocked
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) }) // slug search misses

    expect(await lookupCriterionSlug('28630-seven-samurai')).toBeNull()
  })
})

describe('fetchWatchProviders', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns flatrate providers for the given region', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          US: {
            link: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
            flatrate: [
              { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
              { provider_id: 337, provider_name: 'Disney+', logo_path: '/disney.jpg' },
            ],
          },
        },
      }),
    })
    const result = await fetchWatchProviders(345911, 'US')
    expect(result).toEqual({
      link: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
      flatrate: [
        { providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg' },
        { providerId: 337, providerName: 'Disney+', logoPath: '/disney.jpg' },
      ],
    })
  })

  it('returns null when region has no providers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: {} }),
    })
    expect(await fetchWatchProviders(345911, 'ZZ')).toBeNull()
  })

  it('returns null when TMDB key is not configured', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, tmdbApiKey: '' })
    expect(await fetchWatchProviders(345911, 'US')).toBeNull()
  })

  it('returns null on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await fetchWatchProviders(345911, 'US')).toBeNull()
  })
})

describe('fetchProviderList', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('returns list of providers for the region', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
          { provider_id: 337, provider_name: 'Disney+', logo_path: '/disney.jpg' },
        ],
      }),
    })
    const result = await fetchProviderList('US')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg' })
    expect(result[1]).toEqual({ providerId: 337, providerName: 'Disney+', logoPath: '/disney.jpg' })
  })

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await fetchProviderList('US')).toEqual([])
  })

  it('returns empty array when TMDB key is not configured', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, tmdbApiKey: '' })
    expect(await fetchProviderList('US')).toEqual([])
  })
})
