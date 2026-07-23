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

import { prisma } from '@/lib/db'
import { getCriterionCatalog } from '@/lib/criterion-catalog'
import { searchByTitle, fetchPopularMovies } from '@/lib/tmdb'
import { refillCandidates } from '@/lib/match-night'

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
