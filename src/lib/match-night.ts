// src/lib/match-night.ts
import { prisma } from './db'
import { getCriterionCatalog } from './criterion-catalog'
import { searchByTitle, fetchPopularMovies } from './tmdb'
import type { TmdbMovieDetails } from '@/types'

export const REFILL_THRESHOLD = 5
export const REFILL_BATCH_SIZE = 20

const CRITERION_CURSOR_KEY = 'match_night_criterion_cursor'
const TMDB_PAGE_CURSOR_KEY = 'match_night_tmdb_popular_page'
const MAX_TMDB_PAGES_PER_REFILL = 5

interface NewCandidate extends TmdbMovieDetails {
  source: 'criterion' | 'tmdb'
}

async function getCursor(key: string): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row ? parseInt(row.value, 10) || 0 : 0
}

async function setCursor(key: string, value: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  })
}

async function getExistingTmdbIds(): Promise<Set<number>> {
  const [movies, candidates] = await Promise.all([
    prisma.movie.findMany({ select: { tmdbId: true } }),
    prisma.swipeCandidate.findMany({ select: { tmdbId: true } }),
  ])
  return new Set<number>([
    ...movies.map((m) => m.tmdbId),
    ...candidates.map((c) => c.tmdbId),
  ])
}

export async function refillCandidates(): Promise<number> {
  const existingTmdbIds = await getExistingTmdbIds()
  const toInsert: NewCandidate[] = []
  const halfBatch = REFILL_BATCH_SIZE / 2

  // Criterion: resolve forward from the saved cursor through the static catalog
  const catalog = getCriterionCatalog()
  let criterionCursor = await getCursor(CRITERION_CURSOR_KEY)
  const criterionCollected = () => toInsert.filter((c) => c.source === 'criterion').length

  while (criterionCursor < catalog.length && criterionCollected() < halfBatch) {
    const entry = catalog[criterionCursor]
    criterionCursor++
    const details = await searchByTitle(entry.title, entry.year).catch(() => null)
    if (details && !existingTmdbIds.has(details.tmdbId)) {
      existingTmdbIds.add(details.tmdbId)
      toInsert.push({ ...details, source: 'criterion' })
    }
  }
  await setCursor(CRITERION_CURSOR_KEY, criterionCursor)

  // TMDB popular: page forward from the saved cursor
  let page = (await getCursor(TMDB_PAGE_CURSOR_KEY)) || 1
  let pagesFetched = 0

  while (toInsert.length < REFILL_BATCH_SIZE && pagesFetched < MAX_TMDB_PAGES_PER_REFILL) {
    const results = await fetchPopularMovies(page).catch(() => [])
    pagesFetched++
    page++
    for (const details of results) {
      if (existingTmdbIds.has(details.tmdbId)) continue
      existingTmdbIds.add(details.tmdbId)
      toInsert.push({ ...details, source: 'tmdb' })
      if (toInsert.length >= REFILL_BATCH_SIZE) break
    }
  }
  await setCursor(TMDB_PAGE_CURSOR_KEY, page)

  if (toInsert.length > 0) {
    await prisma.swipeCandidate.createMany({ data: toInsert })
  }
  return toInsert.length
}
