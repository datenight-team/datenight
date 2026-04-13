// src/app/watchlist/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { MovieRow } from '@/components/movie-row'
import { RatingDialog } from '@/components/rating-dialog'
import { FilterBar } from '@/components/filter-bar'
import type { Movie, User, SeerrStatus } from '@/types'

// 'deleted' is intentionally omitted — it's a transient Seerr state with no
// useful filter action for the user on the watchlist.
const STATUS_BUTTONS = [
  { label: 'Not Requested', value: 'not_requested' },
  { label: 'Queued', value: 'pending' },
  { label: 'Downloading', value: 'processing' },
  { label: 'Ready', value: 'available' },
]

const STATUS_ORDER: Record<string, number> = {
  available: 0,
  processing: 1,
  pending: 2,
  not_requested: 3,
}

function sortByStatus(movies: Movie[]): Movie[] {
  return [...movies].sort(
    (a, b) =>
      (STATUS_ORDER[a.seerrStatus] ?? 99) - (STATUS_ORDER[b.seerrStatus] ?? 99)
  )
}

export default function WatchlistPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null)
  const [userNames, setUserNames] = useState<Record<User, string>>({ user1: 'User 1', user2: 'User 2' })
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState<SeerrStatus | null>(null)

  const fetchMovies = useCallback(async () => {
    const data = await fetch('/api/movies').then((r) => r.json())
    setMovies(sortByStatus(data))
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const [moviesData, namesData] = await Promise.all([
          fetch('/api/movies', { signal: controller.signal }).then((r) => r.json()),
          fetch('/api/user-names', { signal: controller.signal }).then((r) => r.json()),
        ])
        setMovies(sortByStatus(moviesData))
        setUserNames(namesData)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        throw err
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  const lowerSearch = search.toLowerCase()
  const filteredMovies = movies.filter(
    (m) =>
      m.title.toLowerCase().includes(lowerSearch) &&
      (activeStatus === null || m.seerrStatus === activeStatus)
  )

  const handleForceDownload = async (movieId: number) => {
    await fetch(`/api/movies/${movieId}/download`, { method: 'POST' })
    fetchMovies()
  }

  const handleRemove = async (movieId: number, opts: { seerr: boolean }) => {
    setMovies((prev) => prev.filter((m) => m.id !== movieId))
    if (opts.seerr) {
      await fetch(`/api/movies/${movieId}/seerr`, { method: 'DELETE' })
    }
    await fetch(`/api/movies/${movieId}`, { method: 'DELETE' })
  }

  const readyCount = movies.filter((m) => m.seerrStatus === 'available').length

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-amber-900">Up Next</h1>
        {!loading && (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 rounded-full">
            {movies.length} movies · {readyCount} ready
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white border border-amber-100 rounded-xl px-4 py-3 animate-pulse"
            >
              <div className="w-5 h-5 bg-amber-100 rounded" />
              <div className="w-9 h-14 bg-amber-100 rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-amber-100 rounded w-2/3" />
                <div className="h-2 bg-amber-50 rounded w-1/3" />
              </div>
              <div className="w-16 h-5 bg-amber-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            buttons={STATUS_BUTTONS}
            activeButton={activeStatus}
            onButtonChange={(v) => setActiveStatus(v as SeerrStatus | null)}
          />

          <div>
            {filteredMovies.map((movie, index) => (
              <MovieRow
                key={movie.id}
                movie={movie}
                position={index + 1}
                onMarkWatched={setRatingTarget}
                onForceDownload={handleForceDownload}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {filteredMovies.length === 0 && (
            <div className="text-center text-amber-600 mt-16">
              <div className="text-5xl mb-4">🎬</div>
              <p className="font-medium">{search || activeStatus ? 'No movies match your filter' : 'No movies yet'}</p>
              <p className="text-sm text-amber-500 mt-1">
                {search || activeStatus ? 'Try clearing the search or filter' : 'Add some from the sidebar'}
              </p>
            </div>
          )}
        </>
      )}

      {ratingTarget && (
        <RatingDialog
          movie={ratingTarget}
          open={true}
          userNames={userNames}
          onClose={() => setRatingTarget(null)}
          onComplete={() => {
            setRatingTarget(null)
            fetchMovies()
          }}
        />
      )}
    </div>
  )
}
