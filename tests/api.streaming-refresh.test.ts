// tests/api.streaming-refresh.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/streaming', () => ({
  refreshStaleProviders: vi.fn(),
}))

import { refreshStaleProviders } from '@/lib/streaming'
import { POST } from '@/app/api/streaming-providers/refresh/route'

describe('POST /api/streaming-providers/refresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls refreshStaleProviders and returns ok', async () => {
    vi.mocked(refreshStaleProviders).mockResolvedValue(undefined)

    const res = await POST()

    expect(refreshStaleProviders).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('returns 500 when refreshStaleProviders throws', async () => {
    vi.mocked(refreshStaleProviders).mockRejectedValue(new Error('TMDB down'))

    const res = await POST()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})
