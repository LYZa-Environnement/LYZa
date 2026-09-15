/** Small geometry helpers — no dependency, used to turn "nearest station" API
 * results into an actual distance-to-site figure. */

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface Bbox {
  west: number
  south: number
  east: number
  north: number
}

export function bboxAround(lat: number, lon: number, radiusMeters: number): Bbox {
  const dLat = radiusMeters / 111320
  const dLon = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  return { west: lon - dLon, south: lat - dLat, east: lon + dLon, north: lat + dLat }
}

export function bboxParam(bbox: Bbox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
}

/** A rectangular GeoJSON Polygon covering a bbox — for WFS "intersects" queries. */
export function bboxToPolygon(bbox: Bbox): { type: 'Polygon'; coordinates: number[][][] } {
  const { west, south, east, north } = bbox
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  }
}

/** Shortest distance (metres) from a point to a line segment, via a local
 * equirectangular projection centred on the point — accurate enough at the
 * few-kilometre scale this tool works at, no need for true geodesics. */
export function pointToSegmentDistanceM(lat: number, lon: number, lat1: number, lon1: number, lat2: number, lon2: number): number {
  return nearestPointOnSegment(lat, lon, lat1, lon1, lat2, lon2).distanceM
}

/** Same computation as `pointToSegmentDistanceM`, but also returns the
 * lat/lon of the closest point on the segment — needed to give a cardinal
 * direction to a line feature (e.g. a river), not just its distance. */
export function nearestPointOnSegment(
  lat: number,
  lon: number,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): { lat: number; lon: number; distanceM: number } {
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180)
  const x1 = (lon1 - lon) * mPerDegLon
  const y1 = (lat1 - lat) * mPerDegLat
  const x2 = (lon2 - lon) * mPerDegLon
  const y2 = (lat2 - lat) * mPerDegLat
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  let t = 0
  if (lengthSq !== 0) {
    t = (-x1 * dx - y1 * dy) / lengthSq
    t = Math.max(0, Math.min(1, t))
  }
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return {
    lat: lat + projY / mPerDegLat,
    lon: lon + projX / mPerDegLon,
    distanceM: Math.hypot(projX, projY),
  }
}

export function formatDistance(meters: number): string {
  if (meters >= 10000) return `${Math.round(meters / 1000)} km`
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters / 10) * 10} m`
}

/** Bearing in degrees (0-360, 0 = north) from point 1 to point 2. */
export function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}

const CARDINAL_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

/** 8-point French cardinal direction (N, NE, E, SE, S, SO, O, NO) from a bearing. */
export function cardinalDirection(bearing: number): string {
  const index = Math.round(bearing / 45) % 8
  return CARDINAL_LABELS[index]
}

const CARDINAL_LABELS_FR: Record<string, string> = {
  N: 'nord',
  NE: 'nord-est',
  E: 'est',
  SE: 'sud-est',
  S: 'sud',
  SO: 'sud-ouest',
  O: 'ouest',
  NO: 'nord-ouest',
}

/** Full French word for an 8-point cardinal code (e.g. "NO" -> "nord-ouest"). */
export function cardinalLabelFr(direction: string): string {
  return CARDINAL_LABELS_FR[direction] ?? direction
}

const CARDINAL_PHRASES_FR: Record<string, string> = {
  N: 'au nord',
  NE: 'au nord-est',
  E: "à l'est",
  SE: 'au sud-est',
  S: 'au sud',
  SO: 'au sud-ouest',
  O: "à l'ouest",
  NO: 'au nord-ouest',
}

/** Full French preposition + direction (e.g. "O" -> "à l'ouest", "N" -> "au
 * nord") — "au est"/"au ouest" is not valid French, unlike the other six. */
export function cardinalPhraseFr(direction: string): string {
  return CARDINAL_PHRASES_FR[direction] ?? `au ${cardinalLabelFr(direction)}`
}

// ---- Polygon geometry helpers (GeoJSON Polygon/MultiPolygon) --------------
// Shared by ppe.ts (static PPE export) and parcelles.ts (live RPG queries) —
// both need "is this point inside this polygon" and "how far to its
// boundary", just against different data sources.

type Position = [number, number]

export interface PolygonGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: unknown
}

export function ringsOfGeometry(geometry: PolygonGeometry): Position[][] {
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

/** Whether (lat, lon) falls inside the geometry's exterior ring. Holes
 * aren't distinguished (first ring of each polygon part only) — good enough
 * for "is the site broadly within this shape", not for donut-shaped precision. */
export function isPointInGeometry(lat: number, lon: number, geometry: PolygonGeometry): boolean {
  const rings = ringsOfGeometry(geometry)
  return rings.length > 0 && pointInRing(lat, lon, rings[0])
}

/** Shortest distance (metres) from (lat, lon) to the geometry's boundary —
 * meaningless if the point is inside (call `isPointInGeometry` first). */
export function minDistanceToGeometryBoundaryM(lat: number, lon: number, geometry: PolygonGeometry): number {
  let min = Infinity
  for (const ring of ringsOfGeometry(geometry)) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i]
      const [lon2, lat2] = ring[i + 1]
      const d = pointToSegmentDistanceM(lat, lon, lat1, lon1, lat2, lon2)
      if (d < min) min = d
    }
  }
  return min
}

/** Simple average of the exterior ring's vertices — good enough for "roughly
 * where is this shape" when giving a cardinal direction, not a true centroid. */
export function centroidOfGeometry(geometry: PolygonGeometry): Position | null {
  const ring = ringsOfGeometry(geometry)[0]
  if (!ring || ring.length === 0) return null
  let sumLon = 0
  let sumLat = 0
  for (const [lon, lat] of ring) {
    sumLon += lon
    sumLat += lat
  }
  return [sumLon / ring.length, sumLat / ring.length]
}
