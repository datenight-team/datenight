// src/lib/tmdb.ts
import type { TmdbMovieDetails } from '@/types'

const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

function apiKey() {
  return process.env.TMDB_API_KEY ?? ''
}

async function fetchDetails(tmdbId: number): Promise<TmdbMovieDetails | null> {
  const res = await fetch(`${BASE}/movie/${tmdbId}?api_key=${apiKey()}`)
  if (!res.ok) return null
  const m = await res.json()
  return {
    id: m.id,
    title: m.title,
    year: parseInt((m.release_date ?? '0').split('-')[0], 10),
    runtime: m.runtime ?? 0,
    description: m.overview ?? '',
    posterUrl: m.poster_path ? `${IMG_BASE}${m.poster_path}` : '',
    imdbId: m.imdb_id ?? '',
  }
}

export async function findByImdbId(
  imdbId: string
): Promise<TmdbMovieDetails | null> {
  const res = await fetch(
    `${BASE}/find/${imdbId}?api_key=${apiKey()}&external_source=imdb_id`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.movie_results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id)
}

export async function searchByTitle(
  title: string
): Promise<TmdbMovieDetails | null> {
  const res = await fetch(
    `${BASE}/search/movie?api_key=${apiKey()}&query=${encodeURIComponent(title)}`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id)
}

export async function lookupCriterionSlug(
  slug: string
): Promise<TmdbMovieDetails | null> {
  const res = await fetch(`https://www.criterion.com/films/${slug}`)
  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(
    /<meta property="og:title" content="([^"]+)"/
  )
  if (!match) return null
  const title = match[1]
    .replace(/ \| The Criterion Collection$/, '')
    .trim()
  return searchByTitle(title)
}
