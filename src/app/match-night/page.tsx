// src/app/match-night/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { MatchNightCard } from '@/components/match-night-card'
import { Button } from '@/components/ui/button'
import { USER_KEYS } from '@/lib/user-utils'
import type { SwipeCandidateRecord, SwipeVote, User } from '@/types'

export default function MatchNightPage() {
  const [userNames, setUserNames] = useState<Record<User, string>>({ user1: 'User 1', user2: 'User 2' })
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [candidate, setCandidate] = useState<SwipeCandidateRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    fetch('/api/user-names')
      .then((r) => r.json())
      .then(setUserNames)
      .catch(() => {})
  }, [])

  const loadNext = useCallback(async (user: User) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/match-night/next?user=${user}`)
      const data = await res.json()
      setCandidate(data.candidate)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectUser = (user: User) => {
    setCurrentUser(user)
    loadNext(user)
  }

  const handleVote = async (vote: SwipeVote) => {
    if (!currentUser || !candidate) return
    setVoting(true)
    try {
      await fetch('/api/match-night/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, user: currentUser, vote }),
      })
      await loadNext(currentUser)
    } finally {
      setVoting(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-amber-900 mb-6">Match Night 💕</h1>
        <p className="text-sm text-stone-600 mb-4">Who&apos;s swiping?</p>
        <div className="space-y-3">
          {USER_KEYS.map((user) => (
            <Button
              key={user}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => handleSelectUser(user)}
            >
              {userNames[user]}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-amber-900 mb-2 text-center">Match Night 💕</h1>
      <p className="text-xs text-stone-500 text-center mb-6">Swiping as {userNames[currentUser]}</p>

      {loading ? (
        <div className="text-center text-amber-600 mt-16 animate-pulse">Loading next film…</div>
      ) : candidate ? (
        <MatchNightCard candidate={candidate} voting={voting} onVote={handleVote} />
      ) : (
        <div className="text-center text-amber-600 mt-16">
          <div className="text-5xl mb-4">🎬</div>
          <p className="font-medium">You&apos;re all caught up!</p>
          <p className="text-sm text-amber-500 mt-1">Check back later for more films to swipe on.</p>
        </div>
      )}
    </div>
  )
}
