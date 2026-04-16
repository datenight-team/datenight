// src/lib/sync.ts
import { prisma } from './db'
import { getConfig } from './config'
import { getMovieStatus, requestMovie } from './seerr'
import { syncDateNightCollection } from './plex'

const TOP_N = 10

async function getConcurrencyLimit(): Promise<number | null> {
  const { seerrConcurrency } = await getConfig()
  if (!seerrConcurrency) return null
  return parseInt(seerrConcurrency, 10)
}

async function isRequestingAllowed(): Promise<boolean> {
  const limit = await getConcurrencyLimit()
  if (limit === null) return true
  if (limit === 0) return false
  const active = await prisma.movie.count({
    where: { seerrStatus: { in: ['pending', 'processing'] } },
  })
  return active < limit
}

export async function runSync(): Promise<void> {
  const canRequest = await isRequestingAllowed()

  if (canRequest) {
    const toRequest = await prisma.movie.findMany({
      where: { status: 'watchlist', seerrRequestId: null },
      orderBy: { sortOrder: 'asc' },
      take: TOP_N,
    })
    await Promise.all(
      toRequest.map(async (movie) => {
        const result = await requestMovie(movie.tmdbId)
        if (result) {
          await prisma.movie.update({
            where: { id: movie.id },
            data: {
              seerrRequestId: result.requestId,
              seerrMediaId: null,
              seerrStatus: 'pending',
            },
          })
        }
      })
    )
  }

  const requested = await prisma.movie.findMany({
    where: { status: 'watchlist', seerrRequestId: { not: null } },
  })
  await Promise.all(
    requested.map(async (movie) => {
      const { status, seerrMediaId } = await getMovieStatus(movie.tmdbId)
      await prisma.movie.update({
        where: { id: movie.id },
        data: {
          seerrStatus: status,
          ...(seerrMediaId !== undefined ? { seerrMediaId: String(seerrMediaId) } : {}),
        },
      })
    })
  )

  const available = await prisma.movie.findMany({
    where: { status: 'watchlist', seerrStatus: 'available' },
    orderBy: { sortOrder: 'asc' },
  })

  await syncDateNightCollection(available.map((m) => ({ title: m.title, year: m.year })))
}

export function startSyncJob(): void {
  import('node-cron').then(({ default: cron }) => {
    cron.schedule('*/5 * * * *', async () => {
      console.log('[sync] Running...')
      try {
        await runSync()
        console.log('[sync] Done')
      } catch (err) {
        console.error('[sync] Error:', err)
      }
    })
    console.log('[sync] Job started (every 5 min)')
  })
}
