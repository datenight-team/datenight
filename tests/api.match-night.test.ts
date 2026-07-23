// tests/api.match-night.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/match-night', () => ({
  getNextCandidateForUser: vi.fn(),
  recordSwipe: vi.fn(),
}))

import { getNextCandidateForUser, recordSwipe } from '@/lib/match-night'
import { GET } from '@/app/api/match-night/next/route'
import { POST } from '@/app/api/match-night/swipe/route'

describe('GET /api/match-night/next', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the next candidate for a valid user', async () => {
    vi.mocked(getNextCandidateForUser).mockResolvedValue({ id: 1, title: 'Seven Samurai' } as any)
    const req = new Request('http://localhost/api/match-night/next?user=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ candidate: { id: 1, title: 'Seven Samurai' } })
    expect(getNextCandidateForUser).toHaveBeenCalledWith('user1')
  })

  it('returns candidate: null when the deck is empty', async () => {
    vi.mocked(getNextCandidateForUser).mockResolvedValue(null)
    const req = new Request('http://localhost/api/match-night/next?user=user2')
    const res = await GET(req)
    expect(await res.json()).toEqual({ candidate: null })
  })

  it('returns 422 for a missing/invalid user', async () => {
    const req = new Request('http://localhost/api/match-night/next?user=nobody')
    const res = await GET(req)
    expect(res.status).toBe(422)
  })
})

describe('POST /api/match-night/swipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records a valid swipe', async () => {
    vi.mocked(recordSwipe).mockResolvedValue({ status: 'recorded' })
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'user1', vote: 'up' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'recorded' })
    expect(recordSwipe).toHaveBeenCalledWith(1, 'user1', 'up')
  })

  it('returns the matched movie payload on a match', async () => {
    vi.mocked(recordSwipe).mockResolvedValue({ status: 'matched', movie: { id: 10 } as any })
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'user2', vote: 'up' }),
    })
    const res = await POST(req)
    expect(await res.json()).toEqual({ status: 'matched', movie: { id: 10 } })
  })

  it('returns 422 for an invalid user', async () => {
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'nobody', vote: 'up' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns 422 for a missing candidateId', async () => {
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ user: 'user1', vote: 'up' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns 422 for an invalid vote value', async () => {
    const req = new Request('http://localhost/api/match-night/swipe', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 1, user: 'user1', vote: 'sideways' }),
    })
    expect((await POST(req)).status).toBe(422)
  })
})
