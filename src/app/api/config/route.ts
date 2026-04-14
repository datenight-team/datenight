// src/app/api/config/route.ts
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    seerrUrl: process.env.NEXT_PUBLIC_SEERR_URL || null,
  })
}
