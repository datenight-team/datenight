// tests/api.ratings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    rating: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    movie: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/seerr', () => ({ deleteMedia: vi.fn() }))

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import * as seerr from '@/lib/seerr'
import { POST as POST_RATING, PATCH as PATCH_RATING } from '@/app/api/ratings/route'
import { POST as POST_WATCHED } from '@/app/api/movies/[id]/watched/route'

const movie = {
  id: 1, title: 'Seven Samurai', tmdbId: 345911,
  seerrMediaId: '42', status: 'watchlist',
}

describe('POST /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a rating and returns incomplete when only one rating exists', async () => {
    vi.mocked(prisma.rating.create).mockResolvedValue({
      id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'A masterpiece.', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', rating: 'up', quote: 'A masterpiece.' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: 'A masterpiece.' }),
    })
    const res = await POST_RATING(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.complete).toBe(false)
    expect(data.ratings).toHaveLength(1)
  })

  it('returns complete=true when both users have rated', async () => {
    vi.mocked(prisma.rating.create).mockResolvedValue({
      id: 2, movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me.', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', rating: 'up', quote: 'A masterpiece.' },
      { user: 'user2', rating: 'down', quote: 'Not for me.' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me.' }),
    })
    const res = await POST_RATING(req)
    const data = await res.json()
    expect(data.complete).toBe(true)
    expect(data.ratings).toHaveLength(2)
  })

  it('returns 422 for invalid rating value', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'sideways', quote: 'Hmm.' }),
    })
    expect((await POST_RATING(req)).status).toBe(422)
  })

  it('returns 422 for empty quote', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: '   ' }),
    })
    expect((await POST_RATING(req)).status).toBe(422)
  })
})

describe('PATCH /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates an existing rating and returns 200 with ratings array', async () => {
    vi.mocked(prisma.rating.update).mockResolvedValue({
      id: 1, movieId: 1, user: 'user1', rating: 'down', quote: 'Changed my mind.', submittedAt: new Date(),
    } as any)
    vi.mocked(prisma.rating.findMany).mockResolvedValue([
      { user: 'user1', rating: 'down', quote: 'Changed my mind.' },
      { user: 'user2', rating: 'up', quote: 'Still love it.' },
    ] as any)

    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'down', quote: 'Changed my mind.' }),
    })
    const res = await PATCH_RATING(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ratings).toHaveLength(2)
    expect(prisma.rating.update).toHaveBeenCalledWith({
      where: { movieId_user: { movieId: 1, user: 'user1' } },
      data: { rating: 'down', quote: 'Changed my mind.' },
    })
  })

  it('returns 404 when no prior rating exists', async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.0.0',
    })
    vi.mocked(prisma.rating.update).mockRejectedValue(p2025)

    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 99, user: 'user1', rating: 'up', quote: 'Great.' }),
    })
    const res = await PATCH_RATING(req)
    expect(res.status).toBe(404)
  })

  it('returns 422 for invalid user', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user3', rating: 'up', quote: 'Great.' }),
    })
    expect((await PATCH_RATING(req)).status).toBe(422)
  })

  it('returns 422 for invalid rating value', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'meh', quote: 'Hmm.' }),
    })
    expect((await PATCH_RATING(req)).status).toBe(422)
  })

  it('returns 422 for empty quote', async () => {
    const req = new Request('http://localhost/api/ratings', {
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: '  ' }),
    })
    expect((await PATCH_RATING(req)).status).toBe(422)
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
