// src/lib/config.ts
import { prisma } from './db'

export interface AppConfig {
  user1Name: string
  user2Name: string
  tmdbApiKey: string
  seerrUrl: string
  seerrPublicUrl: string
  seerrApiKey: string
  seerrConcurrency: string
  plexUrl: string
  plexToken: string
  anthropicApiKey: string
  streamingRegion: string
  streamingServices: string
}

const DEFAULTS: AppConfig = {
  user1Name: 'User 1',
  user2Name: 'User 2',
  tmdbApiKey: '',
  seerrUrl: '',
  seerrPublicUrl: '',
  seerrApiKey: '',
  seerrConcurrency: '',
  plexUrl: '',
  plexToken: '',
  anthropicApiKey: '',
  streamingRegion: 'US',
  streamingServices: '[]',
}

const KEY_MAP: Record<keyof AppConfig, string> = {
  user1Name: 'user1_name',
  user2Name: 'user2_name',
  tmdbApiKey: 'tmdb_api_key',
  seerrUrl: 'seerr_url',
  seerrPublicUrl: 'seerr_public_url',
  seerrApiKey: 'seerr_api_key',
  seerrConcurrency: 'seerr_concurrency',
  plexUrl: 'plex_url',
  plexToken: 'plex_token',
  anthropicApiKey: 'anthropic_api_key',
  streamingRegion: 'streaming_region',
  streamingServices: 'streaming_services',
}

const DB_TO_CONFIG = Object.fromEntries(
  Object.entries(KEY_MAP).map(([configKey, dbKey]) => [dbKey, configKey as keyof AppConfig])
) as Record<string, keyof AppConfig>

export const ALL_DB_KEYS = Object.values(KEY_MAP)

export async function getConfig(): Promise<AppConfig> {
  const rows = await prisma.setting.findMany()
  const config = { ...DEFAULTS }
  for (const row of rows) {
    const configKey = DB_TO_CONFIG[row.key]
    if (configKey) {
      config[configKey] = row.value
    }
  }
  return config
}
