// src/lib/user-utils.ts
// Pure client-safe utilities — no DB imports
import type { User } from '@/types'

export const USER_KEYS: User[] = ['user1', 'user2']

export function otherUser(user: User): User {
  return user === 'user1' ? 'user2' : 'user1'
}
