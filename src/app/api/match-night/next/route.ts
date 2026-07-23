// src/app/api/match-night/next/route.ts
import { NextResponse } from 'next/server'
import { getNextCandidateForUser } from '@/lib/match-night'
import { USER_KEYS } from '@/lib/user-utils'
import type { User } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const user = searchParams.get('user')
  if (!USER_KEYS.includes(user as User)) {
    return NextResponse.json({ error: 'invalid user' }, { status: 422 })
  }

  const candidate = await getNextCandidateForUser(user as User)
  return NextResponse.json({ candidate })
}
