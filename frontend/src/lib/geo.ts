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
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180)
  const x1 = (lon1 - lon) * mPerDegLon
  const y1 = (lat1 - lat) * mPerDegLat
  const x2 = (lon2 - lon) * mPerDegLon
  const y2 = (lat2 - lat) * mPerDegLat
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(x1, y1)
  let t = (-x1 * dx - y1 * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(projX, projY)
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
