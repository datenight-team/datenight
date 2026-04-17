// src/lib/plex.ts
import { getConfig } from './config'

const jsonHeaders = {
  Accept: 'application/json',
  'X-Plex-Client-Identifier': 'datenight',
  'X-Plex-Product': 'DateNight',
  'X-Plex-Version': '1.0.0',
  'X-Plex-Platform': 'Node.js',
}

function plexUrl(base: string, token: string, path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, 'X-Plex-Token': token })
  return `${base}${path}?${q}`
}

export async function getMachineIdentifier(): Promise<string> {
  const { plexUrl: base, plexToken: token } = await getConfig()
  const res = await fetch(plexUrl(base, token, '/identity'), { headers: jsonHeaders })
  const data = await res.json()
  return data.MediaContainer.machineIdentifier as string
}

export async function findMovieLibrarySectionId(): Promise<string | null> {
  const { plexUrl: base, plexToken: token } = await getConfig()
  const res = await fetch(plexUrl(base, token, '/library/sections'), { headers: jsonHeaders })
  if (!res.ok) return null
  const data = await res.json()
  const sections = (data.MediaContainer?.Directory ?? []) as Array<{
    type: string
    key: string
    title: string
  }>
  const movies = sections.filter((s) => s.type === 'movie')
  return (
    movies.find((s) => s.title.toLowerCase() === 'movies')?.key ??
    movies[0]?.key ??
    null
  )
}

export async function findMovieRatingKey(
  sectionId: string,
  title: string,
  year: number
): Promise<string | null> {
  const { plexUrl: base, plexToken: token } = await getConfig()
  try {
    const res = await fetch(
      plexUrl(base, token, `/library/sections/${sectionId}/search`, { query: title, type: '1' }),
      { headers: jsonHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    const results = (data.MediaContainer?.Metadata ?? []) as Array<{
      ratingKey: string
      title: string
      year: number
    }>
    return results.find((m) => m.year === year)?.ratingKey ?? null
  } catch {
    return null
  }
}

async function findCollection(
  base: string,
  token: string,
  sectionId: string,
  title: string
): Promise<string | null> {
  const res = await fetch(
    plexUrl(base, token, `/library/sections/${sectionId}/collections`),
    { headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  const list = (data.MediaContainer?.Metadata ?? []) as Array<{
    title: string
    ratingKey: string
  }>
  return list.find((c) => c.title === title)?.ratingKey ?? null
}

async function deleteCollection(base: string, token: string, collectionKey: string): Promise<void> {
  await fetch(plexUrl(base, token, `/library/collections/${collectionKey}`), {
    method: 'DELETE',
    headers: jsonHeaders,
  })
}

async function createCollection(
  base: string,
  token: string,
  title: string,
  sectionId: string,
  machineId: string,
  ratingKeys: string[]
): Promise<string | null> {
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKeys.join(',')}`
  const res = await fetch(
    plexUrl(base, token, '/library/collections', {
      type: '1',
      title,
      sectionId,
      uri,
    }),
    { method: 'POST', headers: jsonHeaders }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.MediaContainer?.Metadata?.[0]?.ratingKey ?? null
}

export async function syncDateNightCollection(
  movies: Array<{ title: string; year: number }>
): Promise<void> {
  if (movies.length === 0) return

  const { plexUrl: base, plexToken: token } = await getConfig()

  const [machineId, sectionId] = await Promise.all([
    getMachineIdentifier(),
    findMovieLibrarySectionId(),
  ])

  if (!sectionId) return

  const ratingKeys = (
    await Promise.all(movies.map((m) => findMovieRatingKey(sectionId, m.title, m.year)))
  ).filter((k): k is string => k !== null)

  if (ratingKeys.length === 0) return

  const existingKey = await findCollection(base, token, sectionId, 'Date Night')
  if (existingKey) {
    await deleteCollection(base, token, existingKey)
  }

  await createCollection(base, token, 'Date Night', sectionId, machineId, ratingKeys)
}
