# Match Night — Design Spec

Date: 2026-07-22

## Summary

A Tinder-style swipe feature ("Match Night") for discovering new movies to add to the
watchlist. Ian and Krista each swipe 👍/👎 through a shared deck of candidate movies,
independently and asynchronously. The instant both have thumbs-upped the same candidate,
it's automatically added to the watchlist, flagged with a "match" decorator.

## Goals

- Give both people a low-friction way to discover and agree on new movies, instead of
  one person unilaterally pasting an IMDB/Criterion URL into Add Movie.
- Reuse the existing named-user pattern (no login) and the existing add-to-watchlist
  pipeline (TMDB enrichment, streaming sync).
- Deck stays fresh automatically — no manual "load more" step required in normal use.

## Non-goals

- No drag/gesture-based swiping — tap buttons only, matching the rest of the app's
  interaction style.
- No synchronous/shared-session swiping (passing one device back and forth).
- No notification/toast on match — surfaced passively via a watchlist card decorator.
- Not replacing the existing Add Movie flow (paste URL) — Match Night is an additional
  discovery path into the same watchlist.

## Data Model

Two new Prisma models, plus one new field on `Movie`.

```prisma
model SwipeCandidate {
  id           Int      @id @default(autoincrement())
  tmdbId       Int      @unique
  imdbId       String?
  title        String
  year         Int
  description  String
  posterUrl    String
  source       String   // "criterion" | "tmdb"
  status       String   @default("pending") // pending | dead | matched
  createdAt    DateTime @default(now())
  swipes       Swipe[]
}

model Swipe {
  id          Int            @id @default(autoincrement())
  candidateId Int
  user        String
  vote        String         // "up" | "down"
  swipedAt    DateTime       @default(now())
  candidate   SwipeCandidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)

  @@unique([candidateId, user])
}
```

`Movie` model gets:

```prisma
matchedViaSwipe Boolean @default(false)
```

Set `true` only when a `Movie` row is created as the result of a Match Night mutual
thumbs-up. Never set on movies added via the existing Add Movie / bulk import flows.
This flag is permanent history on that watchlist entry — there's nothing to dismiss or
clear.

## Candidate Sourcing

Two feeder sources, both writing into `SwipeCandidate`.

> **Revision note (post-review):** the original design called for live-scraping
> `criterion.com/shop/browse/films`. Testing during planning showed criterion.com sits
> behind a Cloudflare JS challenge — a plain server-side `fetch` (to both listing pages
> and individual film pages) returns a "Just a moment..." challenge page, not real HTML.
> Live scraping the catalog is not viable. Source 1 below replaces the scrape with a
> bundled static file.

1. **Criterion Collection** — a static JSON file checked into the repo,
   `data/criterion-catalog.json`, containing `{ title: string, year?: number }` entries
   for the Criterion Collection catalog. This is compiled once (semi-)manually (e.g. from
   a public spine-number list) and updated by hand periodically as Criterion adds titles
   — there is no live fetch to criterion.com in this feature. For each entry not yet
   resolved, resolve via the existing `searchByTitle()` TMDB helper to get
   tmdbId/imdbId/year/description/posterUrl, then insert as a `SwipeCandidate` with
   `source: "criterion"`.
2. **TMDB popular** — page through TMDB's `/movie/popular` endpoint directly (new small
   helper alongside the existing functions in `src/lib/tmdb.ts`).

**Dedup rules**, applied when inserting fetched candidates:

- Skip any title whose `tmdbId` or `imdbId` already matches an existing `Movie` row
  (regardless of status — watchlist or watched).
- Skip any title whose `tmdbId` already exists as a `SwipeCandidate` (any status —
  pending, dead, or matched), to avoid re-adding a candidate someone already killed or
  matched on previously.

**Refill trigger**: when a user requests their next card and their count of pending,
not-yet-swiped-by-them candidates drops below a threshold (5), the API kicks off a
fetch of one additional batch (e.g. 20) from both sources combined before responding.
This is a synchronous part of the request — no cron job, no manual refresh button. The
threshold (5) and batch size (20) are hardcoded constants for v1, not exposed in
Settings — unlike the streaming region/services settings, there's no user-facing reason
to tune these yet; revisit if usage shows otherwise.

**Latency and failure handling**: a refill is a chain of sequential external HTTP calls
(per-title TMDB search for unresolved Criterion catalog entries, plus TMDB popular
paging), so `GET /api/match-night/next` can stall for a few seconds exactly when the
deck is running low — i.e. mid-swiping-session. Each external call gets a short timeout
(e.g. 5s) consistent with the rest of the app's "fail gracefully, return safe defaults"
pattern (per CLAUDE.md). The two sources are independent: if TMDB resolution fails or
times out for some Criterion catalog entries, log and skip those entries, continuing
with whatever did resolve plus the TMDB-popular batch, rather than aborting the whole
refill. If both sources fail or both are already exhausted, the refill simply adds zero
candidates and the request falls through to the empty-state response — no retry loop
within the request.

## Swipe Flow

