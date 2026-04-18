// tests/sidebar.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/watchlist',
}))

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
}))

import { Sidebar } from '@/components/sidebar'

describe('Sidebar', () => {
  it('renders primary nav links', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /watch list/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /watched/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add movie/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /recommend/i })).toBeInTheDocument()
  })

  it('does not render Browse Criterion or Browse IMDB in the utility footer', () => {
    render(<Sidebar />)
    expect(screen.queryByText(/browse criterion/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/browse imdb/i)).not.toBeInTheDocument()
  })

  it('wraps nav emoji icons with aria-hidden', () => {
    render(<Sidebar />)
    const navLinks = screen.getAllByRole('link')
    navLinks.forEach((link) => {
      const iconSpan = link.querySelector('span[aria-hidden="true"]')
      expect(iconSpan).not.toBeNull()
    })
  })
})
