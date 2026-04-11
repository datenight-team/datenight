// src/components/thumb-rating.tsx
'use client'
import type { RatingValue } from '@/types'

interface ThumbRatingProps {
  value?: RatingValue
  onChange?: (rating: RatingValue) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }

export function ThumbRating({ value, onChange, readonly = false, size = 'md' }: ThumbRatingProps) {
  const sz = sizes[size]

  if (readonly) {
    return (
      <span className={`${sz} leading-none`} title={value === 'up' ? 'Thumbs up' : 'Thumbs down'}>
        {value === 'up' ? '👍' : '👎'}
      </span>
    )
  }

  return (
    <div className="flex gap-3">
      {(['up', 'down'] as RatingValue[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange?.(v)}
          className={`${sz} leading-none transition-all duration-75 rounded-lg p-2 ${
            value === v
              ? 'bg-amber-100 ring-2 ring-amber-400 scale-110'
              : 'opacity-40 hover:opacity-80 hover:scale-105'
          }`}
          aria-label={v === 'up' ? 'Thumbs up' : 'Thumbs down'}
          aria-pressed={value === v}
        >
          {v === 'up' ? '👍' : '👎'}
        </button>
      ))}
    </div>
  )
}
