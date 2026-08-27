'use client'
import { Search, Play } from 'lucide-react'

interface FilterButton {
  label: string
  value: string
}

interface ExtraPill {
  label: string
  active: boolean
  onToggle: () => void
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  buttons: FilterButton[]
  activeButton: string | null
  onButtonChange: (value: string | null) => void
  extraPills?: ExtraPill[]
}

export function FilterBar({
  search,
  onSearchChange,
  buttons,
  activeButton,
  onButtonChange,
  extraPills,
}: FilterBarProps) {
  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search titles…"
          aria-label="Search titles"
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 sm:flex-wrap sm:overflow-visible">
        <button
          onClick={() => onButtonChange(null)}
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeButton === null
              ? 'border-transparent bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          All
        </button>
        {buttons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => onButtonChange(activeButton === btn.value ? null : btn.value)}
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeButton === btn.value
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {btn.label}
          </button>
        ))}
        {extraPills?.map((pill) => (
          <button
            key={pill.label}
            onClick={pill.onToggle}
            className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              pill.active
                ? 'border-transparent bg-success text-white'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Play className="w-2.5 h-2.5" fill="currentColor" aria-hidden="true" />
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}
