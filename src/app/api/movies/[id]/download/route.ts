// src/app/api/movies/[id]/download/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requestMovie } from '@/lib/seerr'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const id = parseInt(rawId, 10)
  const movie = await prisma.movie.findUnique({ where: { id } })
  if (!movie) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const result = await requestMovie(movie.tmdbId)
  if (!result) {
    return NextResponse.json({ error: 'Seerr request failed' }, { status: 502 })
  }

  const updated = await prisma.movie.update({
    where: { id },
    data: { seerrRequestId: result.requestId, seerrStatus: 'pending' },
  })
  return NextResponse.json(updated)
}
