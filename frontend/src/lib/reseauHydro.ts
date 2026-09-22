/**
 * The watercourse nearest a site, assembled as a single polyline ordered
 * from upstream to downstream — so anything else nearby can be placed
 * *amont* or *aval* of the site, not merely "500 m au nord".
 *
 * Source: IGN BD TOPO® `BDTOPO_V3:troncon_hydrographique`, queried through
 * API Carto's wfs-geoportail module (the same access path hydrography.ts
 * already uses for `cours_d_eau`). This layer is used rather than
 * `cours_d_eau` because it carries `sens_de_l_ecoulement` — verified live
 * over the Loire basin: "Sens direct" (flow follows the digitised vertex
 * order), "Sens inverse" (flow runs against it), or an indeterminate value
 * for standing/ambiguous water. Without that attribute there is no honest
 * way to tell upstream from downstream, and the rubriques say so instead of
 * guessing.
 */

import { bboxAround, bboxToPolygon, bearingDegrees, cardinalDirection, haversineMeters, nearestPointOnSegment } from './geo'

const WFS_SEARCH_URL = 'https://apicarto.ign.fr/api/wfs-geoportail/search'
const SOURCE = 'BDTOPO_V3:troncon_hydrographique'
const SEARCH_RADII_M = [500, 2000, 6000]

type Position = [number, number]

interface Troncon {
  path: Position[]
  coursDEau: string | null
  nom: string | null
  flowKnown: boolean
}

export interface ReseauHydro {
  /** Upstream-to-downstream ordered path, in [lat, lon] for Leaflet. */
  path: [number, number][]
  nom: string | null
  /** Shortest distance from the site to the watercourse, in metres. */
  distanceM: number
  direction: string
  /** False when BD TOPO gives no usable flow direction here — callers must
   * then omit any amont/aval wording rather than assume one. */
  flowKnown: boolean
  /** Distance along the ordered path at which the site projects. */
  siteOffsetM: number
  /** Total length of the assembled path. */
  longueurM: number
}

function reverse(path: Position[]): Position[] {
  return [...path].reverse()
}

async function queryTroncons(lat: number, lon: number, radiusM: number): Promise<Troncon[] | null> {
  try {
    const url = new URL(WFS_SEARCH_URL)
    url.searchParams.set('source', SOURCE)
    url.searchParams.set('geom', JSON.stringify(bboxToPolygon(bboxAround(lat, lon, radiusM))))
    url.searchParams.set('_limit', '200')
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { features?: { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }[] }
    const out: Troncon[] = []
    for (const feature of json.features ?? []) {
      const geometry = feature.geometry
      if (!geometry?.coordinates) continue
      const lines: Position[][] =
        geometry.type === 'LineString'
          ? [(geometry.coordinates as number[][]).map((c) => [c[0], c[1]] as Position)]
          : geometry.type === 'MultiLineString'
            ? (geometry.coordinates as number[][][]).map((line) => line.map((c) => [c[0], c[1]] as Position))
            : []
      const props = feature.properties ?? {}
      const sens = String(props.sens_de_l_ecoulement ?? '')
      const flowKnown = sens === 'Sens direct' || sens === 'Sens inverse'
      for (const line of lines) {
        if (line.length < 2) continue
        out.push({
          path: sens === 'Sens inverse' ? reverse(line) : line,
          coursDEau: typeof props.liens_vers_cours_d_eau === 'string' ? props.liens_vers_cours_d_eau : null,
          nom: typeof props.toponyme === 'string' && props.toponyme.trim() ? props.toponyme.trim() : null,
          flowKnown,
        })
      }
    }
    return out
  } catch {
    return null
  }
}

function projectOnPath(lat: number, lon: number, path: Position[]): { distanceM: number; offsetM: number; lat: number; lon: number } | null {
  let travelled = 0
  let best: { distanceM: number; offsetM: number; lat: number; lon: number } | null = null
  for (let i = 0; i < path.length - 1; i++) {
    const [lon1, lat1] = path[i]
    const [lon2, lat2] = path[i + 1]
    const segmentLength = haversineMeters(lat1, lon1, lat2, lon2)
    const nearest = nearestPointOnSegment(lat, lon, lat1, lon1, lat2, lon2)
    if (!best || nearest.distanceM < best.distanceM) {
      const alongSegment = haversineMeters(lat1, lon1, nearest.lat, nearest.lon)
      best = { distanceM: nearest.distanceM, offsetM: travelled + alongSegment, lat: nearest.lat, lon: nearest.lon }
    }
    travelled += segmentLength
  }
  return best
}

