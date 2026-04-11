# Date Night — Design Spec

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

A home-lab web application for Ian and Krista to manage their Criterion Collection date night movie list. Replaces a Google Sheets spreadsheet. Runs in Docker alongside their *arr stack. Integrates with Seerr (download management) and Plex (playlist management).

---

## Decisions Summary

| Decision | Choice |
|---|---|
| User identity | Named buttons — Ian / Krista; no login or PIN |
| Visual style | Warm Date Night — amber and cream tones |
| Layout | Sidebar navigation |
| Movie entry | Paste IMDB or Criterion Collection URL |
| Request manager | Seerr (successor to Overseerr) |
| Top-N auto-request | Top 10 unwatched movies kept requested in Seerr |
| After both rate | Auto-delete from Plex via Seerr |
| Claude recommendations | External link to claude.ai with pre-filled prompt |
| Architecture | Full-stack Next.js, single Docker container |

---

## Architecture

### Stack

- **Framework:** Next.js 14+ (App Router), TypeScript throughout
- **Database:** SQLite via Prisma ORM
- **Styling:** Tailwind CSS + shadcn/ui, themed to warm amber/cream
- **Drag-and-drop:** dnd-kit
- **Background jobs:** node-cron running inside the Next.js server process
- **Container:** Single Docker image, alpine base

### Integrations (all server-side via Next.js API routes)

| Integration | Purpose |
|---|---|
| **TMDB API** | Movie metadata, poster images (free API key required) |
| **Seerr API** | Request downloads, check status, delete media post-watch |
| **Plex API** | Create and maintain a "Date Night" playlist in watch order |
| **IMDB URL parser** | Extract `tt` ID → TMDB lookup by external ID |
| **Criterion URL** | Fetch page, extract film title → TMDB search |

### Configuration

All external credentials are passed as environment variables. A `.env.example` ships with the repo. Secrets never touch git.

```
DATABASE_URL=file:/app/data/datenight.db
TMDB_API_KEY=
SEERR_URL=http://seerr:5055
SEERR_API_KEY=
PLEX_URL=http://plex:32400
PLEX_TOKEN=
```

---

## Data Model

### `movies`

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | auto-increment |
| `title` | String | from TMDB |
| `year` | Int | |
| `runtime` | Int | minutes |
| `description` | String | TMDB overview |
| `poster_url` | String | TMDB poster path |
| `imdb_id` | String | `tt1234567` |
| `criterion_url` | String? | populated if added via Criterion link |
| `imdb_url` | String? | populated if added via IMDB link |
| `sort_order` | Int | watch list position; drag to reorder |
| `status` | Enum | `watchlist` \| `watched` |
| `seerr_request_id` | String? | set once Seerr request is submitted |
| `seerr_status` | Enum | `not_requested` \| `pending` \| `processing` \| `available` \| `deleted` |
| `watched_at` | DateTime? | set when both ratings are submitted |
| `created_at` | DateTime | |

### `ratings`

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | |
| `movie_id` | Int FK | → movies |
| `user` | Enum | `ian` \| `krista` |
| `stars` | Int | 1–5 |
| `quote` | String | critic's quote |
| `submitted_at` | DateTime | |

Unique constraint on `(movie_id, user)` — one rating per person per movie.

**Rating reveal rule:** A movie's ratings are only returned to the client once both `ian` and `krista` rows exist for that movie. This is enforced in the API layer, not the database.

### `settings`

| Field | Type |
|---|---|
| `key` | String PK |
| `value` | String |

Key/value store for future configuration overrides. Not heavily used at launch.

---

## UI & Navigation

### Visual Style

Warm Date Night: soft amber (`#d97706`) and cream (`#fdf6ec`, `#fff8f0`) palette. Rounded corners, warm shadows, cozy feel. Reference mockup: `docs/mockups/visual-style.html`.

### Sidebar Layout

Persistent left sidebar. Reference mockup: `docs/mockups/main-layout.html`.

**Primary nav (top of sidebar):**
- 📋 Watch List
- ✅ Watched
- ➕ Add Movie

**Utility links (bottom of sidebar):**
- 🎞️ Browse Criterion → opens `https://www.criterion.com/` in a new tab
- ✨ Ask Claude → opens `https://claude.ai/` in a new tab with a pre-filled prompt that includes the titles of the last 10 watched movies and asks for Criterion Collection recommendations in a similar vein

### Watch List View

