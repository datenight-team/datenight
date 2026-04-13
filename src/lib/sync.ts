// src/lib/sync.ts
import { prisma } from './db'
import { getMovieStatus, requestMovie } from './seerr'
import { syncDateNightCollection } from './plex'

const TOP_N = 10

function getConcurrencyLimit(): number | null {
  const raw = process.env.SEERR_CONCURRENCY
  if (raw === undefined || raw === '') return null
  return parseInt(raw, 10)
}

async function isRequestingAllowed(): Promise<boolean> {
  const limit = getConcurrencyLimit()
  if (limit === null) return true   // no limit set — original behaviour
  if (limit === 0) return false     // disabled
  const active = await prisma.movie.count({
    where: { seerrStatus: { in: ['pending', 'processing'] } },
  })
  return active < limit
}

export async function runSync(): Promise<void> {
  const canRequest = await isRequestingAllowed()

  // Auto-request the top N unwatched movies that haven't been requested yet
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

  // Update status for ALL watchlist movies that have been requested — no top-N
  // limit here so movies outside the top 10 still get their status refreshed.
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
