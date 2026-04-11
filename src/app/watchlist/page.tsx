// src/app/watchlist/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { MovieRow } from '@/components/movie-row'
import { RatingDialog } from '@/components/rating-dialog'
import type { Movie, User } from '@/types'

export default function WatchlistPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null)
  const [userNames, setUserNames] = useState<Record<User, string>>({ user1: 'User 1', user2: 'User 2' })

  const fetchMovies = useCallback(async () => {
    const data = await fetch('/api/movies').then((r) => r.json())
    setMovies(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMovies()
    fetch('/api/user-names')
      .then((r) => r.json())
      .then(setUserNames)
      .catch(() => {})
  }, [fetchMovies])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = movies.findIndex((m) => m.id === active.id)
    const newIndex = movies.findIndex((m) => m.id === over.id)

    setMovies(arrayMove(movies, oldIndex, newIndex))

    await fetch(`/api/movies/${active.id}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newIndex }),
    })

    fetchMovies()
  }

  const handleForceDownload = async (movieId: number) => {
    await fetch(`/api/movies/${movieId}/download`, { method: 'POST' })
    fetchMovies()
  }

  const handleRemove = async (movieId: number) => {
    setMovies((prev) => prev.filter((m) => m.id !== movieId))
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={movies.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              {movies.map((movie, index) => (
                <MovieRow
                  key={movie.id}
                  movie={movie}
                  position={index + 1}
                  onMarkWatched={setRatingTarget}
                  onForceDownload={handleForceDownload}
                  onRemove={handleRemove}
                />
              ))}
            </SortableContext>
          </DndContext>

          {movies.length === 0 && (
            <div className="text-center text-amber-600 mt-16">
              <div className="text-5xl mb-4">🎬</div>
              <p className="font-medium">No movies yet</p>
              <p className="text-sm text-amber-500 mt-1">Add some from the sidebar</p>
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
