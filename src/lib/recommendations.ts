// src/lib/recommendations.ts
import { getAnthropic } from './claude'
import { getConfig } from './config'
import { searchByTitle } from './tmdb'
import { prisma } from './db'
import { getUserNames } from './users'
import type { TmdbMovieDetails } from '@/types'

export interface Recommendation {
  title: string
  year: number
  director: string
  type: 'consensus' | 'wildcard'
  reason: string
  // TMDB-enriched fields (null if TMDB couldn't find the film)
  tmdb: TmdbMovieDetails | null
  // True if this film is already in the watchlist or watched list
  alreadyInList: boolean
}

export interface RecommendationsResult {
  reasoning: string
  recommendations: Recommendation[]
  agreedCount: number
  dataWarning?: string // e.g. "No agreed films yet — recommendations based on your watchlist"
}

interface ClaudeRecommendation {
  title: string
  year: number
  director: string
  type: 'consensus' | 'wildcard'
  reason: string
}

interface ClaudeResponse {
  reasoning: string
  recommendations: ClaudeRecommendation[]
}

// Stable system prompt — put cache_control here so it caches once it hits the
// 4096-token minimum threshold for Opus 4.6. Below threshold it's a no-op.
const SYSTEM_PROMPT = `\
You are a film sommelier — an expert at reading cinematic taste patterns and making bold, accurate recommendations.

You will be given a couple's reaction to films they've watched together:
- Both 👍: they both enjoyed it (most important signal)
- Both 👎: they both disliked it (what to avoid)
- Disagreed: their taste diverged (reveals individual sensitivities)

Your job: analyze their shared taste and recommend exactly 3 films:
1. Two "consensus" picks — films you are highly confident BOTH will give 👍
2. One "wildcard" pick — something genuinely outside their usual choices, with a compelling case for why they should try it anyway

Think carefully about:
- Recurring directors, movements, or national cinemas they both love
- Themes, pacing, and visual styles they consistently respond to
- What their disagreements reveal about where their tastes diverge
- For the wildcard: find genuine blind spots worth exploring — not random obscurity, but a considered push

Always respond with valid JSON only. No text before or after the JSON.`

export async function getRecommendations(
  criterionOnly: boolean
): Promise<RecommendationsResult> {
  const config = await getConfig()
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key is not configured')
  }

  const userNames = await getUserNames()

  // Fetch all movies with their ratings from the DB
  const allMovies = await prisma.movie.findMany({
    include: { ratings: true },
    orderBy: { sortOrder: 'asc' },
  })

  const watchedMovies = allMovies.filter((m) => m.status === 'watched')
  const watchlistMovies = allMovies.filter((m) => m.status === 'watchlist')

  // Categorise by agreement
  const agreedUp: typeof watchedMovies = []
  const agreedDown: typeof watchedMovies = []
  const disagreed: typeof watchedMovies = []

  for (const movie of watchedMovies) {
    const ratings = movie.ratings
    if (ratings.length < 2) continue
    const r1 = ratings[0].rating
    const r2 = ratings[1].rating
    if (r1 === 'up' && r2 === 'up') agreedUp.push(movie)
    else if (r1 === 'down' && r2 === 'down') agreedDown.push(movie)
    else disagreed.push(movie)
  }

  let dataWarning: string | undefined
  if (agreedUp.length === 0 && watchedMovies.length === 0) {
    dataWarning = 'No watched films yet — recommendations based on general Criterion taste'
  } else if (agreedUp.length === 0) {
    dataWarning = 'No agreed-upon films yet — recommendations based on your overall watched list'
  }

  // Build the user message
  const allTitles = allMovies.map((m) => `${m.title} (${m.year})`)

  const formatList = (movies: typeof watchedMovies) =>
    movies.length === 0
      ? '(none)'
      : movies.map((m) => `- ${m.title} (${m.year})`).join('\n')

  const criterionConstraint = criterionOnly
    ? 'IMPORTANT: ALL 3 recommendations MUST be films available in the Criterion Collection. This is a hard constraint — do not recommend films outside the Criterion Collection.'
    : 'You may recommend from any source — Criterion Collection, theatrical releases, or otherwise.'

  const userMessage = `\
${userNames.user1} and ${userNames.user2}'s film history:

FILMS YOU BOTH GAVE 👍 (${agreedUp.length} films — your strongest taste signal):
${formatList(agreedUp)}

FILMS YOU BOTH GAVE 👎 (${agreedDown.length} films):
${formatList(agreedDown)}

FILMS YOU DISAGREED ON (${disagreed.length} films):
${formatList(disagreed)}

FILMS ALREADY IN YOUR LIST (do not recommend these):
${allTitles.length === 0 ? '(none)' : allTitles.map((t) => `- ${t}`).join('\n')}

${criterionConstraint}

Recommend exactly 3 films — 2 consensus picks then 1 wildcard. Return this exact JSON:
{
  "reasoning": "2-3 sentences analyzing their taste pattern before making picks",
  "recommendations": [
    {
      "title": "exact film title",
      "year": 1954,
      "director": "director name",
      "type": "consensus",
      "reason": "2-3 sentences on why both will likely agree"
    },
    {
      "title": "exact film title",
      "year": 1962,
      "director": "director name",
      "type": "consensus",
      "reason": "2-3 sentences on why both will likely agree"
    },
    {
      "title": "exact film title",
      "year": 2003,
      "director": "director name",
      "type": "wildcard",
      "reason": "2-3 sentences on why this pushes them and why it's worth trying"
    }
  ]
}`

  // Call Claude — Opus 4.6 with adaptive thinking for genuine taste reasoning
  const anthropic = await getAnthropic()
  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Cache the stable system prompt — no-op below 4096 tokens but
        // correct placement for when the prompt grows
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  })

  const response = await stream.finalMessage()

  // Extract the text block (thinking blocks are separate)
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON — strip markdown code fences if present
  const raw = textBlock.text.replace(/^```json\s*/m, '').replace(/\s*```$/m, '').trim()
  let parsed: ClaudeResponse
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  // Build a Set of existing titles (lowercased) for quick duplicate lookup
  const existingTitles = new Set(allMovies.map((m) => m.title.toLowerCase()))

  // Enrich each recommendation with TMDB metadata
  const recommendations: Recommendation[] = await Promise.all(
    parsed.recommendations.map(async (rec) => {
      let tmdb: TmdbMovieDetails | null = null
      try {
        tmdb = await searchByTitle(rec.title, rec.year)
      } catch {
        // TMDB lookup failure is non-fatal
      }

      return {
        title: rec.title,
        year: rec.year,
        director: rec.director,
        type: rec.type,
        reason: rec.reason,
        tmdb,
        alreadyInList: existingTitles.has(rec.title.toLowerCase()),
      }
    })
  )

  return {
    reasoning: parsed.reasoning ?? '',
    recommendations,
    agreedCount: agreedUp.length,
    dataWarning,
  }
}
