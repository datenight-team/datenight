import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/watchlist',
}))

// PlexSyncButton fetches; AskClaudeLink fetches — stub both
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

import { MobileHeader } from '@/components/mobile-header'

describe('MobileHeader', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the app name', () => {
    render(<MobileHeader />)
    expect(screen.getByText('Date Night')).toBeInTheDocument()
  })

  it('opens the More sheet when the button is clicked', async () => {
    render(<MobileHeader />)
    fireEvent.click(screen.getByRole('button', { name: /more options/i }))
    await waitFor(() => {
      expect(screen.getByText('Browse Criterion')).toBeInTheDocument()
      expect(screen.getByText('Browse IMDB')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sync plex/i })).toBeInTheDocument()
      expect(screen.getByText(/ask claude/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    })
  })
})
