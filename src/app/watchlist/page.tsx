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
import type { Movie } from '@/types'

export default function WatchlistPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null)

  const fetchMovies = useCallback(async () => {
    const data = await fetch('/api/movies').then((r) => r.json())
    setMovies(data)
  }, [])

  useEffect(() => { fetchMovies() }, [fetchMovies])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = movies.findIndex((m) => m.id === active.id)
    const newIndex = movies.findIndex((m) => m.id === over.id)

    // Optimistic update
    setMovies(arrayMove(movies, oldIndex, newIndex))

    await fetch(`/api/movies/${active.id}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newIndex }),
    })

    // Re-fetch authoritative order
    fetchMovies()
  }

  const handleForceDownload = async (movieId: number) => {
    await fetch(`/api/movies/${movieId}/download`, { method: 'POST' })
    fetchMovies()
  }

  const readyCount = movies.filter((m) => m.seerrStatus === 'available').length

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-amber-900">Up Next</h1>
        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 rounded-full">
          {movies.length} movies · {readyCount} ready
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={movies.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {movies.map((movie, index) => (
            <MovieRow
              key={movie.id}
              movie={movie}
              position={index + 1}
              onMarkWatched={setRatingTarget}
              onForceDownload={handleForceDownload}
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

      {ratingTarget && (
        <RatingDialog
          movie={ratingTarget}
          open={true}
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
