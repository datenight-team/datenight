'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Film, Clapperboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MoviePreview } from '@/types'
import { formatRuntime } from '@/lib/utils'

export default function AddMoviePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<MoviePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePreview = async () => {
    setError(null)
    setPreview(null)
    setLoading(true)
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Failed to look up movie')
        return
      }
      setPreview(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      })
      if (!res.ok) {
        setError('Failed to add movie')
        return
      }
      router.push('/watchlist')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Add a Movie</h1>

      <div className="flex gap-2 mb-2">
        <Input
          placeholder="Paste an IMDB or Criterion URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
          inputMode="url"
        />
        <Button
          onClick={handlePreview}
          disabled={!url.trim() || loading}
          className="shrink-0"
        >
          {loading ? '…' : 'Preview'}
        </Button>
      </div>

      {error && (
        <p className="text-destructive text-sm mb-4">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Supports imdb.com/title/... and criterion.com/films/... URLs
      </p>

      <div className="flex gap-4 text-xs text-muted-foreground mb-6">
        <a
          href="https://www.criterion.com/shop/browse/list?q=&format=all"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-primary underline transition-colors"
        >
          <Film className="w-3 h-3" aria-hidden="true" /> Browse Criterion
        </a>
        <a
          href="https://www.imdb.com/search/title/?title_type=feature"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-primary underline transition-colors"
        >
          <Clapperboard className="w-3 h-3" aria-hidden="true" /> Browse IMDB
        </a>
      </div>

      {preview && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex gap-4">
            {preview.posterUrl && (
              <Image
                src={preview.posterUrl}
                alt={preview.title}
                width={80}
                height={120}
                className="rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-foreground text-lg leading-tight">{preview.title}</h2>
              <p className="text-muted-foreground text-sm mb-2">
                {preview.year} · {formatRuntime(preview.runtime)}
              </p>
              <p className="text-muted-foreground text-sm line-clamp-3">{preview.description}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPreview(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving}
            >
              {saving ? 'Adding…' : 'Add to List'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
