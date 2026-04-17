// tests/api.settings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    setting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { GET, PUT } from '@/app/api/settings/route'

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.mocked(prisma.setting.findMany).mockReset()
  })

  it('returns all known keys as a flat object', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'user1_name', value: 'Ian' },
      { key: 'tmdb_api_key', value: 'abc123' },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user1_name).toBe('Ian')
    expect(data.tmdb_api_key).toBe('abc123')
    // Keys not in DB return empty string
    expect(data.user2_name).toBe('')
    expect(data.plex_url).toBe('')
  })

  it('returns empty strings for all keys when table is empty', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.user1_name).toBe('')
    expect(data.anthropic_api_key).toBe('')
  })
})

describe('PUT /api/settings', () => {
  beforeEach(() => {
    vi.mocked(prisma.setting.upsert).mockReset()
    vi.mocked(prisma.setting.upsert).mockResolvedValue({ key: '', value: '' })
  })

  it('upserts known keys and returns ok:true', async () => {
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user1_name: 'Ian', user2_name: 'Kate' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(vi.mocked(prisma.setting.upsert)).toHaveBeenCalledWith({
      where: { key: 'user1_name' },
      update: { value: 'Ian' },
      create: { key: 'user1_name', value: 'Ian' },
    })
    expect(vi.mocked(prisma.setting.upsert)).toHaveBeenCalledWith({
      where: { key: 'user2_name' },
      update: { value: 'Kate' },
      create: { key: 'user2_name', value: 'Kate' },
    })
  })

  it('silently skips unknown keys', async () => {
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_key: 'bad', user1_name: 'Ian' }),
    })
    await PUT(req)
    expect(vi.mocked(prisma.setting.upsert)).toHaveBeenCalledTimes(1)
  })

  it('returns 400 for non-JSON body', async () => {
    const req = new Request('http://localhost/api/settings', {
      method: 'PUT',
      body: 'not json',
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })
})
