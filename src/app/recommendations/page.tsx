// src/app/recommendations/page.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import type { RecommendationsResult, Recommendation } from '@/lib/recommendations'

const LOADING_MESSAGES = [
  'Analyzing your taste patterns…',
  'Consulting the cinema oracle…',
  'Scanning 120 years of film history…',
  'Finding your next obsession…',
  'Cross-referencing auteurs and movements…',
]

export default function RecommendationsPage() {
  const [criterionOnly, setCriterionOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [result, setResult] = useState<RecommendationsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGetRecommendations = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    // Rotate loading messages while waiting
    const interval = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length)
    }, 3500)

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterionOnly }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setResult(data)
      }
    } catch {
      setError('Failed to connect to the recommendations service')
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  const handleAdd = async (rec: Recommendation) => {
    if (!rec.tmdb) return
    await fetch('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: rec.tmdb.title,
        year: rec.tmdb.year,
        runtime: rec.tmdb.runtime,
        description: rec.tmdb.description,
        posterUrl: rec.tmdb.posterUrl,
        imdbId: rec.tmdb.imdbId,
        tmdbId: rec.tmdb.tmdbId,
      }),
    })
    // Refresh to show updated alreadyInList state
    if (result) {
      setResult({
        ...result,
        recommendations: result.recommendations.map((r) =>
          r.title === rec.title ? { ...r, alreadyInList: true } : r
        ),
      })
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-amber-900 mb-1">Recommendations</h1>
        <p className="text-sm text-stone-500">
          Claude analyzes what you both agreed on and suggests what to watch next.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setCriterionOnly(!criterionOnly)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              criterionOnly ? 'bg-amber-600' : 'bg-stone-200'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                criterionOnly ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className="text-sm text-stone-700">Criterion Collection only</span>
        </label>

        <Button
          onClick={handleGetRecommendations}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {loading ? 'Thinking…' : result ? 'Refresh' : 'Get Recommendations'}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-bounce">🎬</div>
          <p className="text-amber-700 font-medium animate-pulse">
            {LOADING_MESSAGES[loadingMsg]}
          </p>
          <p className="text-xs text-stone-400 mt-2">This takes 15–30 seconds</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          {/* Claude's reasoning */}
          {result.dataWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
              ℹ️ {result.dataWarning}
            </div>
          )}
          {result.reasoning && (
            <div className="bg-white border border-amber-100 rounded-xl p-4 mb-5 shadow-sm">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                Claude&apos;s Analysis
              </p>
              <p className="text-sm text-stone-600 italic">{result.reasoning}</p>
            </div>
          )}

          {/* Recommendation cards */}
          <div className="space-y-4">
            {result.recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                onAdd={() => handleAdd(rec)}
              />
            ))}
          </div>

          <p className="text-xs text-stone-400 text-center mt-6">
            Powered by Claude Opus · Based on {result.agreedCount} films you both agreed on
          </p>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">🎯</div>
          <p className="font-medium">Ready when you are</p>
          <p className="text-sm text-amber-500 mt-1">
            Rate a few films together first for the best results.
          </p>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({
  rec,
  onAdd,
}: {
  rec: Recommendation
  onAdd: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(rec.alreadyInList)

  const handleAdd = async () => {
    if (!rec.tmdb || added) return
    setAdding(true)
    await onAdd()
    setAdded(true)
    setAdding(false)
  }

  const isConsensus = rec.type === 'consensus'

  return (
    <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Poster */}
        <div className="w-16 h-24 bg-amber-100 rounded-lg flex-shrink-0 overflow-hidden">
          {rec.tmdb?.posterUrl ? (
            <Image
              src={rec.tmdb.posterUrl}
              alt={rec.title}
              width={64}
              height={96}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-300 text-2xl">
              🎥
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-bold text-stone-900 text-sm leading-tight">
                {rec.tmdb?.title ?? rec.title}
              </h3>
              <p className="text-stone-400 text-xs">
                {rec.year} · {rec.director}
                {rec.tmdb?.runtime ? ` · ${Math.floor(rec.tmdb.runtime / 60)}h ${rec.tmdb.runtime % 60}m` : ''}
              </p>
            </div>
            <span
              className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                isConsensus
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-violet-100 text-violet-700 border-violet-200'
              }`}
            >
              {isConsensus ? '🤝 Consensus' : '🃏 Wild Card'}
            </span>
          </div>

          <p className="text-stone-600 text-xs leading-relaxed mb-3">{rec.reason}</p>

          {/* Add button */}
          {rec.tmdb ? (
            added ? (
              <span className="text-xs text-stone-400">
                {rec.alreadyInList ? '✓ Already in your list' : '✓ Added to watchlist'}
              </span>
            ) : (
              <Button
                size="sm"
                className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleAdd}
                disabled={adding}
              >
                {adding ? 'Adding…' : '+ Add to Watchlist'}
              </Button>
            )
          ) : (
            <span className="text-xs text-stone-400 italic">
              Search on{' '}
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(rec.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-600"
              >
                IMDB
              </a>{' '}
              to add manually
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
