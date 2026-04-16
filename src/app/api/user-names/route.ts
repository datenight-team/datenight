// src/app/api/user-names/route.ts
import { NextResponse } from 'next/server'
import { getUserNames } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getUserNames())
}
