/**
 * Nearest "périmètre de protection éloignée" (drinking-water catchment
 * protection perimeter) to a point, and its associated captage reference.
 * Reuses the same static export already shipped for LYZa Cartes
 * (public/data/ppe.geojson, 14 179 perimeters, France entière — see
 * frontend/public/lyza-cartes.html) instead of duplicating the dataset.
 */

import { bearingDegrees, cardinalDirection, haversineMeters, pointToSegmentDistanceM } from './geo'

type Position = [number, number]

interface PpeFeature {
  type: 'Feature'
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  properties: Record<string, unknown>
  _bbox?: [number, number, number, number]
}

let ppeFeaturesPromise: Promise<PpeFeature[] | null> | null = null

function loadPpeFeatures(): Promise<PpeFeature[] | null> {
  if (!ppeFeaturesPromise) {
    ppeFeaturesPromise = fetch(`${import.meta.env.BASE_URL}data/ppe.geojson`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { features?: unknown[] } | null) => {
        if (!json || !Array.isArray(json.features)) return null
        const features = json.features as PpeFeature[]
        for (const feature of features) feature._bbox = computeBbox(feature.geometry)
        return features
      })
      .catch(() => null)
  }
  return ppeFeaturesPromise
}

function computeBbox(geometry: PpeFeature['geometry']): [number, number, number, number] {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  const walk = (coords: unknown, depth: number) => {
    if (depth === 0) {
      const [lon, lat] = coords as Position
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    } else if (Array.isArray(coords)) {
      for (const c of coords) walk(c, depth - 1)
    }
  }
  walk(geometry.coordinates, geometry.type === 'Polygon' ? 2 : 3)
  return [minLon, minLat, maxLon, maxLat]
}

function bboxDistanceM(lat: number, lon: number, bbox: [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const clampedLon = Math.min(Math.max(lon, minLon), maxLon)
  const clampedLat = Math.min(Math.max(lat, minLat), maxLat)
  return haversineMeters(lat, lon, clampedLat, clampedLon)
}

function ringsOf(geometry: PpeFeature['geometry']): Position[][] {
  return geometry.type === 'Polygon' ? (geometry.coordinates as Position[][]) : (geometry.coordinates as Position[][][]).flat()
}

function pointInRing(lat: number, lon: number, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function isInside(lat: number, lon: number, geometry: PpeFeature['geometry']): boolean {
  const rings = ringsOf(geometry)
  // First ring of each polygon is the exterior; holes aren't distinguished
  // here (PPE perimeters are essentially never donut-shaped) — good enough
  // for "is the site broadly within this perimeter".
  return rings.length > 0 && pointInRing(lat, lon, rings[0])
}

function minDistanceToBoundaryM(lat: number, lon: number, geometry: PpeFeature['geometry']): number {
  let min = Infinity
  for (const ring of ringsOf(geometry)) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i]
      const [lon2, lat2] = ring[i + 1]
      const d = pointToSegmentDistanceM(lat, lon, lat1, lon1, lat2, lon2)
      if (d < min) min = d
    }
  }
  return min
}

function centroidOf(geometry: PpeFeature['geometry']): Position | null {
  const ring = ringsOf(geometry)[0]
  if (!ring || ring.length === 0) return null
  let sumLon = 0
  let sumLat = 0
  for (const [lon, lat] of ring) {
    sumLon += lon
    sumLat += lat
  }
  return [sumLon / ring.length, sumLat / ring.length]
}

// Only precise-check the N candidates whose bounding box is nearest —
// checking full polygon boundaries for all ~14k features on every search
// would be needlessly slow.
const CANDIDATE_COUNT = 25

export interface NearestPpe {
  distanceM: number
  inside: boolean
  direction: string | null
  codePp: string | null
  captageRef: string | null
  etatProcedure: string | null
  adesUrl: string | null
}

export async function findNearestPpe(lat: number, lon: number): Promise<NearestPpe | null> {
  const features = await loadPpeFeatures()
  if (!features) return null

  const candidates = features
    .map((feature) => ({ feature, bboxDist: feature._bbox ? bboxDistanceM(lat, lon, feature._bbox) : Infinity }))
    .sort((a, b) => a.bboxDist - b.bboxDist)
    .slice(0, CANDIDATE_COUNT)

  let best: { feature: PpeFeature; distanceM: number; inside: boolean } | null = null
  for (const { feature } of candidates) {
    const inside = isInside(lat, lon, feature.geometry)
    const distanceM = inside ? 0 : minDistanceToBoundaryM(lat, lon, feature.geometry)
    if (!best || distanceM < best.distanceM) best = { feature, distanceM, inside }
  }
  if (!best) return null

  const props = best.feature.properties
  const captageRef = typeof props.ins_cap_ref === 'string' && props.ins_cap_ref ? props.ins_cap_ref : null
  const centroid = centroidOf(best.feature.geometry)
  const direction = best.inside || !centroid ? null : cardinalDirection(bearingDegrees(lat, lon, centroid[1], centroid[0]))

  return {
    distanceM: best.distanceM,
    inside: best.inside,
    direction,
    codePp: typeof props.code_pp === 'string' ? props.code_pp : null,
    captageRef,
    etatProcedure: typeof props.ins_pro_etat_lib === 'string' ? props.ins_pro_etat_lib : null,
    // Best-effort: reuses the ADES fiche URL pattern already proven in
    // lyza-cartes.html's adesUrl(), on the assumption ins_cap_ref is a BSS-
    // style code. Not confirmed for captages that are surface intakes
    // rather than boreholes — may 404 for those. Low-stakes if wrong: it's
    // a supplementary link, not something the rest of the page depends on.
    adesUrl: captageRef ? `https://ades.eaufrance.fr/Fiche/PtEau?Code=${encodeURIComponent(captageRef.split('/')[0])}` : null,
  }
}
