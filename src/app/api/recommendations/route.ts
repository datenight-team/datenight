// src/app/api/recommendations/route.ts
import { NextResponse } from 'next/server'
import { getRecommendations } from '@/lib/recommendations'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const criterionOnly: boolean = body?.criterionOnly === true

  try {
    const result = await getRecommendations(criterionOnly)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not configured') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
