import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditRatingDialog } from '@/components/edit-rating-dialog'
import type { Movie, User, Rating } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

function makeMovie(): Movie {
  return {
    id: 1,
    title: 'Seven Samurai',
    year: 1954,
    runtime: 207,
    description: '',
    posterUrl: '',
    imdbId: 'tt0047478',
    tmdbId: 345911,
    criterionUrl: null,
    imdbUrl: null,
    sortOrder: 1,
    status: 'watched',
    seerrRequestId: null,
    seerrMediaId: null,
    seerrStatus: 'available',
    watchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ratings: [],
  }
}

function makeRatings(): Rating[] {
  return [
    { id: 1, movieId: 1, user: 'user1', rating: 'up', quote: 'A masterwork', submittedAt: new Date().toISOString() },
    { id: 2, movieId: 1, user: 'user2', rating: 'down', quote: 'Not for me', submittedAt: new Date().toISOString() },
  ]
}

describe('EditRatingDialog', () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    onClose.mockReset()
    onSaved.mockReset()
  })

  it('renders with pre-filled rating and quote', () => {
    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    expect(screen.getByText('Seven Samurai')).toBeInTheDocument()
    expect(screen.getByText("Alice's verdict")).toBeInTheDocument()
    expect(screen.getByDisplayValue('A masterwork')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thumbs up' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables Save Changes when quote is cleared', () => {
    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('calls PATCH /api/ratings and onSaved on successful save', async () => {
    const updatedRatings = makeRatings()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ratings: updatedRatings }) })

    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedRatings))
    expect(mockFetch).toHaveBeenCalledWith('/api/ratings', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ movieId: 1, user: 'user1', rating: 'up', quote: 'A masterwork' }),
    }))
  })

  it('shows error message on failed save', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })

    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(screen.getByText('Save failed — please try again.')).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <EditRatingDialog
        movie={makeMovie()}
        user="user1"
        existingRating="up"
        existingQuote="A masterwork"
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        userNames={userNames}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
