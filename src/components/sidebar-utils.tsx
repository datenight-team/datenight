// src/components/sidebar-utils.tsx
'use client'
import { useState, useEffect } from 'react'

export function PlexSyncButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/plex-sync', { method: 'POST' })
      setState(res.ok ? 'ok' : 'error')
    } catch {
      setState('error')
    } finally {
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label =
    state === 'loading' ? '⏳ Syncing…'
    : state === 'ok'    ? '✅ Synced!'
    : state === 'error' ? '❌ Failed'
    :                     '🎭 Sync Plex'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  )
}

export function StreamingRefreshButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/streaming-providers/refresh', { method: 'POST' })
      if (res.ok) {
        setState('ok')
        window.dispatchEvent(new CustomEvent('streaming-refreshed'))
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    } finally {
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label =
    state === 'loading' ? '⏳ Refreshing…'
    : state === 'ok'    ? '✅ Refreshed!'
    : state === 'error' ? '❌ Failed'
    :                     '📡 Refresh Streaming'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  )
}

export function AskClaudeLink() {
  const [href, setHref] = useState('https://claude.ai/')

  useEffect(() => {
    fetch('/api/watched-titles')
      .then((r) => r.json())
      .then((titles: Array<{ title: string; year: number }>) => {
        if (titles.length === 0) return
        const list = titles.map((t) => `- ${t.title} (${t.year})`).join('\n')
        const prompt = `We love Criterion Collection films. Here are the last ${titles.length} films we watched:\n${list}\n\nBased on these, can you recommend other Criterion Collection films we might enjoy?`
        setHref(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`)
      })
      .catch(() => {})
  }, [])

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
    >
      ✨ Ask Claude
    </a>
  )
}
