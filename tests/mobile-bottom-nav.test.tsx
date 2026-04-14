// tests/mobile-bottom-nav.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/watchlist',
}))

import { MobileBottomNav } from '@/components/mobile-bottom-nav'

describe('MobileBottomNav', () => {
  it('renders all four navigation tabs', () => {
    render(<MobileBottomNav />)
    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Watched')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Recs')).toBeInTheDocument()
  })

  it('links to the correct routes', () => {
    render(<MobileBottomNav />)
    expect(screen.getByRole('link', { name: /list/i })).toHaveAttribute('href', '/watchlist')
    expect(screen.getByRole('link', { name: /watched/i })).toHaveAttribute('href', '/watched')
    expect(screen.getByRole('link', { name: /add/i })).toHaveAttribute('href', '/add')
    expect(screen.getByRole('link', { name: /recs/i })).toHaveAttribute('href', '/recommendations')
  })

  it('highlights the active tab', () => {
    render(<MobileBottomNav />)
    // usePathname returns '/watchlist' — the List link should have the active colour
    const listLink = screen.getByRole('link', { name: /list/i })
    expect(listLink).toHaveClass('text-amber-600')
    // Active icon span gets the background pill
    const iconSpan = listLink.querySelector('span')
    expect(iconSpan).toHaveClass('bg-amber-100')
    // Inactive tabs should not have the active colour or pill
    const watchedLink = screen.getByRole('link', { name: /watched/i })
    expect(watchedLink).not.toHaveClass('text-amber-600')
    const inactiveIconSpan = watchedLink.querySelector('span')
    expect(inactiveIconSpan).not.toHaveClass('bg-amber-100')
  })
})
