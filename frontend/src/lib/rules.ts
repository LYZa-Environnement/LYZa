/**
 * Pure classification rules — no network, easy to unit test and to recalibrate
 * independently from the API calls. Mirrors backend/app/rules.py (kept there
 * too, for any future offline/batch analysis with Python).
 */
import type { SensitivityLevel } from '../types/sensitivity'

// Un seul évènement recensé dans le rayon d'étude (souvent 1 km, en zone
// urbaine dense) n'est en général pas alarmant en soi — les seuils par
// défaut demandent une certaine concentration avant de passer en "modérée"
// ou "élevée", plutôt que de réagir à la première occurrence.
export function levelFromCount(count: number | null, seuilModeree = 3, seuilElevee = 8): SensitivityLevel {
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
 * flood-related catastrophe-naturelle decrees for the commune. A handful of
 * catnat decrees in a commune's entire history is close to the norm across
 * France (most communes have at least one), so that signal alone only
 * escalates past "faible" once it's unusually frequent; being inside a
 * mapped flood zone (AZI) is a more specific, site-level signal and is
 * enough on its own to flag "moderee". */
export function levelFromFloodSignals(inAzi: boolean | null, catnatInondationCount: number | null): SensitivityLevel {
  if (inAzi === null && catnatInondationCount === null) return 'indeterminee'
  const catnat = catnatInondationCount ?? 0
  if (inAzi && catnat >= 3) return 'elevee'
  if (inAzi) return 'moderee'
  if (catnat >= 5) return 'moderee'
  return 'faible'
}

export function worstLevel(levels: SensitivityLevel[]): SensitivityLevel {
  const order: Record<SensitivityLevel, number> = { indeterminee: 0, faible: 1, moderee: 2, elevee: 3 }
  const known = levels.filter((l) => l !== 'indeterminee')
  if (known.length === 0) return 'indeterminee'
  return known.reduce((worst, level) => (order[level] > order[worst] ? level : worst))
}
