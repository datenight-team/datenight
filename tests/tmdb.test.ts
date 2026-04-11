// tests/tmdb.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after stubbing
const { findByImdbId, searchByTitle, lookupCriterionSlug } = await import('@/lib/tmdb')

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
    process.env.TMDB_API_KEY = 'test-key'
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
      id: 345911,
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
    process.env.TMDB_API_KEY = 'test-key'
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
    process.env.TMDB_API_KEY = 'test-key'
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
