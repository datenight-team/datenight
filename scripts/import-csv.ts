/**
 * Import movies from a CSV export of a Google Sheet.
 *
 * Local dev usage:
 *   npx tsx scripts/import-csv.ts <path-to-csv> [title-column]
 *
 * Production (Docker) usage:
 *   docker cp criterion.csv datenight:/app/data/criterion.csv
 *   docker exec datenight node_modules/.bin/tsx scripts/import-csv.ts /app/data/criterion.csv
 *
 * Examples:
 *   npx tsx scripts/import-csv.ts ~/Downloads/criterion-list.csv
 *   npx tsx scripts/import-csv.ts ~/Downloads/criterion-list.csv "Film Title"
 *
 * The script will:
 *  1. Read the CSV and detect (or use your specified) title column
 *  2. Look up each film on TMDB by title
 *  3. Insert it into the local SQLite database
 *  4. Skip duplicates (by IMDB ID)
 *  5. Print a summary of results
 *
 * TMDB_API_KEY must be set in .env.local (or the environment).
 * DATABASE_URL must be set in .env.local (or the environment).
 */

// env vars injected via --env-file=.env.local in the npm script
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { searchByTitle } from '../src/lib/tmdb'
import { prisma } from '../src/lib/db'

// ── Candidate column names to auto-detect ───────────────────────────────────
const TITLE_COLUMN_CANDIDATES = [
  'title', 'film', 'movie', 'name', 'film title', 'movie title',
  'film name', 'titre', 'titulo',
]

function detectTitleColumn(headers: string[]): string | null {
  for (const h of headers) {
    if (TITLE_COLUMN_CANDIDATES.includes(h.toLowerCase().trim())) {
      return h
    }
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalize(s: string) {
  return s
    .replace(/\s*\(.*?\)\s*/g, '') // strip trailing (year) or (director) etc.
    .replace(/^\s*#\d+[\s–:-]+/, '') // strip leading "42 - " or "#42: "
    .trim()
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const [, , csvPath, userColumn] = process.argv

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-csv.ts <path-to-csv> [title-column]')
    process.exit(1)
  }

  if (!process.env.TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not set. Add it to .env.local.')
    process.exit(1)
  }

  // ── Read + parse CSV ──────────────────────────────────────────────────────
  let raw: string
  try {
    raw = readFileSync(csvPath, 'utf-8')
  } catch {
    console.error(`Cannot read file: ${csvPath}`)
    process.exit(1)
  }

  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  if (rows.length === 0) {
    console.error('CSV is empty or has no data rows.')
    process.exit(1)
  }

  const headers = Object.keys(rows[0])
  console.log(`\nFound ${rows.length} rows. Columns: ${headers.join(', ')}\n`)

  // ── Resolve title column ──────────────────────────────────────────────────
  const titleCol = userColumn ?? detectTitleColumn(headers)
  if (!titleCol || !headers.includes(titleCol)) {
    console.error(
      userColumn
        ? `Column "${userColumn}" not found. Available: ${headers.join(', ')}`
        : `Could not auto-detect a title column. Available: ${headers.join(', ')}\n` +
          `Specify one: npx tsx scripts/import-csv.ts <csv> "<column name>"`
    )
    process.exit(1)
  }

  console.log(`Using column "${titleCol}" for film titles.\n`)

  // ── Fetch existing IMDB IDs to detect duplicates ─────────────────────────
  const existing = await prisma.movie.findMany({ select: { imdbId: true } })
  const existingIds = new Set(existing.map((m) => m.imdbId))

  // ── Get current max sort order ────────────────────────────────────────────
  const { _max } = await prisma.movie.aggregate({ _max: { sortOrder: true } })
  let nextOrder = (_max.sortOrder ?? 0) + 1

  // ── Process each row ──────────────────────────────────────────────────────
  const results = { imported: 0, skipped: 0, notFound: 0, errors: 0 }
  const notFound: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][titleCol]
    if (!raw?.trim()) {
      results.skipped++
      continue
    }

    const title = normalize(raw)
    process.stdout.write(`[${i + 1}/${rows.length}] ${title} … `)

    try {
      const movie = await searchByTitle(title)

      if (!movie) {
        console.log('not found on TMDB')
        notFound.push(raw.trim())
        results.notFound++
      } else if (existingIds.has(movie.imdbId)) {
        console.log(`already in list (${movie.title})`)
        results.skipped++
      } else {
        await prisma.movie.create({
          data: {
            title: movie.title,
            year: movie.year,
            runtime: movie.runtime,
            description: movie.description,
            posterUrl: movie.posterUrl,
            imdbId: movie.imdbId,
            tmdbId: movie.id,
            sortOrder: nextOrder++,
          },
        })
        existingIds.add(movie.imdbId)
        console.log(`✓ imported (${movie.title}, ${movie.year})`)
        results.imported++
      }
    } catch (err) {
      console.log(`error: ${err}`)
      results.errors++
    }

    // Polite rate limit — TMDB free tier allows ~40 req/10s
    await sleep(300)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────')
  console.log(`Imported:   ${results.imported}`)
  console.log(`Skipped:    ${results.skipped}  (already in list or blank)`)
  console.log(`Not found:  ${results.notFound}`)
  console.log(`Errors:     ${results.errors}`)

  if (notFound.length > 0) {
    console.log('\nFilms not found on TMDB (add manually or try a different title):')
    notFound.forEach((t) => console.log(`  - ${t}`))
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
