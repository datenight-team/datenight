// src/lib/match-night.ts
import { prisma } from './db'
import { getCriterionCatalog } from './criterion-catalog'
import { searchByTitle, fetchPopularMovies } from './tmdb'
import { Prisma } from '@prisma/client'
import { otherUser } from './user-utils'
import { syncMovieProviders } from './streaming'
import type { TmdbMovieDetails, Movie, SwipeCandidateRecord, SwipeVote, User } from '@/types'

export const REFILL_THRESHOLD = 5
export const REFILL_BATCH_SIZE = 20

const CRITERION_CURSOR_KEY = 'match_night_criterion_cursor'
const TMDB_PAGE_CURSOR_KEY = 'match_night_tmdb_popular_page'
const MAX_TMDB_PAGES_PER_REFILL = 5

interface NewCandidate extends TmdbMovieDetails {
  source: 'criterion' | 'tmdb'
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
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
    if (details && details.imdbId !== '' && !existingTmdbIds.has(details.tmdbId)) {
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
      if (details.imdbId === '' || existingTmdbIds.has(details.tmdbId)) continue
      existingTmdbIds.add(details.tmdbId)
      toInsert.push({ ...details, source: 'tmdb' })
      if (toInsert.length >= REFILL_BATCH_SIZE) break
    }
  }
  await setCursor(TMDB_PAGE_CURSOR_KEY, page)

  if (toInsert.length > 0) {
    await prisma.swipeCandidate.createMany({ data: shuffle(toInsert) })
  }
  return toInsert.length
}

export async function getNextCandidateForUser(user: User): Promise<SwipeCandidateRecord | null> {
  const pendingCount = await prisma.swipeCandidate.count({
    where: { status: 'pending', swipes: { none: { user } } },
  })
  if (pendingCount < REFILL_THRESHOLD) {
    await refillCandidates()
  }

  return (await findNextPending(user)) as unknown as SwipeCandidateRecord | null
}

function findNextPending(user: User) {
  return prisma.swipeCandidate.findFirst({
    where: { status: 'pending', swipes: { none: { user } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}

export type SwipeResult =
  | { status: 'recorded' }
  | { status: 'matched'; movie: Movie }
  | { status: 'ignored' }

export async function recordSwipe(
  candidateId: number,
  user: User,
  vote: SwipeVote
): Promise<SwipeResult> {
  return prisma.$transaction(async (tx): Promise<SwipeResult> => {
    const candidate = await tx.swipeCandidate.findUnique({ where: { id: candidateId } })
    if (!candidate || candidate.status !== 'pending') {
      return { status: 'ignored' }
    }

    await tx.swipe.create({ data: { candidateId, user, vote } })

    if (vote === 'down') {
      await tx.swipeCandidate.update({ where: { id: candidateId }, data: { status: 'dead' } })
      return { status: 'recorded' }
    }

    const other = otherUser(user)
    const otherSwipe = await tx.swipe.findUnique({
      where: { candidateId_user: { candidateId, user: other } },
    })
    if (!otherSwipe || otherSwipe.vote !== 'up') {
      return { status: 'recorded' }
    }

    const { _max } = await tx.movie.aggregate({ _max: { sortOrder: true } })
    let movie
    try {
      movie = await tx.movie.create({
        data: {
          title: candidate.title,
          year: candidate.year,
          runtime: candidate.runtime,
          description: candidate.description,
          posterUrl: candidate.posterUrl,
          imdbId: candidate.imdbId,
          tmdbId: candidate.tmdbId,
          sortOrder: (_max.sortOrder ?? 0) + 1,
          matchedViaSwipe: true,
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        movie = await tx.movie.findUniqueOrThrow({ where: { tmdbId: candidate.tmdbId } })
      } else {
        throw err
      }
    }

    await tx.swipeCandidate.update({ where: { id: candidateId }, data: { status: 'matched' } })
    return { status: 'matched', movie: movie as unknown as Movie }
  }).then((result: SwipeResult) => {
    if (result.status === 'matched') {
      syncMovieProviders(result.movie.id, result.movie.tmdbId).catch((err) =>
        console.error('[match-night] Failed to sync providers for matched movie:', err)
      )
    }
    return result
  })
}
