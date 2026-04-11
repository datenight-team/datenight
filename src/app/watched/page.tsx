// src/app/watched/page.tsx
import { prisma } from '@/lib/db'
import { getUserNames } from '@/lib/users'
import { MovieCard } from '@/components/movie-card'
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

      {movies.length === 0 ? (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium">Nothing watched yet</p>
          <p className="text-sm text-amber-500 mt-1">Your finished films will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie as unknown as Movie} userNames={userNames} />
          ))}
        </div>
      )}
    </div>
  )
}
