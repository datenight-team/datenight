// tests/match-night.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const prisma: any = {
    movie: { findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    swipeCandidate: {
      findMany: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn(),
    },
    swipe: { create: vi.fn(), findUnique: vi.fn() },
    setting: { findUnique: vi.fn(), upsert: vi.fn() },
  }
  prisma.$transaction = vi.fn((cb: any) => cb(prisma))
  return { prisma }
})
vi.mock('@/lib/criterion-catalog', () => ({
  getCriterionCatalog: vi.fn(),
}))
vi.mock('@/lib/tmdb', () => ({
  searchByTitle: vi.fn(),
  fetchPopularMovies: vi.fn(),
}))
vi.mock('@/lib/streaming', () => ({ syncMovieProviders: vi.fn().mockResolvedValue(undefined) }))

import { prisma } from '@/lib/db'
import { getCriterionCatalog } from '@/lib/criterion-catalog'
import { searchByTitle, fetchPopularMovies } from '@/lib/tmdb'
import { refillCandidates, getNextCandidateForUser, recordSwipe } from '@/lib/match-night'

const tmdbDetails = (overrides: Partial<any> = {}) => ({
  tmdbId: 1, title: 'Some Film', year: 1960, runtime: 90,
  description: 'desc', posterUrl: 'poster.jpg', imdbId: 'tt0000001',
  ...overrides,
})

describe('refillCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.setting.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.swipeCandidate.createMany).mockResolvedValue({ count: 0 } as any)
  })

  it('resolves catalog entries via TMDB and inserts them as criterion candidates', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Seven Samurai', year: 1954 }])
    vi.mocked(searchByTitle).mockResolvedValue(tmdbDetails({ tmdbId: 345911, title: 'Seven Samurai' }))
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    const count = await refillCandidates()

    expect(count).toBe(1)
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tmdbId: 345911, source: 'criterion' })],
    })
  })

  it('skips a resolved title that already exists as a Movie', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Seven Samurai', year: 1954 }])
    vi.mocked(prisma.movie.findMany).mockResolvedValue([{ tmdbId: 345911 }] as any)
    vi.mocked(searchByTitle).mockResolvedValue(tmdbDetails({ tmdbId: 345911 }))
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    const count = await refillCandidates()
    expect(count).toBe(0)
  })

  it('skips a resolved title that already exists as a SwipeCandidate', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Seven Samurai', year: 1954 }])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([{ tmdbId: 345911 }] as any)
    vi.mocked(searchByTitle).mockResolvedValue(tmdbDetails({ tmdbId: 345911 }))
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    const count = await refillCandidates()
    expect(count).toBe(0)
  })

  it('adds TMDB popular results as tmdb-source candidates', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(fetchPopularMovies).mockResolvedValue([tmdbDetails({ tmdbId: 99 })])

    const count = await refillCandidates()
    expect(count).toBe(1)
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tmdbId: 99, source: 'tmdb' })],
    })
  })

  it('continues with TMDB-only results when a Criterion title fails to resolve', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([{ title: 'Unresolvable Title' }])
    vi.mocked(searchByTitle).mockRejectedValue(new Error('timeout'))
    vi.mocked(fetchPopularMovies).mockResolvedValue([tmdbDetails({ tmdbId: 99 })])

    const count = await refillCandidates()
    expect(count).toBe(1)
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tmdbId: 99, source: 'tmdb' })],
    })
  })

  it('persists the TMDB popular page cursor after a refill', async () => {
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({ key: 'match_night_tmdb_popular_page', value: '3' } as any)
    vi.mocked(fetchPopularMovies).mockResolvedValue([])

    await refillCandidates()
    expect(fetchPopularMovies).toHaveBeenCalledWith(3)
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'match_night_tmdb_popular_page' } })
    )
  })
})

