// src/app/api/streaming-providers/refresh/route.ts
import { NextResponse } from 'next/server'
import { refreshStaleProviders } from '@/lib/streaming'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await refreshStaleProviders()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[streaming] Manual refresh failed:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
