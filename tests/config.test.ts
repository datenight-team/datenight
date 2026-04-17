// tests/config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    setting: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { getConfig } from '@/lib/config'

describe('getConfig', () => {
  beforeEach(() => {
    vi.mocked(prisma.setting.findMany).mockReset()
  })

  it('returns defaults when no settings exist', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])
    const config = await getConfig()
    expect(config.user1Name).toBe('User 1')
    expect(config.user2Name).toBe('User 2')
    expect(config.tmdbApiKey).toBe('')
    expect(config.seerrUrl).toBe('')
    expect(config.seerrPublicUrl).toBe('')
    expect(config.seerrApiKey).toBe('')
    expect(config.seerrConcurrency).toBe('')
    expect(config.plexUrl).toBe('')
    expect(config.plexToken).toBe('')
    expect(config.anthropicApiKey).toBe('')
  })

  it('returns stored values over defaults', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'user1_name', value: 'Ian' },
      { key: 'user2_name', value: 'Kate' },
      { key: 'tmdb_api_key', value: 'abc123' },
    ])
    const config = await getConfig()
    expect(config.user1Name).toBe('Ian')
    expect(config.user2Name).toBe('Kate')
    expect(config.tmdbApiKey).toBe('abc123')
    expect(config.plexUrl).toBe('')
  })

  it('ignores unknown keys', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'unknown_key', value: 'foo' },
    ])
    const config = await getConfig()
    expect(config.user1Name).toBe('User 1')
  })

  it('returns streaming defaults when no settings exist', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])
    const config = await getConfig()
    expect(config.streamingRegion).toBe('US')
    expect(config.streamingServices).toBe('[]')
  })

  it('maps all twelve DB keys to AppConfig fields', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { key: 'user1_name', value: 'A' },
      { key: 'user2_name', value: 'B' },
      { key: 'tmdb_api_key', value: 'C' },
      { key: 'seerr_url', value: 'D' },
      { key: 'seerr_public_url', value: 'E' },
      { key: 'seerr_api_key', value: 'F' },
      { key: 'seerr_concurrency', value: '5' },
      { key: 'plex_url', value: 'G' },
      { key: 'plex_token', value: 'H' },
      { key: 'anthropic_api_key', value: 'I' },
      { key: 'streaming_region', value: 'GB' },
      { key: 'streaming_services', value: '[8,337]' },
    ])
    const config = await getConfig()
    expect(config.user1Name).toBe('A')
    expect(config.user2Name).toBe('B')
    expect(config.tmdbApiKey).toBe('C')
    expect(config.seerrUrl).toBe('D')
    expect(config.seerrPublicUrl).toBe('E')
    expect(config.seerrApiKey).toBe('F')
    expect(config.seerrConcurrency).toBe('5')
    expect(config.plexUrl).toBe('G')
    expect(config.plexToken).toBe('H')
    expect(config.anthropicApiKey).toBe('I')
    expect(config.streamingRegion).toBe('GB')
    expect(config.streamingServices).toBe('[8,337]')
  })
})
