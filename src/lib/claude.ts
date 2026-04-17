// src/lib/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from './config'

export async function getAnthropic(): Promise<Anthropic> {
  const { anthropicApiKey } = await getConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}
