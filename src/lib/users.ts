// src/lib/users.ts
// User identity for the two-person rating system.
// Internal keys (user1/user2) are stable and stored in the database.
// Display names are configured via USER1_NAME / USER2_NAME env vars.
import type { User } from '@/types'

export const USER_KEYS: User[] = ['user1', 'user2']

export function getUserNames(): Record<User, string> {
  return {
    user1: process.env.USER1_NAME?.trim() || 'User 1',
    user2: process.env.USER2_NAME?.trim() || 'User 2',
  }
}

export function otherUser(user: User): User {
  return user === 'user1' ? 'user2' : 'user1'
}
