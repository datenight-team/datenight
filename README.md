# Date Night

A home-lab web app for Ian and Krista to manage their [Criterion Collection](https://www.criterion.com) date night movie watchlist.

Runs in Docker alongside their *arr stack. Add movies by pasting an IMDB or Criterion URL, drag to set the watch order, and the app automatically queues downloads via Seerr and keeps a "Date Night" Plex playlist in sync.

## Features

- **Add movies** by pasting an IMDB or Criterion Collection URL — metadata pulled from TMDB automatically
- **Drag to reorder** the watchlist (dnd-kit sortable)
- **Seerr integration** — top 10 unwatched movies are automatically requested for download; status shown per movie (Queued / Downloading / Ready)
- **Plex integration** — a "Date Night" playlist is kept in sync with available movies in watch order
- **Blind ratings** — each person gives a thumbs up or down and writes a critic's quote independently (Siskel & Ebert style); results are revealed only after both have rated, with 🤝 if you agreed and ⚔️ if you didn't
- **Recommendations** — Claude Opus analyzes your agreed-upon films and recommends 2 consensus picks (films you'll both likely 👍) and 1 wild card (a deliberate push outside your comfort zone); optional Criterion-only filter
- **Ask Claude** — sidebar link opens Claude with a pre-filled prompt based on recently watched films
- **Warm amber theme** — cozy UI, not a media server dashboard

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Drag & drop | dnd-kit |
| Database | SQLite via Prisma ORM |
| Background jobs | node-cron (inside the Next.js server process) |
| Runtime | tsx (TypeScript execution) |
| Tests | Vitest + Testing Library |
| Container | Docker (single Alpine image) |

## Configuration

All secrets are passed as environment variables. Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path — `file:./data/datenight.db` locally, `file:/app/data/datenight.db` in Docker |
| `TMDB_API_KEY` | [TMDB API v3 key](https://developer.themoviedb.org/docs/getting-started) (free) |
| `SEERR_URL` | Base URL of your Seerr instance, e.g. `http://seerr:5055` |
| `SEERR_API_KEY` | Seerr API key (Settings → API Key) |
| `PLEX_URL` | Base URL of your Plex server, e.g. `http://plex:32400` |
| `PLEX_TOKEN` | [Plex authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) |
| `USER1_NAME` | Display name for the first user (default: `User 1`) |
| `USER2_NAME` | Display name for the second user (default: `User 2`) |
| `ANTHROPIC_API_KEY` | [Anthropic API key](https://console.anthropic.com/) — required for the Recommendations feature; the rest of the app works without it |

## Running Locally

```bash
# Install dependencies
npm install

# Set up the database
npx prisma migrate dev

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running in Docker

```bash
# Build the image
docker build -t datenight .

# Or use docker compose (edit the volume path in docker-compose.yml first)
docker compose up -d
```

The container runs `prisma migrate deploy` on startup before serving traffic.

## Bulk Import from a Spreadsheet

If you have an existing list of films in a Google Sheet (or any spreadsheet), you can bulk-import them via CSV.

### Local development

```bash
# Export your sheet: File → Download → Comma Separated Values (.csv)
npm run import ~/Downloads/criterion.csv

# If the title column isn't auto-detected, specify it
npm run import ~/Downloads/criterion.csv "Film Title"
```

### Production (Docker)

```bash
# 1. Get the CSV onto your homelab host, then copy it into the container
docker cp /path/to/criterion.csv datenight:/app/data/criterion.csv

# 2. Run the import inside the container
docker exec datenight node_modules/.bin/tsx scripts/import-csv.ts /app/data/criterion.csv

# 3. Clean up
docker exec datenight rm /app/data/criterion.csv
```

The script looks up each film on TMDB by title, skips anything already in the list, and prints a summary of what imported, what was skipped, and anything it couldn't find (so you can add those manually via the UI).

Auto-detected column names: `Title`, `Film`, `Movie`, `Name`, `Film Title`, `Movie Title`. Any other name — pass it as the second argument.

## Tests

```bash
npm run test:run   # run all tests once
npm test           # watch mode
```

## Project Structure

```
src/
  app/
    api/              # Next.js API routes
    watchlist/        # Draggable watch list page
    watched/          # Grid of watched + reviewed movies
    add/              # URL paste → preview → add flow
    recommendations/  # Claude-powered film recommendations
  components/         # Shared UI components
  lib/                # Server-side clients (TMDB, Seerr, Plex, Claude, sync)
  types/              # Shared TypeScript interfaces
prisma/
  schema.prisma       # Movie, Rating, Setting models
  migrations/         # SQLite migrations
scripts/
  import-csv.ts       # Bulk import from CSV / Google Sheets export
tests/                # Vitest test files
server.ts             # Custom Next.js server (starts sync job in production)
```

## Troubleshooting

**Movies show "Not Requested" and never download**
Seerr integration is failing silently. Check that `SEERR_URL` and `SEERR_API_KEY` are correct and that the container can reach Seerr. The sync job runs every 5 minutes — check container logs: `docker logs datenight`.

**Plex playlist isn't updating**
Check `PLEX_URL` and `PLEX_TOKEN`. The Plex token expires occasionally; get a fresh one from Settings → Troubleshooting → Get Token in the Plex UI. The playlist syncs as part of the same 5-minute cron job as Seerr.

**Add Movie shows an error for a valid URL**
The `TMDB_API_KEY` is likely missing or wrong. Test it: `curl "https://api.themoviedb.org/3/movie/550?api_key=YOUR_KEY"` — should return JSON, not an auth error.

**The app starts but the database is empty after a restart**
The data volume isn't persisted. Check your `docker-compose.yml` volume config. With the named volume (`datenight-data`), data survives container restarts automatically. If you switched from a bind mount, the old data is still at the bind mount path.

**Inspecting or editing the database directly**
```bash
# Local dev — opens a browser GUI at localhost:5555
npx prisma studio

# Production — open a shell in the container
docker exec -it datenight sh
# The database file is at /app/data/datenight.db
```

**Recommendations page shows an error or returns nothing useful**
Make sure `ANTHROPIC_API_KEY` is set and valid. The feature requires at least a few watched and rated films to work well — the more films you've both rated, the better the recommendations. If you have no agreed films yet, it will still work but with less context.

**Container won't start / exits immediately**
Check logs: `docker logs datenight`. The most common cause is a missing environment variable or a database migration failure on first boot.

## License

MIT — see [LICENSE](LICENSE).
