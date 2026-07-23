import catalog from '../../data/criterion-catalog.json'

export interface CriterionCatalogEntry {
  title: string
  year?: number
}

export function getCriterionCatalog(): CriterionCatalogEntry[] {
  return catalog as CriterionCatalogEntry[]
}
