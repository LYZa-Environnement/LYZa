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
