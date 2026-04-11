// src/lib/db.ts
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  // Strip the "file:" prefix, keep ":memory:" as-is
  const dbUrl = url.startsWith('file:') ? url.slice(5) : url
  const adapter = new PrismaBetterSqlite3({ url: dbUrl as ':memory:' | (string & {}) })
  return new PrismaClient({ adapter } as any)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
