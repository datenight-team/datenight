// tests/seerr.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { getMovieStatus, requestMovie, deleteMedia } = await import('@/lib/seerr')

describe('getMovieStatus', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.SEERR_URL = 'http://seerr:5055'
    process.env.SEERR_API_KEY = 'test-key'
  })

  it('returns available when Seerr status is 5', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mediaInfo: { id: 42, status: 5, requests: [{ id: 99 }] },
      }),
    })
    const result = await getMovieStatus(345911)
    expect(result).toEqual({
      status: 'available',
      seerrMediaId: 42,
      seerrRequestId: 99,
    })
  })

  it('returns processing when status is 3', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mediaInfo: { id: 42, status: 3, requests: [] } }),
    })
    expect((await getMovieStatus(345911)).status).toBe('processing')
  })

  it('returns pending when status is 2', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mediaInfo: { id: 42, status: 2, requests: [] } }),
    })
    expect((await getMovieStatus(345911)).status).toBe('pending')
  })

  it('returns not_requested when mediaInfo is absent', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    expect((await getMovieStatus(345911)).status).toBe('not_requested')
  })

  it('returns not_requested on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect((await getMovieStatus(345911)).status).toBe('not_requested')
  })
})

describe('requestMovie', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.SEERR_URL = 'http://seerr:5055'
    process.env.SEERR_API_KEY = 'test-key'
  })

  it('returns requestId on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) })
    expect(await requestMovie(345911)).toEqual({ requestId: '99' })
  })

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await requestMovie(345911)).toBeNull()
  })
})

describe('deleteMedia', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.SEERR_URL = 'http://seerr:5055'
    process.env.SEERR_API_KEY = 'test-key'
  })

  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    expect(await deleteMedia(42)).toBe(true)
  })

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await deleteMedia(42)).toBe(false)
  })
})
