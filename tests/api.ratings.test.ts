// tests/api.ratings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    rating: { create: vi.fn(), findMany: vi.fn() },
    movie: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/seerr', () => ({ deleteMedia: vi.fn() }))

import { prisma } from '@/lib/db'
import * as seerr from '@/lib/seerr'
import { POST as POST_RATING } from '@/app/api/ratings/route'
import { POST as POST_WATCHED } from '@/app/api/movies/[id]/watched/route'

const movie = {
  id: 1, title: 'Seven Samurai', tmdbId: 345911,
  seerrMediaId: '42', status: 'watchlist',
}

describe('POST /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a rating and returns incomplete when only one rating exists', async () => {
    vi.mocked(prisma.rating.create).mockResolvedValue({
      id: 1, movieId: 1, user: 'user1', stars: 4, quote: 'Epic!', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', stars: 4, quote: 'Epic!' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', stars: 4, quote: 'Epic!' }),
    })
    const res = await POST_RATING(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.complete).toBe(false)
    expect(data.ratings).toHaveLength(1)
  })

  it('returns complete=true and both ratings when both users have rated', async () => {
    vi.mocked(prisma.rating.create).mockResolvedValue({
      id: 2, movieId: 1, user: 'user2', stars: 5, quote: 'Masterpiece!', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', stars: 4, quote: 'Epic!' },
      { user: 'user2', stars: 5, quote: 'Masterpiece!' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user2', stars: 5, quote: 'Masterpiece!' }),
    })
    const res = await POST_RATING(req)
    const data = await res.json()
    expect(data.complete).toBe(true)
    expect(data.ratings).toHaveLength(2)
  })

  it('returns 422 for invalid stars value', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', stars: 6, quote: 'hi' }),
    })
    expect((await POST_RATING(req)).status).toBe(422)
  })

  it('returns 422 for empty quote', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', stars: 3, quote: '   ' }),
    })
    expect((await POST_RATING(req)).status).toBe(422)
  })
})

describe('POST /api/movies/[id]/watched', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks movie as watched and triggers Seerr delete', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue(movie as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({ ...movie, status: 'watched' } as any)
    vi.mocked(seerr.deleteMedia).mockResolvedValue(true)

    const req = new Request('http://localhost/api/movies/1/watched', { method: 'POST' })
    const res = await POST_WATCHED(req, { params: { id: '1' } })
    expect(res.status).toBe(200)
    expect(seerr.deleteMedia).toHaveBeenCalledWith(42)
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'watched', watchedAt: expect.any(Date) },
    })
  })
})
