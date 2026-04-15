import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// AskClaudeLink fetches /api/watched-titles on mount
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

import { PlexSyncButton } from '@/components/sidebar-utils'

describe('PlexSyncButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders in idle state', () => {
    render(<PlexSyncButton />)
    expect(screen.getByText('🎭 Sync Plex')).toBeInTheDocument()
  })
})