describe('getNextCandidateForUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the next candidate without refilling when the pending count is at or above threshold', async () => {
    vi.mocked(prisma.swipeCandidate.count).mockResolvedValue(5)
    const candidate = { id: 5, status: 'pending' }
    vi.mocked(prisma.swipeCandidate.findFirst).mockResolvedValue(candidate as any)

    const result = await getNextCandidateForUser('user1')

    expect(result).toEqual(candidate)
    expect(prisma.swipeCandidate.count).toHaveBeenCalledWith({
      where: { status: 'pending', swipes: { none: { user: 'user1' } } },
    })
    expect(prisma.swipeCandidate.findFirst).toHaveBeenCalledWith({
      where: { status: 'pending', swipes: { none: { user: 'user1' } } },
      orderBy: { createdAt: 'asc' },
    })
    expect(getCriterionCatalog).not.toHaveBeenCalled()
  })

  it('refills before returning when the pending count is below threshold', async () => {
    vi.mocked(prisma.swipeCandidate.count).mockResolvedValue(2)
    vi.mocked(prisma.swipeCandidate.findFirst).mockResolvedValue({ id: 7 } as any)
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(fetchPopularMovies).mockResolvedValue([tmdbDetails({ tmdbId: 42 })])
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)

    const result = await getNextCandidateForUser('user1')

    expect(result).toEqual({ id: 7 })
    expect(getCriterionCatalog).toHaveBeenCalled()
    expect(prisma.swipeCandidate.createMany).toHaveBeenCalled()
  })

  it('returns null when the pending count is below threshold and a refill adds nothing', async () => {
    vi.mocked(prisma.swipeCandidate.count).mockResolvedValue(0)
    vi.mocked(prisma.swipeCandidate.findFirst).mockResolvedValue(null)
    vi.mocked(getCriterionCatalog).mockReturnValue([])
    vi.mocked(fetchPopularMovies).mockResolvedValue([])
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])
    vi.mocked(prisma.swipeCandidate.findMany).mockResolvedValue([])
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)

    const result = await getNextCandidateForUser('user1')

    expect(result).toBeNull()
  })
})

describe('recordSwipe', () => {
  beforeEach(() => vi.clearAllMocks())

  const pendingCandidate = {
    id: 1, tmdbId: 345911, imdbId: 'tt0047478', title: 'Seven Samurai',
    year: 1954, runtime: 207, description: 'desc', posterUrl: 'p.jpg', status: 'pending',
  }

  it('marks the candidate dead on a down vote and does not touch Movie', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)

    const result = await recordSwipe(1, 'user1', 'down')

    expect(result).toEqual({ status: 'recorded' })
    expect(prisma.swipe.create).toHaveBeenCalledWith({ data: { candidateId: 1, user: 'user1', vote: 'down' } })
    expect(prisma.swipeCandidate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'dead' } })
    expect(prisma.movie.create).not.toHaveBeenCalled()
  })

  it('just records the vote when the other user has not voted up yet', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue(null)

    const result = await recordSwipe(1, 'user1', 'up')

    expect(result).toEqual({ status: 'recorded' })
    expect(prisma.movie.create).not.toHaveBeenCalled()
  })

  it('creates the Movie and marks matched when both users are up', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue({ candidateId: 1, user: 'user2', vote: 'up' } as any)
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 4 } } as any)
    const createdMovie = { id: 10, title: 'Seven Samurai', tmdbId: 345911 }
    vi.mocked(prisma.movie.create).mockResolvedValue(createdMovie as any)

    const result = await recordSwipe(1, 'user1', 'up')

    expect(result).toEqual({ status: 'matched', movie: createdMovie })
    expect(prisma.movie.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tmdbId: 345911, title: 'Seven Samurai', sortOrder: 5, matchedViaSwipe: true,
      }),
    })
    expect(prisma.swipeCandidate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'matched' } })
  })

  it('triggers syncMovieProviders after a match', async () => {
    const { syncMovieProviders } = await import('@/lib/streaming')
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue({ vote: 'up' } as any)
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 0 } } as any)
    vi.mocked(prisma.movie.create).mockResolvedValue({ id: 10, tmdbId: 345911 } as any)

    await recordSwipe(1, 'user1', 'up')
    await new Promise((r) => setTimeout(r, 0))
    expect(syncMovieProviders).toHaveBeenCalledWith(10, 345911)
  })

  it('is a no-op when the candidate is no longer pending', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue({ ...pendingCandidate, status: 'dead' } as any)

    const result = await recordSwipe(1, 'user1', 'up')

    expect(result).toEqual({ status: 'ignored' })
    expect(prisma.swipe.create).not.toHaveBeenCalled()
  })

  it('is a no-op when the candidate does not exist', async () => {
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(null)

    const result = await recordSwipe(999, 'user1', 'up')
    expect(result).toEqual({ status: 'ignored' })
  })

  it('falls back to the existing Movie on a unique constraint race instead of erroring', async () => {
    const { Prisma } = await import('@prisma/client')
    vi.mocked(prisma.swipeCandidate.findUnique).mockResolvedValue(pendingCandidate as any)
    vi.mocked(prisma.swipe.findUnique).mockResolvedValue({ vote: 'up' } as any)
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 0 } } as any)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002', clientVersion: '7.0.0',
    })
    vi.mocked(prisma.movie.create).mockRejectedValue(p2002)
    const existingMovie = { id: 10, tmdbId: 345911 }
    vi.mocked(prisma.movie.findUniqueOrThrow).mockResolvedValue(existingMovie as any)

    const result = await recordSwipe(1, 'user1', 'up')
    expect(result).toEqual({ status: 'matched', movie: existingMovie })
  })
})
