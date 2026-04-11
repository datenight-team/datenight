// src/app/api/user-names/route.ts
// Returns the configured display names for both users.
// Client components that need names fetch this once on mount.
import { NextResponse } from 'next/server'
import { getUserNames } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getUserNames())
}