New route `/match-night`, new sidebar entry "Match Night" with icon 💕 (added to
`navItems` in `src/components/sidebar.tsx`, and to the mobile bottom nav for parity with
other primary routes). Existing `navItems` labels are one or two words with a single
leading emoji glyph (e.g. "Watch List" 📋, "Recommend" 🎯) — "Match Night" fits that
pattern in length; do a quick visual check once built since it's slightly longer than
most existing entries.

1. User selects their name via the same named-user selector pattern used elsewhere in
   the app (e.g. rating flow) — no separate login.
2. Page requests "next card for this user": the oldest `pending` `SwipeCandidate` that
   this user has no `Swipe` row for yet. Card shows poster, title, year, description, and
   👍/👎 buttons.
3. On 👎: create/upsert this user's `Swipe` row (`vote: "down"`), and immediately set the
   candidate's `status` to `"dead"`. It disappears from both users' decks (already-fetched
   or future).
4. On 👍: create this user's `Swipe` row (`vote: "up"`).
   - Query the other user's `Swipe` for this candidate.
   - If they also voted `up`: create a `Movie` row via the same creation logic as
     `POST /api/movies` (TMDB enrichment fields already known from the candidate, no
     re-fetch needed), set `matchedViaSwipe: true`, set candidate `status: "matched"`,
     and kick off `syncMovieProviders` exactly as the existing endpoint does.
   - Otherwise: leave candidate `status: "pending"`, just move on.
5. Advance to the next card. If none remain after a refill attempt, show an empty-state
   ("You're all caught up — check back later"). Note this is not terminal for the
   session: since refill is attempted on every `next` request while the pending count is
   below threshold, the very next card request (e.g. the user reopening the tab, or a
   later visit) retries the fetch. There's no separate "wake up and retry" mechanism —
   retry only happens on demand, driven by the user asking for a card.

### Concurrency & consistency

Two independent users can act on the same candidate at nearly the same moment, which is
the one place in this feature where two actors write to shared state. This needs
explicit handling, not just the happy path above:

- **Race on the up/up transition.** Steps in 4 above (upsert this user's swipe → read
  the other user's swipe → conditionally create `Movie`) must run inside a single
  `prisma.$transaction`, so a near-simultaneous double 👍 can't both pass the "other user
  already voted up" check and both attempt to create the `Movie`. As a second line of
  defense, `Movie.tmdbId` is already `@unique` (existing schema) — a create that races
  past the transaction boundary hits that constraint; catch the conflict and treat it as
  "already matched" rather than a 500.
- **Server-side re-validation of candidate status at swipe time.** A client can have a
  card loaded that has since gone `dead` (other user downvoted) or `matched`
  (concurrent match) server-side. `POST /api/match-night/swipe` must re-check
  `candidate.status === "pending"` inside the same transaction before recording the
  vote. If it's no longer pending, silently no-op the vote (don't record it, don't
  error) and respond as if advancing to the next card — consistent with this feature
  having no toast/error UX per the non-goals.

## Watchlist Decorator

`MovieRow` / `MovieCard` (`src/components/movie-row.tsx`, `movie-card.tsx`) check
`movie.matchedViaSwipe` and render a small "It's a match! 🎉" badge alongside the existing
card content, styled consistently with the warm amber/cream theme.

## API Surface (new)

- `GET /api/match-night/next?user=<name>` — returns the next card for that user (triggers
  refill if needed), or `null` if the deck is genuinely exhausted even after a refill
  attempt.
- `POST /api/match-night/swipe` — body `{ candidateId, user, vote }`. Performs the vote
  recording, dead/match transition, and (on match) watchlist insertion + streaming sync,
  all inside a single `prisma.$transaction` per the Concurrency & Consistency section
  above. No-ops (no vote recorded, no error) if the candidate is no longer `pending`.

## Testing

Vitest, following existing patterns (mocked `fetch` for TMDB/Criterion HTTP calls, mocked
Prisma client):

- Candidate fetch/dedup: verifies existing `Movie` and `SwipeCandidate` rows are excluded
  from newly inserted candidates.
- Swipe transitions: down → dead; up (first voter) → still pending; up (second voter,
  matching an existing up) → `Movie` created with `matchedViaSwipe: true`, candidate →
  matched.
- Refill trigger: deck below threshold triggers a fetch; deck above threshold does not.
- Refill partial failure: Criterion source throwing/timing out still yields the TMDB
  batch rather than aborting the refill.
- Concurrency: two near-simultaneous 👍 swipes on the same candidate (from different
  users) result in exactly one `Movie` row and the candidate ending as `matched`, not a
  crash or duplicate.
- Stale swipe: a swipe submitted against a candidate that's already `dead` or `matched`
  server-side is a no-op — no `Swipe` row created, no error thrown.
- API route tests for `GET /api/match-night/next` and `POST /api/match-night/swipe`
  mirroring the style of existing `src/app/api/movies/route.ts` tests.

## Migration Note

`matchedViaSwipe Boolean @default(false)` on `Movie` backfills existing rows to `false`
automatically via the column default — no manual data migration needed.
