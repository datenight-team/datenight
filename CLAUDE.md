# Date Night

A home-lab web app for Ian and Krista to manage their Criterion Collection date night movie watchlist. Runs in Docker alongside their *arr stack. Integrates with Seerr (download management) and Plex (playlist management).

## Project Status

**Design complete. Implementation not yet started.**

## Key Documents

- **Design spec:** `docs/superpowers/specs/2026-04-10-datenight-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-04-10-datenight.md`
- **UI mockups:** `docs/mockups/` (open in any browser)

## To Resume Implementation

Read the implementation plan and execute it task by task starting at Task 1 using the `superpowers:subagent-driven-development` skill (or `superpowers:executing-plans` for inline execution).

## Tech Stack (decided, not yet built)

Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · dnd-kit · Prisma + SQLite · node-cron · tsx · Vitest · Docker

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
