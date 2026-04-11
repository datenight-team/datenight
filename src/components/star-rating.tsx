// src/components/star-rating.tsx
'use client'
import { useState } from 'react'

interface StarRatingProps {
  value?: number
  onChange?: (stars: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StarRating({
  value = 0,
  onChange,
  readonly = false,
  size = 'md',
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  const sizeClass = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }[size]

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${sizeClass} transition-all duration-75 ${
            star <= (hovered || value)
              ? 'text-amber-500'
              : 'text-amber-200'
          } ${
            readonly
              ? 'cursor-default'
              : 'cursor-pointer hover:scale-110 hover:text-amber-400'
          }`}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => !readonly && onChange?.(star)}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
