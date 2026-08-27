// src/components/sidebar-utils.tsx
'use client'
import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, Check, X, Radio, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  const content =
    state === 'loading' ? { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Syncing…' }
    : state === 'ok'    ? { icon: <Check className="w-3.5 h-3.5 text-success" />, text: 'Synced!' }
    : state === 'error' ? { icon: <X className="w-3.5 h-3.5 text-destructive" />, text: 'Failed' }
    :                     { icon: <RefreshCw className="w-3.5 h-3.5" />, text: 'Sync Plex' }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span aria-hidden="true" className="flex-shrink-0">{content.icon}</span>
      {content.text}
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

  const content =
    state === 'loading' ? { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Refreshing…' }
    : state === 'ok'    ? { icon: <Check className="w-3.5 h-3.5 text-success" />, text: 'Refreshed!' }
    : state === 'error' ? { icon: <X className="w-3.5 h-3.5 text-destructive" />, text: 'Failed' }
    :                     { icon: <Radio className="w-3.5 h-3.5" />, text: 'Refresh Streaming' }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span aria-hidden="true" className="flex-shrink-0">{content.icon}</span>
      {content.text}
    </button>
  )
}

export function AskClaudeLink({ className }: { className?: string }) {
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
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors',
        className
      )}
    >
      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Ask Claude
    </a>
  )
}
