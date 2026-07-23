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

Two feeder sources, both writing into `SwipeCandidate`:

1. **Criterion Collection** — paginate `criterion.com/shop/browse/films` listing pages,
   scrape each film's slug + title from the listing HTML (reusing the `og:title` scrape
   approach already present in `lookupCriterionSlug` in `src/lib/tmdb.ts`, adapted for a
   listing page instead of a single film page). For each title found, resolve via the
   existing `searchByTitle()` TMDB helper to get tmdbId/imdbId/year/description/posterUrl.
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
This is a synchronous part of the request — no cron job, no manual refresh button.

## Swipe Flow

New route `/match-night`, new sidebar entry "Match Night 💕" (added to `navItems` in
`src/components/sidebar.tsx`, and to the mobile bottom nav for parity with other primary
routes).

1. User selects their name via the same named-user selector pattern used elsewhere in
   the app (e.g. rating flow) — no separate login.
2. Page requests "next card for this user": the oldest `pending` `SwipeCandidate` that
   this user has no `Swipe` row for yet. Card shows poster, title, year, description, and
   👍/👎 buttons.
3. On 👎: create/upsert this user's `Swipe` row (`vote: "down"`), and immediately set the
   candidate's `status` to `"dead"`. It disappears from both users' decks (already-fetched
   or future).
4. On 👍: create/upsert this user's `Swipe` row (`vote: "up"`).
   - Query the other user's `Swipe` for this candidate.
   - If they also voted `up`: create a `Movie` row via the same creation logic as
     `POST /api/movies` (TMDB enrichment fields already known from the candidate, no
     re-fetch needed), set `matchedViaSwipe: true`, set candidate `status: "matched"`,
     and kick off `syncMovieProviders` exactly as the existing endpoint does.
   - Otherwise: leave candidate `status: "pending"`, just move on.
5. Advance to the next card. If none remain after a refill attempt, show an empty-state
   ("You're all caught up — check back later").

## Watchlist Decorator

`MovieRow` / `MovieCard` (`src/components/movie-row.tsx`, `movie-card.tsx`) check
`movie.matchedViaSwipe` and render a small "It's a match! 🎉" badge alongside the existing
card content, styled consistently with the warm amber/cream theme.

## API Surface (new)

- `GET /api/match-night/next?user=<name>` — returns the next card for that user (triggers
  refill if needed), or `null` if the deck is genuinely exhausted even after a refill
  attempt.
- `POST /api/match-night/swipe` — body `{ candidateId, user, vote }`. Performs the vote
  recording, dead/match transition, and (on match) watchlist insertion + streaming sync.

## Testing

Vitest, following existing patterns (mocked `fetch` for TMDB/Criterion HTTP calls, mocked
Prisma client):

- Candidate fetch/dedup: verifies existing `Movie` and `SwipeCandidate` rows are excluded
  from newly inserted candidates.
- Swipe transitions: down → dead; up (first voter) → still pending; up (second voter,
  matching an existing up) → `Movie` created with `matchedViaSwipe: true`, candidate →
  matched.
- Refill trigger: deck below threshold triggers a fetch; deck above threshold does not.
- API route tests for `GET /api/match-night/next` and `POST /api/match-night/swipe`
  mirroring the style of existing `src/app/api/movies/route.ts` tests.
