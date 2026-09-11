/**
 * Real distance to the nearest watercourse (not to the nearest water-quality
 * monitoring station, which can sit kilometres from the actual river and
 * silently overestimate proximity). Uses the IGN Géoplateforme WFS, via the
 * API Carto "wfs-geoportail" module that lets any Géoplateforme WFS layer be
 * intersected with an arbitrary geometry — verified against the live API
 * during development: `BDTOPO_V3:cours_d_eau` returns real MultiLineString
 * features with a `toponyme` property (e.g. checked over the Seine in Paris).
 */

import { bboxAround, bboxToPolygon, pointToSegmentDistanceM } from './geo'

const WFS_SEARCH_URL = 'https://apicarto.ign.fr/api/wfs-geoportail/search'
const COURS_D_EAU_SOURCE = 'BDTOPO_V3:cours_d_eau'

// Search a small area first (cheap, and the common case for the tight
// vulnerability thresholds this feeds into), widening only if nothing
// turns up — rivers are not evenly spaced, some sites are just far from any.
const SEARCH_RADII_M = [300, 1000, 3000, 8000]

interface GeoJsonFeature {
  type?: string
  properties?: Record<string, unknown>
  geometry?: { type?: string; coordinates?: unknown }
}

async function queryIntersecting(source: string, geometry: unknown, limit = 50): Promise<GeoJsonFeature[] | null> {
  try {
    const url = new URL(WFS_SEARCH_URL)
    url.searchParams.set('source', source)
    url.searchParams.set('geom', JSON.stringify(geometry))
    url.searchParams.set('_limit', String(limit))
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { type?: string; features?: GeoJsonFeature[] }
    if (json.type === 'FeatureCollection') return json.features ?? []
    if (json.type === 'Feature') return [json as GeoJsonFeature]
    return []
  } catch {
    return null
  }
}

function minDistanceToLineFeature(lat: number, lon: number, geometry: GeoJsonFeature['geometry']): number | null {
  if (!geometry?.type || !geometry.coordinates) return null
  const lines: [number, number][][] =
    geometry.type === 'LineString'
      ? [geometry.coordinates as [number, number][]]
      : geometry.type === 'MultiLineString'
        ? (geometry.coordinates as [number, number][][])
        : []
  let min = Infinity
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lon1, lat1] = line[i]
      const [lon2, lat2] = line[i + 1]
      const d = pointToSegmentDistanceM(lat, lon, lat1, lon1, lat2, lon2)
      if (d < min) min = d
    }
  }
  return Number.isFinite(min) ? min : null
}

export interface NearestRiverSegment {
  nom: string | null
  distanceM: number
}

/** Nearest point on any `cours_d_eau` line to (lat, lon), searching an
 * expanding area until something is found (or the largest radius is
 * exhausted). Returns null on upstream failure or if nothing is found at all
 * within SEARCH_RADII_M's largest radius. */
export async function findNearestRiverSegment(lat: number, lon: number): Promise<NearestRiverSegment | null> {
  for (const radius of SEARCH_RADII_M) {
    const polygon = bboxToPolygon(bboxAround(lat, lon, radius))
    const features = await queryIntersecting(COURS_D_EAU_SOURCE, polygon)
    if (features === null) return null // upstream failure — don't keep hammering it
    if (features.length === 0) continue

    let best: NearestRiverSegment | null = null
    for (const feature of features) {
      const distanceM = minDistanceToLineFeature(lat, lon, feature.geometry)
      if (distanceM === null) continue
      if (!best || distanceM < best.distanceM) {
        const toponyme = feature.properties?.toponyme
        best = { distanceM, nom: typeof toponyme === 'string' && toponyme.trim() ? toponyme.trim() : null }
      }
    }
    if (best) return best
  }
  return null
}
