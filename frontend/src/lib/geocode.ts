import type { AddressResult } from '../types/sensitivity'

const BAN_SEARCH_URL = 'https://data.geopf.fr/geocodage/search'

/** Autocomplete / geocode a French address via the IGN Géoplateforme (BAN) API.
 * Public, no key, called directly from the browser (same endpoint used by
 * frontend/public/lyza-cartes.html). Returns [] on empty query or upstream
 * failure rather than throwing, so a flaky geocoder never breaks the
 * search-as-you-type UI. */
export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<AddressResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  let payload: { features?: unknown[] }
  try {
    const url = new URL(BAN_SEARCH_URL)
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '5')
    url.searchParams.set('autocomplete', '1')
    const response = await fetch(url.toString(), { signal })
    if (!response.ok) return []
    payload = await response.json()
  } catch {
    return []
  }

  const results: AddressResult[] = []
  for (const feature of payload.features ?? []) {
    if (!feature || typeof feature !== 'object') continue
    const f = feature as { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } }
    const props = f.properties ?? {}
    const coords = f.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length !== 2) continue
    const [lon, lat] = coords as [number, number]
    results.push({
      label: String(props.label ?? q),
      citycode: String(props.citycode ?? ''),
      postcode: String(props.postcode ?? ''),
      city: String(props.city ?? ''),
      lat,
      lon,
      score: typeof props.score === 'number' ? props.score : 0,
    })
  }
  return results
}
