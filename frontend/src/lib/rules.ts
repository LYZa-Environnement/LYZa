/**
 * Pure classification rules — no network, easy to unit test and to recalibrate
 * independently from the API calls. Mirrors backend/app/rules.py (kept there
 * too, for any future offline/batch analysis with Python).
 */
import type { SensitivityLevel } from '../types/sensitivity'

export function levelFromCount(count: number | null, seuilModeree = 1, seuilElevee = 4): SensitivityLevel {
  if (count === null) return 'indeterminee'
  if (count >= seuilElevee) return 'elevee'
  if (count >= seuilModeree) return 'moderee'
  return 'faible'
}

/** Sites et sols pollués (ex-BASOL) are confirmed/suspected pollution cases,
 * so even one nearby is treated as a high-vigilance signal. */
export function levelFromSsp(count: number | null): SensitivityLevel {
  if (count === null) return 'indeterminee'
  return count >= 1 ? 'elevee' : 'faible'
}

/** Official seismic zoning: 1 très faible ... 5 fort. */
export function levelFromZonageSismique(zone: number | null): SensitivityLevel {
  if (zone === null) return 'indeterminee'
  if (zone <= 2) return 'faible'
  if (zone === 3) return 'moderee'
  return 'elevee'
}

/** Official retrait-gonflement des argiles exposure classes. */
export function levelFromArgiles(exposition: string | null): SensitivityLevel {
  if (!exposition) return 'indeterminee'
  const normalized = exposition.trim().toLowerCase()
  const mapping: Record<string, SensitivityLevel> = {
    faible: 'faible',
    moyen: 'moderee',
    moyenne: 'moderee',
    fort: 'elevee',
    forte: 'elevee',
  }
  return mapping[normalized] ?? 'indeterminee'
}

/** Official radon potential class: 1 (faible) to 3 (élevé). */
export function levelFromRadon(classe: number | null): SensitivityLevel {
  if (classe === null) return 'indeterminee'
  if (classe <= 1) return 'faible'
  if (classe === 2) return 'moderee'
  return 'elevee'
}

/** Combine "inside a known flood-prone zone" with the history of
 * flood-related catastrophe-naturelle decrees for the commune. */
export function levelFromFloodSignals(inAzi: boolean | null, catnatInondationCount: number | null): SensitivityLevel {
  if (inAzi === null && catnatInondationCount === null) return 'indeterminee'
  const catnat = catnatInondationCount ?? 0
  if (inAzi && catnat >= 1) return 'elevee'
  if (inAzi || catnat >= 3) return 'moderee'
  if (catnatInondationCount !== null && catnatInondationCount >= 1) return 'moderee'
  return 'faible'
}

export function worstLevel(levels: SensitivityLevel[]): SensitivityLevel {
  const order: Record<SensitivityLevel, number> = { indeterminee: 0, faible: 1, moderee: 2, elevee: 3 }
  const known = levels.filter((l) => l !== 'indeterminee')
  if (known.length === 0) return 'indeterminee'
  return known.reduce((worst, level) => (order[level] > order[worst] ? level : worst))
}
