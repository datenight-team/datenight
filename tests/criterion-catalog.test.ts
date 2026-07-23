import { describe, it, expect } from 'vitest'
import { getCriterionCatalog } from '@/lib/criterion-catalog'

describe('getCriterionCatalog', () => {
  it('returns a non-empty array of title entries', () => {
    const catalog = getCriterionCatalog()
    expect(Array.isArray(catalog)).toBe(true)
    expect(catalog.length).toBeGreaterThan(10)
  })

  it('every entry has a non-empty string title', () => {
    const catalog = getCriterionCatalog()
    for (const entry of catalog) {
      expect(typeof entry.title).toBe('string')
      expect(entry.title.length).toBeGreaterThan(0)
    }
  })

  it('every entry with a year has a plausible film year', () => {
    const catalog = getCriterionCatalog()
    for (const entry of catalog) {
      if (entry.year !== undefined) {
        expect(entry.year).toBeGreaterThan(1880)
        expect(entry.year).toBeLessThanOrEqual(new Date().getFullYear())
      }
    }
  })
})
