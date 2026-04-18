// src/components/filter-bar.tsx
'use client'

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
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search titles…"
        aria-label="Search titles"
        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onButtonChange(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeButton === null
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
          }`}
        >
          All
        </button>
        {buttons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => onButtonChange(activeButton === btn.value ? null : btn.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeButton === btn.value
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            {btn.label}
          </button>
        ))}
        {extraPills?.map((pill) => (
          <button
            key={pill.label}
            onClick={pill.onToggle}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              pill.active
                ? 'border-green-500 bg-green-500 text-white'
                : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}
