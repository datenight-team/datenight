// src/lib/users.ts
import { getConfig } from './config'
import type { User } from '@/types'

export { USER_KEYS, otherUser } from './user-utils'

export async function getUserNames(): Promise<Record<User, string>> {
  const config = await getConfig()
  return {
    user1: config.user1Name || 'User 1',
    user2: config.user2Name || 'User 2',
  }
}
