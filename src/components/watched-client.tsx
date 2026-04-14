'use client'
import { useState } from 'react'
import { FilterBar } from './filter-bar'
import { MovieCard } from './movie-card'
import type { Movie, User } from '@/types'

type ActiveFilter = 'agreed' | 'disagreed' | 'needs_user1' | 'needs_user2'

interface WatchedClientProps {
  movies: Movie[]
  userNames: Record<User, string>
  seerrUrl?: string | null
}

export function WatchedClient({ movies, userNames, seerrUrl }: WatchedClientProps) {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null)

  const buttons = [
    { label: '🤝 Agreed',                       value: 'agreed' },
    { label: '⚔️ Disagreed',                    value: 'disagreed' },
    { label: `📋 Needs ${userNames.user1}`,      value: 'needs_user1' },
    { label: `📋 Needs ${userNames.user2}`,      value: 'needs_user2' },
  ]

  const lowerSearch = search.toLowerCase()
  const filteredMovies = movies.filter((m) => {
    if (!m.title.toLowerCase().includes(lowerSearch)) return false
    if (activeFilter === null) return true
    const ratings = m.ratings ?? []
    if (activeFilter === 'needs_user1') return !ratings.some((r) => r.user === 'user1')
    if (activeFilter === 'needs_user2') return !ratings.some((r) => r.user === 'user2')
    if (ratings.length < 2) return false
    const agreed = ratings[0].rating === ratings[1].rating
    return activeFilter === 'agreed' ? agreed : !agreed
  })

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        buttons={buttons}
        activeButton={activeFilter}
        onButtonChange={(v) => setActiveFilter(v as ActiveFilter | null)}
      />

      {filteredMovies.length === 0 ? (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium">
            {search || activeFilter ? 'No movies match your filter' : 'Nothing watched yet'}
          </p>
          <p className="text-sm text-amber-500 mt-1">
            {search || activeFilter
              ? 'Try clearing the search or filter'
              : 'Your finished films will appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} userNames={userNames} seerrUrl={seerrUrl} />
          ))}
        </div>
      )}
    </>
  )
}
