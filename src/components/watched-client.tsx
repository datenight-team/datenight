'use client'
import { useState } from 'react'
import { FilterBar } from './filter-bar'
import { MovieCard } from './movie-card'
import type { Movie, User } from '@/types'

const AGREEMENT_BUTTONS = [
  { label: '🤝 Agreed', value: 'agreed' },
  { label: '⚔️ Disagreed', value: 'disagreed' },
]

type AgreementFilter = 'agreed' | 'disagreed'

interface WatchedClientProps {
  movies: Movie[]
  userNames: Record<User, string>
}

export function WatchedClient({ movies, userNames }: WatchedClientProps) {
  const [search, setSearch] = useState('')
  const [activeAgreement, setActiveAgreement] = useState<AgreementFilter | null>(null)

  const lowerSearch = search.toLowerCase()
  const filteredMovies = movies.filter((m) => {
    if (!m.title.toLowerCase().includes(lowerSearch)) return false
    if (activeAgreement === null) return true
    const ratings = m.ratings ?? []
    if (ratings.length < 2) return false
    const agreed = ratings[0].rating === ratings[1].rating
    return activeAgreement === 'agreed' ? agreed : !agreed
  })

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        buttons={AGREEMENT_BUTTONS}
        activeButton={activeAgreement}
        onButtonChange={(v) => setActiveAgreement(v as AgreementFilter | null)}
      />

      {filteredMovies.length === 0 ? (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium">
            {search || activeAgreement ? 'No movies match your filter' : 'Nothing watched yet'}
          </p>
          <p className="text-sm text-amber-500 mt-1">
            {search || activeAgreement
              ? 'Try clearing the search or filter'
              : 'Your finished films will appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} userNames={userNames} />
          ))}
        </div>
      )}
    </>
  )
}
