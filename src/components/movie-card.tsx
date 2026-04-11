// src/components/movie-card.tsx
import Image from 'next/image'
import { StarRating } from './star-rating'
import type { Movie, Rating, User } from '@/types'

interface MovieCardProps {
  movie: Movie
  userNames: Record<User, string>
}

export function MovieCard({ movie, userNames }: MovieCardProps) {
  const ratings = movie.ratings ?? []
  const bothRated = ratings.length === 2

  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] bg-amber-100">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-4xl">🎥</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-bold text-stone-900 text-sm leading-tight mb-0.5">{movie.title}</h3>
        <p className="text-stone-400 text-xs mb-3">{movie.year}</p>

        {bothRated ? (
          <div className="space-y-2">
            {ratings.map((r: Rating) => (
              <div key={r.user} className="bg-amber-50 rounded-lg p-2">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-semibold text-amber-900">{userNames[r.user as User]}</span>
                  <StarRating value={r.stars} readonly size="sm" />
                </div>
                <p className="text-xs text-stone-500 italic line-clamp-2">&ldquo;{r.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic text-center py-2">
            Waiting for both ratings…
          </p>
        )}
      </div>
    </div>
  )
}
