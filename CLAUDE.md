# Date Night

A home-lab web app for Ian and Krista to manage their Criterion Collection date night movie watchlist. Runs in Docker alongside their *arr stack. Integrates with Seerr (download management) and Plex (playlist management).

## Project Status

**Implementation complete and extended beyond original 18-task plan. 49/49 tests passing. Build clean.**

Post-plan additions: configurable user names, thumbs up/down rating system, delete button on movie rows, loading skeletons, bulk CSV import, Claude-powered recommendations, GitHub Actions CI.

## Key Documents

- **Design spec:** `docs/superpowers/specs/2026-04-10-datenight-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-04-10-datenight.md`
- **UI mockups:** `docs/mockups/` (open in any browser)

## Tech Stack

Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · dnd-kit · Prisma + SQLite · node-cron · tsx · Vitest · Docker · Anthropic SDK (Claude Opus 4.6)

## Implementation Notes (learned during build)

- **Prisma v7**: Uses `prisma.config.ts` for `DATABASE_URL` instead of the `url` field in `schema.prisma`. Also requires `dotenv` as an explicit dev dependency (prisma.config.ts imports `dotenv/config`).
- **shadcn/ui v4**: `--style` and `--base-color` CLI flags are removed. Write `components.json` with `"style": "default"` and `"baseColor": "zinc"` before running `npx shadcn@latest add ...` to control the style.
- **Next.js 14 + Geist**: `Geist` font is not available via `next/font/google` in Next.js 14 (added in v15). Use `Inter` instead, or install the `geist` npm package.
- **Vitest with no tests**: Add `passWithNoTests: true` to `vitest.config.ts` so `npm run test:run` exits 0 when no test files exist yet.
- **seerrMediaId type**: Seerr returns `mediaInfo.id` as a number, but the Prisma schema stores it as `String?`. Always `String()` convert before writing to the DB.

## Running Locally Without Seerr/Plex

`npm run dev` skips the sync job entirely (cron only starts in production via `server.ts`). Set `SEERR_URL`/`PLEX_URL` to any fake value — all client calls fail gracefully and return safe defaults (`not_requested`, `null`, `false`). Only `TMDB_API_KEY` needs to be real to use the Add Movie flow. Everything else — watchlist, drag/drop, ratings, watched view — works fully offline.

## Bulk Import

To import an existing film list from a CSV (e.g. exported from Google Sheets):

```bash
# Local dev
npm run import ~/Downloads/criterion.csv [optional-column-name]

# Production (Docker)
docker cp criterion.csv datenight:/app/data/criterion.csv
docker exec datenight node_modules/.bin/tsx scripts/import-csv.ts /app/data/criterion.csv
docker exec datenight rm /app/data/criterion.csv
```

Script is at `scripts/import-csv.ts`. Auto-detects common column names (`Title`, `Film`, `Movie`, etc.).

## Recommendations Feature

Powered by Claude Opus 4.6 with adaptive thinking (`thinking: {type: "adaptive"}`). The feature lives at:
- `src/lib/recommendations.ts` — builds prompt from agreed films, calls Claude, enriches with TMDB
- `src/app/api/recommendations/route.ts` — POST endpoint, returns `RecommendationsResult`
- `src/app/recommendations/page.tsx` — UI with Criterion toggle and 3 recommendation cards

Requires `ANTHROPIC_API_KEY` env var. Returns 503 gracefully if not set — the rest of the app is unaffected.

Claude is given: all 👍👍 agreed films (primary signal), 👎👎 agreed-down films, disagreed films, and the full existing list to avoid. Returns 2 consensus picks + 1 wild card with reasoning.

## Quick Design Reference

| Decision | Choice |
|---|---|
| Users | Configurable via `USER1_NAME`/`USER2_NAME` env vars — named buttons, no login |
| Style | Warm amber/cream (Warm Date Night theme) |
| Layout | Sidebar nav |
| Movie entry | Paste IMDB or Criterion URL |
| Rating system | Thumbs up / thumbs down + critic's quote (Siskel & Ebert style) — `rating String` in DB |
| Reveal | 🤝 if agreed, ⚔️ if disagreed — shown after both submit |
| Request manager | Seerr |
| After both rate | Auto-delete from Plex |
| Architecture | Single Next.js container, SQLite on mounted volume |
