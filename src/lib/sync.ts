// src/lib/sync.ts
import { prisma } from './db'
import { getMovieStatus, requestMovie } from './seerr'
import { syncDateNightPlaylist } from './plex'

const TOP_N = 10

export async function runSync(): Promise<void> {
  const watchlist = await prisma.movie.findMany({
    where: { status: 'watchlist' },
    orderBy: { sortOrder: 'asc' },
    take: TOP_N,
  })

  for (const movie of watchlist) {
    if (!movie.seerrRequestId) {
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
    } else {
      const { status, seerrMediaId } = await getMovieStatus(movie.tmdbId)
      await prisma.movie.update({
        where: { id: movie.id },
        data: {
          seerrStatus: status,
          ...(seerrMediaId !== undefined ? { seerrMediaId: seerrMediaId as unknown as string } : {}),
        },
      })
    }
  }

  const available = await prisma.movie.findMany({
    where: { status: 'watchlist', seerrStatus: 'available' },
    orderBy: { sortOrder: 'asc' },
  })

  await syncDateNightPlaylist(available.map((m) => ({ imdbId: m.imdbId })))
}

export function startSyncJob(): void {
  // Dynamically import node-cron to avoid loading it in tests
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
