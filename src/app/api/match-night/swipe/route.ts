// src/app/api/match-night/swipe/route.ts
import { NextResponse } from 'next/server'
import { recordSwipe } from '@/lib/match-night'
import { USER_KEYS } from '@/lib/user-utils'
import type { SwipeVote, User } from '@/types'

interface SwipeBody {
  candidateId?: number
  user?: User
  vote?: SwipeVote
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SwipeBody

  if (!body.candidateId || !USER_KEYS.includes(body.user as User)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 422 })
  }
  if (body.vote !== 'up' && body.vote !== 'down') {
    return NextResponse.json({ error: 'vote must be "up" or "down"' }, { status: 422 })
  }

  const result = await recordSwipe(body.candidateId, body.user as User, body.vote)
  return NextResponse.json(result)
}
