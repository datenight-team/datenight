// tests/filter-bar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '@/components/filter-bar'

const buttons = [
  { label: 'Not Requested', value: 'not_requested' },
  { label: 'Ready', value: 'available' },
]

describe('FilterBar', () => {
  it('renders search input and status pills', () => {
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Search titles…')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Not Requested')).toBeInTheDocument()
  })

  it('calls onSearchChange when typing', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={onChange} buttons={buttons} activeButton={null} onButtonChange={() => {}} />
    )
    fireEvent.change(screen.getByPlaceholderText('Search titles…'), { target: { value: 'akira' } })
    expect(onChange).toHaveBeenCalledWith('akira')
  })

  it('renders All button plus provided buttons', () => {
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton={null} onButtonChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not Requested' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument()
  })

  it('calls onButtonChange with null when All is clicked', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton="available" onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onButtonChange with button value when a button is clicked', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton={null} onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Not Requested' }))
    expect(onChange).toHaveBeenCalledWith('not_requested')
  })

  it('toggles off when the active button is clicked again', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton="available" onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders extraPills in the same pill row as status buttons', () => {
    const onToggle = vi.fn()
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
        extraPills={[{ label: '▶ Streamable', active: false, onToggle }]}
      />
    )
    const streamablePill = screen.getByText('▶ Streamable')
    expect(streamablePill).toBeInTheDocument()
    expect(streamablePill.closest('div')).toBe(
      screen.getByText('All').closest('div')
    )
  })

  it('calls onToggle when an extraPill is clicked', () => {
    const onToggle = vi.fn()
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
        extraPills={[{ label: '▶ Streamable', active: false, onToggle }]}
      />
    )
    fireEvent.click(screen.getByText('▶ Streamable'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('applies active styles when an extraPill is active', () => {
    render(
      <FilterBar
        search=""
        onSearchChange={vi.fn()}
        buttons={buttons}
        activeButton={null}
        onButtonChange={vi.fn()}
        extraPills={[{ label: '▶ Streamable', active: true, onToggle: vi.fn() }]}
      />
    )
    expect(screen.getByText('▶ Streamable')).toHaveClass('bg-green-500')
  })
})
