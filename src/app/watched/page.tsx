// src/app/watched/page.tsx
import { prisma } from '@/lib/db'
import { getUserNames } from '@/lib/users'
import { WatchedClient } from '@/components/watched-client'
import type { Movie } from '@/types'

export const dynamic = 'force-dynamic'

export default async function WatchedPage() {
  const [movies, userNames] = await Promise.all([
    prisma.movie.findMany({
      where: { status: 'watched' },
      orderBy: { watchedAt: 'desc' },
      include: { ratings: true },
    }),
    Promise.resolve(getUserNames()),
  ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Watched</h1>
      <WatchedClient movies={movies as unknown as Movie[]} userNames={userNames} />
    </div>
  )
}
