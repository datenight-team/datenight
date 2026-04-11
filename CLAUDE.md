# Date Night

A home-lab web app for Ian and Krista to manage their Criterion Collection date night movie watchlist. Runs in Docker alongside their *arr stack. Integrates with Seerr (download management) and Plex (playlist management).

## Project Status

**Implementation complete. All 18 tasks done. 49/49 tests passing. Build clean.**

## Key Documents

- **Design spec:** `docs/superpowers/specs/2026-04-10-datenight-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-04-10-datenight.md`
- **UI mockups:** `docs/mockups/` (open in any browser)

## Tech Stack

Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · dnd-kit · Prisma + SQLite · node-cron · tsx · Vitest · Docker

## Implementation Notes (learned during build)

- **Prisma v7**: Uses `prisma.config.ts` for `DATABASE_URL` instead of the `url` field in `schema.prisma`. Also requires `dotenv` as an explicit dev dependency (prisma.config.ts imports `dotenv/config`).
- **shadcn/ui v4**: `--style` and `--base-color` CLI flags are removed. Write `components.json` with `"style": "default"` and `"baseColor": "zinc"` before running `npx shadcn@latest add ...` to control the style.
- **Next.js 14 + Geist**: `Geist` font is not available via `next/font/google` in Next.js 14 (added in v15). Use `Inter` instead, or install the `geist` npm package.
- **Vitest with no tests**: Add `passWithNoTests: true` to `vitest.config.ts` so `npm run test:run` exits 0 when no test files exist yet.
- **seerrMediaId type**: Seerr returns `mediaInfo.id` as a number, but the Prisma schema stores it as `String?`. Always `String()` convert before writing to the DB.

## Quick Design Reference

| Decision | Choice |
|---|---|
| Users | Ian + Krista — named buttons, no login |
| Style | Warm amber/cream (Warm Date Night theme) |
| Layout | Sidebar nav |
| Movie entry | Paste IMDB or Criterion URL |
| Request manager | Seerr |
| After both rate | Auto-delete from Plex |
| Architecture | Single Next.js container, SQLite on mounted volume |
