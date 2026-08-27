// src/components/thumb-rating.tsx
'use client'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RatingValue } from '@/types'

interface ThumbRatingProps {
  value?: RatingValue
  onChange?: (rating: RatingValue) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-9 h-9' }

export function ThumbRating({ value, onChange, readonly = false, size = 'md' }: ThumbRatingProps) {
  const sz = sizes[size]

  if (readonly) {
    return (
      <span
        className={cn(value === 'up' ? 'text-success' : 'text-rose')}
        title={value === 'up' ? 'Thumbs up' : 'Thumbs down'}
      >
        {value === 'up' ? <ThumbsUp className={sz} /> : <ThumbsDown className={sz} />}
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
          className={cn(
            'transition-all duration-75 rounded-lg p-2',
            value === v
              ? v === 'up' ? 'bg-success-bg text-success ring-2 ring-success scale-110' : 'bg-rose-bg text-rose ring-2 ring-rose scale-110'
              : 'text-muted-foreground opacity-40 hover:opacity-80 hover:scale-105'
          )}
          aria-label={v === 'up' ? 'Thumbs up' : 'Thumbs down'}
          aria-pressed={value === v}
        >
          {v === 'up' ? <ThumbsUp className={sz} /> : <ThumbsDown className={sz} />}
        </button>
      ))}
    </div>
  )
}
