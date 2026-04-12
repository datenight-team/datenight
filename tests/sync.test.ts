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
  syncDateNightPlaylist: vi.fn(),
}))

import { prisma } from '@/lib/db'
import * as seerr from '@/lib/seerr'
import * as plex from '@/lib/plex'
import { runSync } from '@/lib/sync'

const baseMovie = {
  id: 1,
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
  })

  it('requests top-10 movies not yet in Seerr', async () => {
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([baseMovie] as any)
      .mockResolvedValueOnce([])
    vi.mocked(seerr.requestMovie).mockResolvedValue({ requestId: '99' })
    vi.mocked(plex.syncDateNightPlaylist).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).toHaveBeenCalledWith(345911)
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { seerrRequestId: '99', seerrMediaId: null, seerrStatus: 'pending' },
    })
  })

  it('polls status for already-requested movies', async () => {
    const movie = { ...baseMovie, seerrRequestId: '99', seerrStatus: 'pending' }
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([movie] as any)
      .mockResolvedValueOnce([])
    vi.mocked(seerr.getMovieStatus).mockResolvedValue({
      status: 'processing',
      seerrMediaId: 42,
    })
    vi.mocked(plex.syncDateNightPlaylist).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).not.toHaveBeenCalled()
    expect(seerr.getMovieStatus).toHaveBeenCalledWith(345911)
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { seerrStatus: 'processing', seerrMediaId: '42' },
    })
  })

  it('skips requestMovie when SEERR_CONCURRENCY is 0', async () => {
    vi.stubEnv('SEERR_CONCURRENCY', '0')
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([baseMovie] as any)
      .mockResolvedValueOnce([])
    vi.mocked(plex.syncDateNightPlaylist).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('skips requestMovie when active downloads are at the concurrency limit', async () => {
    vi.stubEnv('SEERR_CONCURRENCY', '2')
    vi.mocked(prisma.movie.count).mockResolvedValue(2)
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([baseMovie] as any)
      .mockResolvedValueOnce([])
    vi.mocked(plex.syncDateNightPlaylist).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('allows requestMovie when active downloads are under the concurrency limit', async () => {
    vi.stubEnv('SEERR_CONCURRENCY', '2')
    vi.mocked(prisma.movie.count).mockResolvedValue(1)
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([baseMovie] as any)
      .mockResolvedValueOnce([])
    vi.mocked(seerr.requestMovie).mockResolvedValue({ requestId: '99' })
    vi.mocked(plex.syncDateNightPlaylist).mockResolvedValue()

    await runSync()

    expect(seerr.requestMovie).toHaveBeenCalledWith(345911)
    vi.unstubAllEnvs()
  })

  it('syncs Plex playlist with available movies in sort order', async () => {
    vi.mocked(prisma.movie.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...baseMovie, seerrStatus: 'available' }] as any)
    vi.mocked(plex.syncDateNightPlaylist).mockResolvedValue()

    await runSync()

    expect(plex.syncDateNightPlaylist).toHaveBeenCalledWith([
      { imdbId: 'tt0047478' },
    ])
  })
})