- Ordered, draggable list of unwatched movies
- Each row: drag handle · position number · poster thumbnail · title + runtime · status badge · action button
- Status badges:
  - `● Ready` (green) — `seerr_status: available`; in Plex
  - `⏳ Downloading` (amber) — `seerr_status: processing`; actively downloading
  - `○ Queued` (gray) — `seerr_status: pending`; submitted to Seerr, awaiting download start
  - `○ Not Requested` (gray, faint) — `seerr_status: not_requested`; outside the top-10 window
- Action buttons:
  - **Mark Watched** — shown only on Ready movies
  - **Download Now** — shown on Queued / Not Requested movies; forces a Seerr request immediately
- Header pill shows total movie count and how many are Ready

### Watched View

- Grid of completed movies
- Each card shows: poster, title, year
- Once both Ian and Krista have submitted ratings: stars and critic's quote revealed side-by-side
- While only one has rated: shows "Waiting for [name]..." with no scores visible

### Add Movie View

- Single URL input field with a "Preview" button
- Accepts IMDB URLs (`https://www.imdb.com/title/tt.../`) or Criterion URLs (`https://www.criterion.com/films/...`)
- On submit: app parses the URL, looks up metadata on TMDB, renders a preview card (poster, title, year, runtime, description)
- Confirm button saves the movie to the bottom of the watch list

---

## Key Workflows

### Adding a Movie

1. Navigate to Add Movie
2. Paste an IMDB or Criterion URL
3. App extracts identifier → TMDB lookup → preview card renders
4. Confirm → saved to `movies` with `status: watchlist`, `seerr_status: not_requested`, `sort_order` set to `MAX + 1`

### Seerr Sync (background, every 5 minutes via node-cron)

1. Fetch top 10 unwatched movies by `sort_order`
2. For each:
   - If `seerr_request_id` is null → submit Seerr request, save `seerr_request_id`
   - If already requested → poll Seerr for current status, update `seerr_status`
3. After status updates: sync the Plex "Date Night" playlist (see below)

### Plex Playlist Sync

- Triggered after every Seerr sync and after every reorder
- Fetches all movies with `seerr_status: available` ordered by `sort_order`
- Creates or updates the "Date Night" Plex playlist to match this ordered set
- Playlist reflects current watch priority

### Mark as Watched + Rating Flow

1. Click **Mark Watched** on a Ready movie
2. Prompt: *"Who's rating first?"* — Ian button / Krista button
3. First person: enters 1–5 stars + critic's quote → submits
4. App shows: *"Waiting for [other person] to add their rating..."*
5. Second person: taps their name button, enters stars + quote → submits
6. Both submitted: ratings reveal side-by-side with critic quotes
7. Auto-trigger: Seerr delete request for the movie; `status` → `watched`; `watched_at` set to now

### Reordering

- Drag a movie row to new position in Watch List
- `sort_order` values update in DB immediately via API call
- Next Seerr sync picks up the new order: ensures top 10 are requested, updates Plex playlist

### Force Download

- Click **Download Now** on any Queued or Not Requested movie
- Immediately submits a Seerr request (does not wait for the next sync cycle)
- `seerr_status` → `pending`; button replaced by status badge

---

## Docker & Deployment

### Dockerfile

Multi-stage build: Node alpine base, `npm ci --production`, `next build`, `prisma migrate deploy` on startup. Exposes port 3000.

### docker-compose.yml

```yaml
services:
  datenight:
    image: datenight:latest
    ports:
      - "3000:3000"
    volumes:
      - /path/to/your/data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/datenight.db
      - TMDB_API_KEY=...
      - SEERR_URL=http://seerr:5055
      - SEERR_API_KEY=...
      - PLEX_URL=http://plex:32400
      - PLEX_TOKEN=...
    restart: unless-stopped
```

### SQLite Persistence

Database file at `/app/data/datenight.db` inside the container. Mapped to a host path (e.g. a NAS share). Survives container rebuilds and image updates.

### Migrations

`prisma migrate deploy` runs automatically on container startup. Safe to run repeatedly; no manual migration steps required.

### Updates

Rebuild the image (`docker build`) and restart the container. The volume-mounted database is unaffected.

---

## Out of Scope (v1)

- Mobile-native app (responsive web is sufficient for home use)
- Multiple users beyond Ian and Krista
- User accounts / passwords
- Notifications (email, push, etc.)
- Automatic import from the existing Google Sheets spreadsheet (manual re-entry or a one-time migration script can be done later)
- Any external access / authentication beyond the local network
