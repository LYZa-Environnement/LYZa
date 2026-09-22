import { cardinalPhraseFr, formatDistance } from '../lib/geo'
import { positionLabel, positionRelative, type ReseauHydro } from '../lib/reseauHydro'

/** "à 320 m au nord-est du site" — every feature this platform reports gets
 * its distance AND its direction, never one without the other. */
export function situation(distanceM: number, direction: string | null): string {
  const distance = `à ${formatDistance(distanceM)}`
  return direction ? `${distance} ${cardinalPhraseFr(direction)} du site` : `${distance} du site`
}

/** Same, plus the upstream/downstream reading when the watercourse network
 * gives a usable flow direction — silently omitted when it doesn't. */
export function situationHydro(distanceM: number, direction: string | null, reseau: ReseauHydro | null, lat: number, lon: number): string {
  const base = situation(distanceM, direction)
  if (!reseau) return base
  const label = positionLabel(positionRelative(reseau, lat, lon))
  return label ? `${base}, ${label}` : base
}

/** The default plural only appends an "s", which is right for a single word
 * and wrong for a noun phrase ("installation classée" needs both words
 * inflected) — pass `plural` explicitly for anything longer than one word. */
export function pluriel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/** How long any single source gets before a rubrique gives up on it. Some of
 * these queries are genuinely slow (paginated national exports, WFS over
 * large polygon layers), hence the generous budget — but a source that never
 * answers at all must not leave the rubrique spinning. */
const DELAI_MAX_MS = 25000

/** Guards every upstream call so one unavailable source degrades to "donnée
 * indisponible" instead of taking the whole rubrique down.
 *
 * The timeout matters as much as the catch: the rubriques fire their sources
 * in parallel and await them together, so a single request left hanging by an
 * unresponsive service — no error, no response — would otherwise block the
 * whole section indefinitely. */
export async function safe<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DELAI_MAX_MS)
  })
  try {
    return await Promise.race([promise, expiry])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
