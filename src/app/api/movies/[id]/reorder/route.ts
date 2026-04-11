// src/app/api/movies/[id]/reorder/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const id = parseInt(rawId, 10)
  const { newIndex } = await req.json()

  const movies = await prisma.movie.findMany({
    where: { status: 'watchlist' },
    orderBy: { sortOrder: 'asc' },
  })

  const oldIndex = movies.findIndex((m) => m.id === id)
  if (oldIndex === -1) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Reorder in memory
  const [moved] = movies.splice(oldIndex, 1)
  movies.splice(newIndex, 0, moved)

  // Persist new sort orders
  await Promise.all(
    movies.map((m, i) =>
      prisma.movie.update({ where: { id: m.id }, data: { sortOrder: i + 1 } })
    )
  )

  return NextResponse.json({ ok: true })
}
