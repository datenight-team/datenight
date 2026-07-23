// src/types/index.ts

export type MovieStatus = 'watchlist' | 'watched'

export type SeerrStatus =
  | 'not_requested'
  | 'pending'
  | 'processing'
  | 'available'
  | 'deleted'

export type User = 'user1' | 'user2'

export type RatingValue = 'up' | 'down'

export type SwipeSource = 'criterion' | 'tmdb'
export type SwipeStatus = 'pending' | 'dead' | 'matched'
export type SwipeVote = 'up' | 'down'

export interface StreamingProvider {
  id: number
  movieId: number
  providerId: number
  providerName: string
}

export interface Movie {
  id: number
  title: string
  year: number
  runtime: number
  description: string
  posterUrl: string
  imdbId: string
  tmdbId: number
  criterionUrl?: string | null
  imdbUrl?: string | null
  sortOrder: number
  status: MovieStatus
  seerrRequestId?: string | null
  seerrMediaId?: string | null
  seerrStatus: SeerrStatus
  watchedAt?: Date | string | null
  createdAt: Date | string
  streamingLastChecked?: Date | string | null
  streamingLink?: string | null
  matchedViaSwipe: boolean
  ratings?: Rating[]
  streamingProviders?: StreamingProvider[]
}

export interface Rating {
  id: number
  movieId: number
  user: User
  rating: RatingValue
  quote: string
  submittedAt: Date | string
}

export interface SwipeCandidateRecord {
  id: number
  tmdbId: number
  imdbId: string
  title: string
  year: number
  runtime: number
  description: string
  posterUrl: string
  source: SwipeSource
  status: SwipeStatus
  createdAt: Date | string
}

export interface Swipe {
  id: number
  candidateId: number
  user: User
  vote: SwipeVote
  swipedAt: Date | string
}

export interface TmdbMovieDetails {
  tmdbId: number
  title: string
  year: number
  runtime: number
  description: string
  posterUrl: string
  imdbId: string
}

export interface MoviePreview extends TmdbMovieDetails {
  criterionUrl?: string
  imdbUrl?: string
}
