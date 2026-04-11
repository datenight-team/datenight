import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '@/components/filter-bar'

const buttons = [
  { label: 'Ready', value: 'available' },
  { label: 'Queued', value: 'pending' },
]

describe('FilterBar', () => {
  it('renders search input with correct placeholder', () => {
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton={null} onButtonChange={() => {}} />
    )
    expect(screen.getByPlaceholderText('Search titles…')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Queued' })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    expect(onChange).toHaveBeenCalledWith('available')
  })

  it('toggles off when the active button is clicked again', () => {
    const onChange = vi.fn()
    render(
      <FilterBar search="" onSearchChange={() => {}} buttons={buttons} activeButton="available" onButtonChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
