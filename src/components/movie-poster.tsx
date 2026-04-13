// src/components/movie-poster.tsx
import Image from 'next/image'

interface MoviePosterProps {
  posterUrl: string | null | undefined
  title: string
  size: 'sm' | 'md' | 'lg'
}

const sizeConfig = {
  sm: {
    container: 'w-9 h-14 bg-amber-100 rounded flex-shrink-0 overflow-hidden',
    imgWidth: 36,
    imgHeight: 56,
    placeholder: 'text-amber-400 text-xs',
    fill: false as const,
  },
  md: {
    container: 'w-16 h-24 bg-amber-100 rounded-lg flex-shrink-0 overflow-hidden',
    imgWidth: 64,
    imgHeight: 96,
    placeholder: 'text-amber-300 text-2xl',
    fill: false as const,
  },
  lg: {
    container: 'relative w-full aspect-[2/3] bg-amber-100',
    imgWidth: 0,  // unused — lg uses next/image fill mode, not explicit dimensions
    imgHeight: 0, // unused — lg uses next/image fill mode, not explicit dimensions
    placeholder: 'text-amber-300 text-4xl',
    fill: true as const,
  },
}

export function MoviePoster({ posterUrl, title, size }: MoviePosterProps) {
  const cfg = sizeConfig[size]
  return (
    <div className={cfg.container}>
      {posterUrl ? (
        cfg.fill ? (
          <Image src={posterUrl} alt={title} fill className="object-cover" />
        ) : (
          <Image
            src={posterUrl}
            alt={title}
            width={cfg.imgWidth}
            height={cfg.imgHeight}
            className="object-cover w-full h-full"
          />
        )
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${cfg.placeholder}`}>
          🎥
        </div>
      )}
    </div>
  )
}
