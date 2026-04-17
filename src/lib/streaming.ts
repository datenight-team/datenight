// src/lib/streaming.ts
import { writeFile, access, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from './db'
import { getConfig } from './config'
import { fetchWatchProviders } from './tmdb'

const LOGOS_DIR = join(process.cwd(), 'public', 'streaming-logos')
const STALE_HOURS = 12

export async function downloadProviderLogo(providerId: number, logoPath: string): Promise<void> {
  await mkdir(LOGOS_DIR, { recursive: true })
  const filePath = join(LOGOS_DIR, `${providerId}.png`)
  try {
    await access(filePath)
    return
  } catch {
    // file does not exist — download it
  }
  try {
    const res = await fetch(`https://image.tmdb.org/t/p/w45${logoPath}`)
    if (!res.ok) return
    const buf = new Uint8Array(await res.arrayBuffer())
    await writeFile(filePath, buf)
  } catch (err) {
    console.warn(`[streaming] Failed to download logo for provider ${providerId}:`, err)
  }
}

export async function syncMovieProviders(movieId: number, tmdbId: number): Promise<void> {
  const { streamingRegion } = await getConfig()
  const region = streamingRegion || 'US'
  const now = new Date()

  const data = await fetchWatchProviders(tmdbId, region)

  if (!data) {
    await prisma.$transaction([
      prisma.streamingProvider.deleteMany({ where: { movieId } }),
      prisma.movie.update({
        where: { id: movieId },
        data: { streamingLastChecked: now, streamingLink: null },
      }),
    ])
    return
  }

  await Promise.all(
    data.flatrate.map((p) =>
      downloadProviderLogo(p.providerId, p.logoPath).catch(() => {})
    )
  )

  await prisma.streamingProvider.deleteMany({ where: { movieId } })
  if (data.flatrate.length > 0) {
    await prisma.streamingProvider.createMany({
      data: data.flatrate.map((p) => ({
        movieId,
        providerId: p.providerId,
        providerName: p.providerName,
      })),
    })
  }

  await prisma.movie.update({
    where: { id: movieId },
    data: { streamingLastChecked: now, streamingLink: data.link },
  })
}

export async function refreshStaleProviders(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)
  const movies = await prisma.movie.findMany({
    where: {
      status: 'watchlist',
      OR: [{ streamingLastChecked: null }, { streamingLastChecked: { lt: cutoff } }],
    },
    select: { id: true, tmdbId: true },
  })
  await Promise.all(
    movies.map((m) =>
      syncMovieProviders(m.id, m.tmdbId).catch((err) =>
        console.error(`[streaming] Error syncing movie ${m.id}:`, err)
      )
    )
  )
}

export function startStreamingRefreshJob(): void {
  import('node-cron').then(({ default: cron }) => {
    cron.schedule('0 */12 * * *', async () => {
      console.log('[streaming] Refreshing stale providers...')
      try {
        await refreshStaleProviders()
        console.log('[streaming] Done')
      } catch (err) {
        console.error('[streaming] Error:', err)
      }
    })
    console.log('[streaming] Refresh job started (every 12h)')
  }).catch((err) => {
    console.error('[streaming] Failed to start refresh job:', err)
  })
}
