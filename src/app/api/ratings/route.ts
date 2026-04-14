// src/app/api/ratings/route.ts
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { USER_KEYS } from '@/lib/users'
import type { User, RatingValue } from '@/types'

interface RatingBody {
  movieId: number
  user: User
  rating: RatingValue
  quote: string
}

function validateRatingBody(body: Partial<RatingBody>): NextResponse | null {
  if (!USER_KEYS.includes(body.user as User)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }
  if (!['up', 'down'].includes(body.rating ?? '')) {
    return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 422 })
  }
  if (!body.quote?.trim()) {
    return NextResponse.json({ error: 'quote required' }, { status: 422 })
  }
  return null
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const invalid = validateRatingBody(body)
  if (invalid) return invalid

  const { movieId, user, rating, quote } = body as RatingBody

  await prisma.rating.create({
    data: { movieId, user, rating, quote: quote.trim() },
  })

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  const complete = ratings.length === 2

  return NextResponse.json({ complete, ratings }, { status: 201 })
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const invalid = validateRatingBody(body)
  if (invalid) return invalid

  const { movieId, user, rating, quote } = body as RatingBody

  try {
    await prisma.rating.update({
      where: { movieId_user: { movieId, user } },
      data: { rating, quote: quote.trim() },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'rating not found' }, { status: 404 })
    }
    throw err
  }

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  return NextResponse.json({ ratings }, { status: 200 })
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { movieId, user } = body as { movieId?: number; user?: User }

  if (!movieId || !USER_KEYS.includes(user as User)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 422 })
  }

  const deleted = await prisma.rating.deleteMany({
    where: { movieId, user: user as User },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'rating not found' }, { status: 404 })
  }

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  return NextResponse.json({ ratings }, { status: 200 })
}
