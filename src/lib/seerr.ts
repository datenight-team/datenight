// src/lib/seerr.ts
import type { SeerrStatus } from '@/types'

function base() { return process.env.SEERR_URL }
function key() { return process.env.SEERR_API_KEY ?? '' }

function mapStatus(code: number | undefined): SeerrStatus {
  if (code === 5) return 'available'
  if (code === 3) return 'processing'
  if (code === 2) return 'pending'
  return 'not_requested'
}

export async function getMovieStatus(tmdbId: number): Promise<{
  status: SeerrStatus
  seerrMediaId?: number
  seerrRequestId?: number
}> {
  try {
    const res = await fetch(`${base()}/api/v1/movie/${tmdbId}`, {
      headers: { 'X-Api-Key': key() },
    })
    if (!res.ok) return { status: 'not_requested' }
    const data = await res.json()
    const media = data.mediaInfo
    return {
      status: mapStatus(media?.status),
      seerrMediaId: media?.id,
      seerrRequestId: media?.requests?.[0]?.id,
    }
  } catch {
    return { status: 'not_requested' }
  }
}

export async function requestMovie(
  tmdbId: number
): Promise<{ requestId: string } | null> {
  try {
    const res = await fetch(`${base()}/api/v1/request`, {
      method: 'POST',
      headers: { 'X-Api-Key': key(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'movie', mediaId: tmdbId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { requestId: String(data.id) }
  } catch {
    return null
  }
}

export async function deleteMedia(seerrMediaId: number): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/api/v1/media/${seerrMediaId}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': key() },
    })
    return res.ok
  } catch {
    return false
  }
}
