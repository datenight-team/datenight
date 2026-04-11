// src/app/api/movies/[id]/watched/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteMedia } from '@/lib/seerr'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const id = parseInt(rawId, 10)
  const movie = await prisma.movie.findUnique({ where: { id } })
  if (!movie) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Trigger Seerr delete if we have a media ID
  if (movie.seerrMediaId) {
    await deleteMedia(parseInt(movie.seerrMediaId, 10))
  }

  const updated = await prisma.movie.update({
    where: { id },
    data: { status: 'watched', watchedAt: new Date() },
  })

  return NextResponse.json(updated)
}
