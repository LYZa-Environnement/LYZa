// Wind rose — Open-Meteo's historical archive API (ERA5 reanalysis),
// verified live: no API key, works for any point in France, hourly wind
// speed + direction going back decades. Not an official Météo-France
// ground-station product — the UI says so — but Météo-France's own API
// requires an account/API key, which a client-only static site (no backend
// to keep a secret on) can't use without exposing it to every visitor.
const OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive'

export const DIRECTIONS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO',
] as const

export const SPEED_BANDS = [
  { max: 10, label: '< 10 km/h' },
  { max: 25, label: '10 – 25 km/h' },
  { max: 40, label: '25 – 40 km/h' },
  { max: Infinity, label: '> 40 km/h' },
] as const

export interface WindRose {
  /** [direction sector][speed band] -> share of all hours, 0-1. Sums to 1
   * across all cells (calm hours, if any, are folded into the lowest band
   * of the observed direction rather than dropped). */
  frequencies: number[][]
  totalHours: number
  year: number
}

/** Returns null on fetch failure — same graceful-degradation pattern as
 * every other data source on this site. */
export async function fetchWindRose(lat: number, lon: number): Promise<WindRose | null> {
  const year = new Date().getFullYear() - 1
  try {
    const url = `${OPEN_METEO_BASE}?${new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      hourly: 'wind_speed_10m,wind_direction_10m',
    })}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const speeds: number[] = data?.hourly?.wind_speed_10m
    const directions: number[] = data?.hourly?.wind_direction_10m
    if (!Array.isArray(speeds) || !Array.isArray(directions) || speeds.length === 0) return null

    const frequencies: number[][] = DIRECTIONS_16.map(() => SPEED_BANDS.map(() => 0))
    let counted = 0
    for (let i = 0; i < speeds.length; i++) {
      const speed = speeds[i]
      const dir = directions[i]
      if (!Number.isFinite(speed) || !Number.isFinite(dir)) continue
      const sectorIndex = Math.round((((dir % 360) + 360) % 360) / 22.5) % 16
      const bandIndex = SPEED_BANDS.findIndex((b) => speed < b.max)
      frequencies[sectorIndex][bandIndex === -1 ? SPEED_BANDS.length - 1 : bandIndex]++
      counted++
    }
    if (counted === 0) return null
    for (const row of frequencies) {
      for (let j = 0; j < row.length; j++) row[j] /= counted
    }
    return { frequencies, totalHours: counted, year }
  } catch {
    return null
  }
}

/** Share of all hours the wind blows FROM each of the 16 sectors, summed
 * across speed bands — what most people mean by "which way does the wind
 * usually come from here". */
export function dominantDirections(rose: WindRose, count = 3): { direction: string; share: number }[] {
  const totals = rose.frequencies.map((row, i) => ({ direction: DIRECTIONS_16[i], share: row.reduce((a, b) => a + b, 0) }))
  return totals.sort((a, b) => b.share - a.share).slice(0, count)
}
