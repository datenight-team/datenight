// src/app/api/streaming-providers/route.ts
import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { fetchProviderList } from '@/lib/tmdb'
import { downloadProviderLogo } from '@/lib/streaming'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const regionParam = searchParams.get('region')
  const { streamingRegion } = await getConfig()
  const region = regionParam || streamingRegion || 'US'

  const providers = await fetchProviderList(region)

  providers.forEach((p) => {
    downloadProviderLogo(p.providerId, p.logoPath).catch(() => {})
  })

  return NextResponse.json(providers)
}
