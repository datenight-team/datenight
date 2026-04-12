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
  watchedAt?: string | null
  createdAt: string
  ratings?: Rating[]
}

export interface Rating {
  id: number
  movieId: number
  user: User
  rating: RatingValue
  quote: string
  submittedAt: string
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
