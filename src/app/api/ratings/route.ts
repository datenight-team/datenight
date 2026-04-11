// src/app/api/ratings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { USER_KEYS } from '@/lib/users'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { movieId, user, stars, quote } = body

  if (!USER_KEYS.includes(user)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars must be 1–5' }, { status: 422 })
  }
  if (!quote?.trim()) {
    return NextResponse.json({ error: 'quote required' }, { status: 422 })
  }

  await prisma.rating.create({
    data: { movieId, user, stars, quote: quote.trim() },
  })

  const ratings = await prisma.rating.findMany({ where: { movieId } })
  const complete = ratings.length === 2

  return NextResponse.json({ complete, ratings }, { status: 201 })
}
