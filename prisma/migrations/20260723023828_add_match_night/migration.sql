-- CreateTable
CREATE TABLE "SwipeCandidate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdbId" INTEGER NOT NULL,
    "imdbId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "runtime" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "candidateId" INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "swipedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Swipe_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SwipeCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Movie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "runtime" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "imdbId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "criterionUrl" TEXT,
    "imdbUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'watchlist',
    "seerrRequestId" TEXT,
    "seerrMediaId" TEXT,
    "seerrStatus" TEXT NOT NULL DEFAULT 'not_requested',
    "watchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamingLastChecked" DATETIME,
    "streamingLink" TEXT,
    "matchedViaSwipe" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Movie" ("createdAt", "criterionUrl", "description", "id", "imdbId", "imdbUrl", "posterUrl", "runtime", "seerrMediaId", "seerrRequestId", "seerrStatus", "sortOrder", "status", "streamingLastChecked", "streamingLink", "title", "tmdbId", "watchedAt", "year") SELECT "createdAt", "criterionUrl", "description", "id", "imdbId", "imdbUrl", "posterUrl", "runtime", "seerrMediaId", "seerrRequestId", "seerrStatus", "sortOrder", "status", "streamingLastChecked", "streamingLink", "title", "tmdbId", "watchedAt", "year" FROM "Movie";
DROP TABLE "Movie";
ALTER TABLE "new_Movie" RENAME TO "Movie";
CREATE UNIQUE INDEX "Movie_imdbId_key" ON "Movie"("imdbId");
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SwipeCandidate_tmdbId_key" ON "SwipeCandidate"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_candidateId_user_key" ON "Swipe"("candidateId", "user");
