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

  it('does not include Settings in the bottom nav tabs', () => {
    render(<MobileBottomNav />)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('highlights the active tab', () => {
    render(<MobileBottomNav />)
    const listLink = screen.getByRole('link', { name: /list/i })
    expect(listLink).toHaveClass('text-amber-600')
    const iconSpan = listLink.querySelector('span')
    expect(iconSpan).toHaveClass('bg-amber-600')
    const watchedLink = screen.getByRole('link', { name: /watched/i })
    expect(watchedLink).not.toHaveClass('text-amber-600')
    const inactiveIconSpan = watchedLink.querySelector('span')
    expect(inactiveIconSpan).not.toHaveClass('bg-amber-600')
  })

  it('applies bold font weight to the active tab label', () => {
    render(<MobileBottomNav />)
    const listLink = screen.getByRole('link', { name: /list/i })
    const spans = listLink.querySelectorAll('span')
    const labelSpan = spans[spans.length - 1]
    expect(labelSpan).toHaveClass('font-bold')
  })

  it('wraps tab emoji icons with aria-hidden', () => {
    render(<MobileBottomNav />)
    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      const iconSpan = link.querySelector('span[aria-hidden="true"]')
      expect(iconSpan).not.toBeNull()
    })
  })
})
