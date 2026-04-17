// src/lib/tmdb.ts
import type { TmdbMovieDetails } from '@/types'
import { getConfig } from './config'

const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

async function fetchDetails(tmdbId: number, key: string): Promise<TmdbMovieDetails | null> {
  const res = await fetch(`${BASE}/movie/${tmdbId}?api_key=${key}`)
  if (!res.ok) return null
  const m = await res.json()
  return {
    tmdbId: m.id,
    title: m.title,
    year: parseInt((m.release_date || '0').split('-')[0], 10) || 0,
    runtime: m.runtime ?? 0,
    description: m.overview ?? '',
    posterUrl: m.poster_path ? `${IMG_BASE}${m.poster_path}` : '',
    imdbId: m.imdb_id ?? '',
  }
}

export async function findByImdbId(
  imdbId: string
): Promise<TmdbMovieDetails | null> {
  const { tmdbApiKey } = await getConfig()
  const res = await fetch(
    `${BASE}/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.movie_results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id, tmdbApiKey)
}

export async function searchByTitle(
  title: string,
  year?: number
): Promise<TmdbMovieDetails | null> {
  const { tmdbApiKey } = await getConfig()
  const yearParam = year ? `&year=${year}` : ''
  const res = await fetch(
    `${BASE}/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}${yearParam}`
  )
  if (!res.ok) return null
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) return null
  return fetchDetails(hit.id, tmdbApiKey)
}

export async function lookupCriterionSlug(
  slug: string
): Promise<TmdbMovieDetails | null> {
  const { tmdbApiKey } = await getConfig()
  try {
    const res = await fetch(`https://www.criterion.com/films/${slug}`)
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/<meta property="og:title" content="([^"]+)"/)
      if (match) {
        const title = match[1].replace(/ \| The Criterion Collection$/, '').trim()
        const movie = await searchByTitle(title)
        if (movie) return movie
      }
    }
  } catch {
    // fall through
  }

  const titleSlug = slug.replace(/^\d+-/, '')
  const title = titleSlug.replace(/-/g, ' ')
  return searchByTitle(title)
}
