// tests/api.movies.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    movie: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))
vi.mock('@/lib/seerr', () => ({ requestMovie: vi.fn(), deleteMedia: vi.fn(), deleteFromService: vi.fn() }))

import { prisma } from '@/lib/db'
import { GET, POST } from '@/app/api/movies/route'
import { DELETE } from '@/app/api/movies/[id]/route'
import { PATCH } from '@/app/api/movies/[id]/reorder/route'
import { POST as POST_DOWNLOAD } from '@/app/api/movies/[id]/download/route'
import { DELETE as DELETE_SEERR } from '@/app/api/movies/[id]/seerr/route'
import * as seerr from '@/lib/seerr'

const movie = {
  id: 1, title: 'Seven Samurai', year: 1954, runtime: 207,
  description: 'A poor village...', posterUrl: 'https://img/p.jpg',
  imdbId: 'tt0047478', tmdbId: 345911, criterionUrl: null, imdbUrl: null,
  sortOrder: 1, status: 'watchlist', seerrRequestId: null, seerrMediaId: null,
  seerrStatus: 'not_requested', watchedAt: null,
  createdAt: new Date(), ratings: [],
}

describe('GET /api/movies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns watchlist movies sorted by sortOrder', async () => {
    vi.mocked(prisma.movie.findMany).mockResolvedValue([movie] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe('Seven Samurai')
  })
})

describe('POST /api/movies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a movie at the end of the list', async () => {
    vi.mocked(prisma.movie.aggregate).mockResolvedValue({ _max: { sortOrder: 2 } } as any)
    vi.mocked(prisma.movie.create).mockResolvedValue({ ...movie, sortOrder: 3 } as any)
    const req = new Request('http://localhost/api/movies', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Seven Samurai', year: 1954, runtime: 207,
        description: 'A poor village...', posterUrl: 'https://img/p.jpg',
        imdbId: 'tt0047478', tmdbId: 345911,
        imdbUrl: 'https://www.imdb.com/title/tt0047478/',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.movie.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 3 }) })
    )
  })
})

describe('DELETE /api/movies/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the movie', async () => {
    vi.mocked(prisma.movie.delete).mockResolvedValue(movie as any)
    const req = new Request('http://localhost/api/movies/1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: '1' } })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/movies/[id]/reorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates sort orders for all movies', async () => {
    vi.mocked(prisma.movie.findMany).mockResolvedValue([
      { ...movie, id: 1, sortOrder: 1 },
      { ...movie, id: 2, sortOrder: 2 },
      { ...movie, id: 3, sortOrder: 3 },
    ] as any)
    vi.mocked(prisma.movie.update).mockResolvedValue(movie as any)

    const req = new Request('http://localhost/api/movies/1/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ newIndex: 2 }), // move id=1 to position 2 (0-indexed)
    })
    const res = await PATCH(req, { params: { id: '1' } })
    expect(res.status).toBe(200)
    expect(prisma.movie.update).toHaveBeenCalledTimes(3)
  })
})

describe('POST /api/movies/[id]/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits a Seerr request and updates the movie', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue(movie as any)
    vi.mocked(seerr.requestMovie).mockResolvedValue({ requestId: '99' })
    vi.mocked(prisma.movie.update).mockResolvedValue(movie as any)

    const req = new Request('http://localhost/api/movies/1/download', { method: 'POST' })
    const res = await POST_DOWNLOAD(req, { params: { id: '1' } })
    expect(res.status).toBe(200)
    expect(seerr.requestMovie).toHaveBeenCalledWith(345911)
  })
})

describe('DELETE /api/movies/[id]/seerr', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when movie not found', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue(null)
    const req = new Request('http://localhost/api/movies/1/seerr', { method: 'DELETE' })
    const res = await DELETE_SEERR(req, { params: { id: '1' } } as any)
    expect(res.status).toBe(404)
  })

  it('returns 400 when seerrMediaId is null', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue({ ...movie, seerrMediaId: null } as any)
    const req = new Request('http://localhost/api/movies/1/seerr', { method: 'DELETE' })
    const res = await DELETE_SEERR(req, { params: { id: '1' } } as any)
    expect(res.status).toBe(400)
  })

  it('returns { ok: true } when Seerr deletion succeeds', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue({ ...movie, seerrMediaId: '42' } as any)
    vi.mocked(seerr.deleteMedia).mockResolvedValue(true)
    const req = new Request('http://localhost/api/movies/1/seerr', { method: 'DELETE' })
    const res = await DELETE_SEERR(req, { params: { id: '1' } } as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(seerr.deleteMedia).toHaveBeenCalledWith(42)
  })

  it('returns { ok: false } when Seerr deletion fails', async () => {
    vi.mocked(prisma.movie.findUnique).mockResolvedValue({ ...movie, seerrMediaId: '42' } as any)
    vi.mocked(seerr.deleteMedia).mockResolvedValue(false)
    const req = new Request('http://localhost/api/movies/1/seerr', { method: 'DELETE' })
    const res = await DELETE_SEERR(req, { params: { id: '1' } } as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false })
  })
})