/** Greedy end-to-end chaining of the tronçons of one watercourse: repeatedly
 * append whichever remaining tronçon starts closest to the current chain's
 * downstream end. Each tronçon is already oriented upstream-to-downstream, so
 * the assembled chain is too. */
function chain(troncons: Troncon[]): Position[] {
  if (troncons.length === 0) return []
  const remaining = [...troncons]
  let current = remaining.shift()!
  let path = [...current.path]

  while (remaining.length > 0) {
    const tail = path[path.length - 1]
    let bestIndex = -1
    let bestGap = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const head = remaining[i].path[0]
      const gap = haversineMeters(tail[1], tail[0], head[1], head[0])
      if (gap < bestGap) {
        bestGap = gap
        bestIndex = i
      }
    }
    // A gap wider than a BD TOPO vertex tolerance means the next tronçon is
    // on a different branch (or past a confluence), not a continuation.
    if (bestIndex === -1 || bestGap > 60) break
    current = remaining.splice(bestIndex, 1)[0]
    path = path.concat(current.path.slice(1))
  }
  return path
}

export async function findReseauHydro(lat: number, lon: number): Promise<ReseauHydro | null> {
  for (const radius of SEARCH_RADII_M) {
    const troncons = await queryTroncons(lat, lon, radius)
    if (troncons === null) return null
    if (troncons.length === 0) continue

    let nearest: { troncon: Troncon; distanceM: number } | null = null
    for (const troncon of troncons) {
      const projection = projectOnPath(lat, lon, troncon.path)
      if (!projection) continue
      if (!nearest || projection.distanceM < nearest.distanceM) nearest = { troncon, distanceM: projection.distanceM }
    }
    if (!nearest) continue

    const sameCourse = nearest.troncon.coursDEau
      ? troncons.filter((t) => t.coursDEau === nearest!.troncon.coursDEau)
      : [nearest.troncon]
    // Start the chain from the tronçon carrying the site, so the assembled
    // path runs through the site's own reach rather than a parallel branch.
    const ordered = [nearest.troncon, ...sameCourse.filter((t) => t !== nearest!.troncon)]
    const path = chain(ordered)
    const projection = projectOnPath(lat, lon, path)
    if (!projection) continue

    let longueurM = 0
    for (let i = 0; i < path.length - 1; i++) longueurM += haversineMeters(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0])

    return {
      path: path.map(([plon, plat]) => [plat, plon] as [number, number]),
      nom: nearest.troncon.nom ?? sameCourse.find((t) => t.nom)?.nom ?? null,
      distanceM: projection.distanceM,
      direction: cardinalDirection(bearingDegrees(lat, lon, projection.lat, projection.lon)),
      flowKnown: nearest.troncon.flowKnown,
      siteOffsetM: projection.offsetM,
      longueurM,
    }
  }
  return null
}

export type PositionRelative = 'amont' | 'aval' | 'inconnue'

/** Where a point sits relative to the site along the watercourse. Returns
 * 'inconnue' when flow direction is unknown, when the point projects too far
 * from the network to be on it, or when the two projections are too close
 * together for the ordering to mean anything. */
export function positionRelative(reseau: ReseauHydro, lat: number, lon: number): PositionRelative {
  if (!reseau.flowKnown) return 'inconnue'
  const path: Position[] = reseau.path.map(([plat, plon]) => [plon, plat] as Position)
  const projection = projectOnPath(lat, lon, path)
  if (!projection) return 'inconnue'
  const delta = projection.offsetM - reseau.siteOffsetM
  if (Math.abs(delta) < 50) return 'inconnue'
  return delta > 0 ? 'aval' : 'amont'
}

export function positionLabel(position: PositionRelative): string {
  if (position === 'amont') return 'en amont hydraulique du site'
  if (position === 'aval') return 'en aval hydraulique du site'
  return ''
}
