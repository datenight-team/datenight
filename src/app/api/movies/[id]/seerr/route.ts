// src/app/api/movies/[id]/seerr/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteMedia, deleteFromService } from '@/lib/seerr'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const id = parseInt(rawId, 10)
  const movie = await prisma.movie.findUnique({ where: { id } })
  if (!movie) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!movie.seerrMediaId) return NextResponse.json({ error: 'no seerr media id' }, { status: 400 })

  // Remove from Radarr via Seerr's service proxy, then remove from Seerr
  await deleteFromService(movie.tmdbId)
  const ok = await deleteMedia(parseInt(movie.seerrMediaId, 10))
  return NextResponse.json({ ok })
}
