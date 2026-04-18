// tests/add-page.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.stubGlobal('fetch', vi.fn())

import AddMoviePage from '@/app/add/page'

describe('AddMoviePage', () => {
  it('shows Browse Criterion and Browse IMDB helper links', () => {
    render(<AddMoviePage />)
    expect(screen.getByRole('link', { name: /browse criterion/i })).toHaveAttribute(
      'href',
      'https://www.criterion.com/shop/browse/list?q=&format=all'
    )
    expect(screen.getByRole('link', { name: /browse imdb/i })).toHaveAttribute(
      'href',
      'https://www.imdb.com/search/title/?title_type=feature'
    )
  })
})
