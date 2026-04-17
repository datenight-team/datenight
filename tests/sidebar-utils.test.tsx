import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// AskClaudeLink fetches /api/watched-titles on mount
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

import { PlexSyncButton, StreamingRefreshButton } from '@/components/sidebar-utils'

describe('PlexSyncButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders in idle state', () => {
    render(<PlexSyncButton />)
    expect(screen.getByText('🎭 Sync Plex')).toBeInTheDocument()
  })
})

describe('StreamingRefreshButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders in idle state', () => {
    render(<StreamingRefreshButton />)
    expect(screen.getByText('📡 Refresh Streaming')).toBeInTheDocument()
  })

  it('posts to /api/streaming-providers/refresh on click', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any)
    render(<StreamingRefreshButton />)
    fireEvent.click(screen.getByText('📡 Refresh Streaming'))
    expect(global.fetch).toHaveBeenCalledWith('/api/streaming-providers/refresh', { method: 'POST' })
  })

  it('shows success state after refresh completes', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any)
    render(<StreamingRefreshButton />)
    fireEvent.click(screen.getByText('📡 Refresh Streaming'))
    await waitFor(() => expect(screen.getByText('✅ Refreshed!')).toBeInTheDocument())
  })

  it('dispatches streaming-refreshed event on success', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any)
    const listener = vi.fn()
    window.addEventListener('streaming-refreshed', listener)
    render(<StreamingRefreshButton />)
    fireEvent.click(screen.getByText('📡 Refresh Streaming'))
    await waitFor(() => expect(listener).toHaveBeenCalled())
    window.removeEventListener('streaming-refreshed', listener)
  })

  it('shows error state when refresh fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false } as any)
    render(<StreamingRefreshButton />)
    fireEvent.click(screen.getByText('📡 Refresh Streaming'))
    await waitFor(() => expect(screen.getByText('❌ Failed')).toBeInTheDocument())
  })
})
