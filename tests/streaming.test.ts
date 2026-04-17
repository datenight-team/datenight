// tests/streaming.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mkdir, access, writeFile } = vi.hoisted(() => ({
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  mkdir,
  access,
  writeFile,
  default: { mkdir, access, writeFile },
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    movie: { update: vi.fn(), findMany: vi.fn() },
    streamingProvider: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}))

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(),
}))

vi.mock('@/lib/tmdb', () => ({
  fetchWatchProviders: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// mkdir, access, writeFile are imported via vi.hoisted above
import { prisma } from '@/lib/db'
import { getConfig } from '@/lib/config'
import { fetchWatchProviders } from '@/lib/tmdb'
import { downloadProviderLogo, syncMovieProviders, refreshStaleProviders } from '@/lib/streaming'

const mockConfig = {
  streamingRegion: 'US',
  streamingServices: '[8]',
  user1Name: 'User 1', user2Name: 'User 2',
  tmdbApiKey: 'test-key', seerrUrl: '', seerrPublicUrl: '', seerrApiKey: '',
  seerrConcurrency: '', plexUrl: '', plexToken: '', anthropicApiKey: '',
}

describe('downloadProviderLogo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(writeFile).mockResolvedValue(undefined as any)
  })

  it('skips download when file already exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined as any)
    await downloadProviderLogo(8, '/netflix.jpg')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('downloads and writes file when it does not exist', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    })
    await downloadProviderLogo(8, '/netflix.jpg')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('image.tmdb.org')
    )
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('8.png'),
      expect.any(Uint8Array)
    )
  })

  it('does not throw when download fetch fails', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    mockFetch.mockResolvedValue({ ok: false })
    await expect(downloadProviderLogo(8, '/netflix.jpg')).resolves.not.toThrow()
  })
})

describe('syncMovieProviders', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(writeFile).mockResolvedValue(undefined as any)
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    mockFetch.mockResolvedValue({ ok: false })
  })

  it('clears existing providers and updates streamingLastChecked when TMDB returns no data', async () => {
    vi.mocked(fetchWatchProviders).mockResolvedValue(null)
    vi.mocked(prisma.streamingProvider.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await syncMovieProviders(1, 345911)

    expect(prisma.streamingProvider.deleteMany).toHaveBeenCalledWith({ where: { movieId: 1 } })
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { streamingLastChecked: expect.any(Date), streamingLink: null },
    })
  })

  it('deletes old providers and inserts fresh ones when TMDB returns data', async () => {
    vi.mocked(fetchWatchProviders).mockResolvedValue({
      link: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
      flatrate: [{ providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg' }],
    })
    vi.mocked(prisma.streamingProvider.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.streamingProvider.createMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await syncMovieProviders(1, 345911)

    expect(prisma.streamingProvider.deleteMany).toHaveBeenCalledWith({ where: { movieId: 1 } })
    expect(prisma.streamingProvider.createMany).toHaveBeenCalledWith({
      data: [{ movieId: 1, providerId: 8, providerName: 'Netflix' }],
    })
    expect(prisma.movie.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        streamingLastChecked: expect.any(Date),
        streamingLink: 'https://www.themoviedb.org/movie/345911/watch?locale=US',
      },
    })
  })

  it('skips createMany when flatrate list is empty', async () => {
    vi.mocked(fetchWatchProviders).mockResolvedValue({ link: 'https://tmdb.org', flatrate: [] })
    vi.mocked(prisma.streamingProvider.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await syncMovieProviders(1, 345911)

    expect(prisma.streamingProvider.deleteMany).toHaveBeenCalled()
    expect(prisma.streamingProvider.createMany).not.toHaveBeenCalled()
  })
})

describe('refreshStaleProviders', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getConfig).mockResolvedValue(mockConfig)
  })

  it('queries movies with null or stale streamingLastChecked', async () => {
    vi.mocked(prisma.movie.findMany).mockResolvedValue([])

    await refreshStaleProviders()

    expect(prisma.movie.findMany).toHaveBeenCalledWith({
      where: {
        status: 'watchlist',
        OR: [
          { streamingLastChecked: null },
          { streamingLastChecked: { lt: expect.any(Date) } },
        ],
      },
      select: { id: true, tmdbId: true },
    })
  })

  it('calls syncMovieProviders for each stale movie', async () => {
    vi.mocked(prisma.movie.findMany).mockResolvedValue([
      { id: 1, tmdbId: 345911 },
      { id: 2, tmdbId: 11216 },
    ] as any)
    vi.mocked(fetchWatchProviders).mockResolvedValue(null)
    vi.mocked(prisma.movie.update).mockResolvedValue({} as any)

    await refreshStaleProviders()

    expect(prisma.movie.update).toHaveBeenCalledTimes(2)
  })
})
