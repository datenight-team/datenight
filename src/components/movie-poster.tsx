import Image from 'next/image'
import { Clapperboard } from 'lucide-react'

interface MoviePosterProps {
  posterUrl: string | null | undefined
  title: string
  size: 'sm' | 'md' | 'lg'
}

const sizeConfig = {
  sm: {
    container: 'w-9 h-14 bg-muted rounded flex-shrink-0 overflow-hidden',
    imgWidth: 36,
    imgHeight: 56,
    iconClass: 'w-3.5 h-3.5 text-muted-foreground',
    fill: false as const,
  },
  md: {
    container: 'w-16 h-24 bg-muted rounded-lg flex-shrink-0 overflow-hidden',
    imgWidth: 64,
    imgHeight: 96,
    iconClass: 'w-6 h-6 text-muted-foreground',
    fill: false as const,
  },
  lg: {
    container: 'relative w-full aspect-[2/3] bg-muted',
    imgWidth: 0,  // unused — lg uses next/image fill mode, not explicit dimensions
    imgHeight: 0, // unused — lg uses next/image fill mode, not explicit dimensions
    iconClass: 'w-10 h-10 text-muted-foreground',
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
        <div className="w-full h-full flex items-center justify-center">
          <Clapperboard className={cfg.iconClass} aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
