// tests/rating-dialog.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RatingDialog } from '@/components/rating-dialog'
import type { Movie, User } from '@/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const userNames: Record<User, string> = { user1: 'Alice', user2: 'Bob' }

const movie: Movie = {
  id: 1,
  title: 'Beau Travail',
  year: 1999,
  runtime: 93,
  description: '',
  posterUrl: '',
  imdbId: 'tt0165227',
  tmdbId: 10066,
  criterionUrl: null,
  imdbUrl: null,
  sortOrder: 1,
  status: 'watchlist',
  seerrRequestId: null,
  seerrMediaId: null,
  seerrStatus: 'not_requested',
  watchedAt: null,
  createdAt: new Date().toISOString(),
  streamingLastChecked: null,
  streamingLink: null,
  ratings: [],
  streamingProviders: [],
}

async function advanceToFormStep() {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  fireEvent.click(screen.getByText('Alice'))
  await waitFor(() => expect(screen.getByText(/Alice's verdict/)).toBeInTheDocument())
}

describe('RatingDialog required field indication', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    render(
      <RatingDialog
        movie={movie}
        open={true}
        userNames={userNames}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    )
  })

  it("shows an asterisk on the Critic's Quote label", async () => {
    await advanceToFormStep()
    expect(screen.getByText("Critic's Quote")).toBeInTheDocument()
    const label = screen.getByText("Critic's Quote").closest('p') ?? screen.getByText("Critic's Quote").parentElement
    expect(label?.textContent).toContain('*')
  })

  it('disables Submit when neither verdict nor quote is filled', async () => {
    await advanceToFormStep()
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('keeps Submit disabled when only quote is filled', async () => {
    await advanceToFormStep()
    fireEvent.change(screen.getByPlaceholderText(/a sentence or two/i), {
      target: { value: 'A great film.' },
    })
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('enables Submit when both verdict and quote are filled', async () => {
    await advanceToFormStep()
    fireEvent.click(screen.getByLabelText(/thumbs up/i))
    fireEvent.change(screen.getByPlaceholderText(/a sentence or two/i), {
      target: { value: 'Magnificent.' },
    })
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled()
  })
})
