// tests/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    movie: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
}))
vi.mock('@/lib/seerr', () => ({
  getMovieStatus: vi.fn(),
  requestMovie: vi.fn(),
}))
vi.mock('@/lib/plex', () => ({
  syncDateNightCollection: vi.fn(),
}))
vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}))

import { prisma } from '@/lib/db'
import * as seerr from '@/lib/seerr'
import * as plex from '@/lib/plex'
import { getConfig } from '@/lib/config'
import { runSync } from '@/lib/sync'

const mockConfig = {
  seerrConcurrency: '',
  user1Name: 'User 1', user2Name: 'User 2',
  tmdbApiKey: '', seerrUrl: '', seerrPublicUrl: '', seerrApiKey: '',
  plexUrl: '', plexToken: '', anthropicApiKey: '',
  streamingRegion: 'US', streamingServices: '[]',
}

const baseMovie = {
  id: 1,
  title: 'Seven Samurai',
  year: 1954,
  tmdbId: 345911,
  imdbId: 'tt0047478',
  seerrRequestId: null,
  seerrStatus: 'not_requested',
  status: 'watchlist',
  sortOrder: 1,
}

describe('runSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.movie.count).mockResolvedValue(0)
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('requests top-10 movies not yet in Seerr', async () => {
    // call order: toRequest, requested, available
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([baseMovie] as any)  // toRequest
      .mockResolvedValueOnce([])                  // requested (none pending)
      .mockResolvedValueOnce([])                  // available (for Plex)
    vi.mocked(seerr.requestMovie).mockResolvedValue({ requestId: '99' })
    vi.mocked(plex.syncDateNightCollection).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).toHaveBeenCalledWith(345911)
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { seerrRequestId: '99', seerrMediaId: null, seerrStatus: 'pending' },
    })
  })

  it('polls status for already-requested movies', async () => {
    const movie = { ...baseMovie, seerrRequestId: '99', seerrStatus: 'pending' }
    // call order: toRequest (nothing to request), requested (has movie), available
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([])              // toRequest
      .mockResolvedValueOnce([movie] as any)  // requested
      .mockResolvedValueOnce([])              // available (for Plex)
    vi.mocked(seerr.getMovieStatus).mockResolvedValue({
      status: 'processing',
      seerrMediaId: 42,
    })
    vi.mocked(plex.syncDateNightCollection).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).not.toHaveBeenCalled()
    expect(seerr.getMovieStatus).toHaveBeenCalledWith(345911)
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { seerrStatus: 'processing', seerrMediaId: '42' },
    })
  })

  it('skips requestMovie when SEERR_CONCURRENCY is 0', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, seerrConcurrency: '0' })
    // canRequest=false → toRequest query is skipped; only requested + available
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([])  // requested
      .mockResolvedValueOnce([])  // available (for Plex)
    vi.mocked(plex.syncDateNightCollection).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).not.toHaveBeenCalled()
  })

  it('skips requestMovie when active downloads are at the concurrency limit', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, seerrConcurrency: '2' })
    vi.mocked(prisma.movie.count).mockResolvedValue(2)
    // canRequest=false → toRequest query is skipped; only requested + available
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([])  // requested
      .mockResolvedValueOnce([])  // available (for Plex)
    vi.mocked(plex.syncDateNightCollection).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).not.toHaveBeenCalled()
  })

  it('allows requestMovie when active downloads are under the concurrency limit', async () => {
    vi.mocked(getConfig).mockResolvedValue({ ...mockConfig, seerrConcurrency: '2' })
    vi.mocked(prisma.movie.count).mockResolvedValue(1)
    // call order: toRequest, requested, available
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([baseMovie] as any)  // toRequest
      .mockResolvedValueOnce([])                  // requested
      .mockResolvedValueOnce([])                  // available (for Plex)
    vi.mocked(seerr.requestMovie).mockResolvedValue({ requestId: '99' })
    vi.mocked(plex.syncDateNightCollection).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).toHaveBeenCalledWith(345911)
  })

  it('syncs Plex collection with available movies in sort order', async () => {
    // call order: toRequest (nothing), requested (nothing), available
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([])                                              // toRequest
      .mockResolvedValueOnce([])                                              // requested
      .mockResolvedValueOnce([{ ...baseMovie, seerrStatus: 'available' }] as any) // available
    vi.mocked(plex.syncDateNightCollection).mockResolvedValue()

    await runSync()

    expect(plex.syncDateNightCollection).toHaveBeenCalledWith([
      { title: baseMovie.title, year: baseMovie.year },
    ])
  })
})
