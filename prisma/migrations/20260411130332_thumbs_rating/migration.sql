/*
  Warnings:

  - You are about to drop the column `stars` on the `Rating` table. All the data in the column will be lost.
  - Added the required column `rating` to the `Rating` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Rating" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieId" INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rating_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Rating" ("id", "movieId", "quote", "submittedAt", "user") SELECT "id", "movieId", "quote", "submittedAt", "user" FROM "Rating";
DROP TABLE "Rating";
ALTER TABLE "new_Rating" RENAME TO "Rating";
CREATE UNIQUE INDEX "Rating_movieId_user_key" ON "Rating"("movieId", "user");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
