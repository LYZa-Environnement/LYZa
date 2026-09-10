export type SensitivityLevel = 'faible' | 'moderee' | 'elevee' | 'indeterminee'

export interface AddressResult {
  label: string
  citycode: string
  postcode: string
  city: string
  lat: number
  lon: number
  score: number
}

export interface ThemeItem {
  label: string
  detail: string
  source: string
  /** Link to an official fiche/page (Géorisques...) when one is available. */
  href?: string
}

export interface ThemeSynthesis {
  key: string
  titre: string
  niveau: SensitivityLevel
  resume: string
  items: ThemeItem[]
  donnees_manquantes: string[]
}

export interface SensitivityReport {
  address: AddressResult
  rayon_metres: number
  genere_le: string
  themes: ThemeSynthesis[]
  niveau_global: SensitivityLevel
  avertissement: string
}

export const LEVEL_LABELS: Record<SensitivityLevel, string> = {
  faible: 'Faible',
  moderee: 'Modérée',
  elevee: 'Élevée',
  indeterminee: 'Non déterminée',
}
