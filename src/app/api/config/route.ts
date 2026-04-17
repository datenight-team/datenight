// src/app/api/config/route.ts
import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { seerrPublicUrl } = await getConfig()
  return NextResponse.json({
    seerrUrl: seerrPublicUrl || null,
  })
}
