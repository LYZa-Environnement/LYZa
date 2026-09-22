/**
 * Climate now and at the 2050 horizon, from Open-Meteo's Climate API (CMIP6
 * high-resolution regional models, statistically downscaled and bias-adjusted
 * against ERA5).
 *
 * Both the reference period and the 2050 window are read from the *same*
 * model through the same endpoint, rather than mixing an ERA5 reanalysis past
 * with a CMIP6 future: comparing a model against itself isolates the climate
 * signal, whereas comparing two different products mixes in the offset
 * between them and would overstate or mask the change.
 *
 * The API is free and key-free but daily-rate-limited per IP; a refused call
 * returns null and the rubrique says the projection is unavailable rather
 * than showing a half-filled comparison.
 */

const CLIMATE_BASE = 'https://climate-api.open-meteo.com/v1/climate'

// A single high-resolution model rather than an ensemble mean: the request
// stays small, and the UI names the model instead of implying consensus.
const MODEL = 'MRI_AGCM3_2_S'

export const PERIODE_REFERENCE = { debut: 1995, fin: 2014 }
export const PERIODE_FUTURE = { debut: 2040, fin: 2059 }

export interface NormalesClimatiques {
  /** Mean annual temperature over the window, °C. */
  temperatureMoyenne: number
  /** Mean number of days per year above 30 °C. */
  joursChauds: number
  /** Mean number of days per year above 35 °C — the threshold at which heat
   * becomes a health and infrastructure issue, not merely a comfort one. */
  joursTresChauds: number
  /** Mean annual precipitation, mm. */
  precipitations: number
  debut: number
  fin: number
}

export interface ProjectionClimatique {
  reference: NormalesClimatiques
  future: NormalesClimatiques
  modele: string
}

async function fetchNormales(lat: number, lon: number, debut: number, fin: number): Promise<NormalesClimatiques | null> {
  try {
    const url = `${CLIMATE_BASE}?${new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: `${debut}-01-01`,
      end_date: `${fin}-12-31`,
      models: MODEL,
      daily: 'temperature_2m_mean,temperature_2m_max,precipitation_sum',
    })}`
    const response = await fetch(url)
    if (!response.ok) return null
    const json = (await response.json()) as { daily?: Record<string, (number | null)[]> }
    const daily = json.daily
    if (!daily) return null

    const means = daily.temperature_2m_mean ?? []
    const maxes = daily.temperature_2m_max ?? []
    const rain = daily.precipitation_sum ?? []
    const validMeans = means.filter((v): v is number => typeof v === 'number')
    if (validMeans.length === 0) return null

    const annees = fin - debut + 1
    const validMaxes = maxes.filter((v): v is number => typeof v === 'number')

    return {
      temperatureMoyenne: validMeans.reduce((a, b) => a + b, 0) / validMeans.length,
      joursChauds: validMaxes.filter((v) => v > 30).length / annees,
      joursTresChauds: validMaxes.filter((v) => v > 35).length / annees,
      precipitations: rain.filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0) / annees,
      debut,
      fin,
    }
  } catch {
    return null
  }
}

export async function fetchProjectionClimatique(lat: number, lon: number): Promise<ProjectionClimatique | null> {
  const [reference, future] = await Promise.all([
    fetchNormales(lat, lon, PERIODE_REFERENCE.debut, PERIODE_REFERENCE.fin),
    fetchNormales(lat, lon, PERIODE_FUTURE.debut, PERIODE_FUTURE.fin),
  ])
  if (!reference || !future) return null
  return { reference, future, modele: MODEL.replace(/_/g, ' ') }
}

export function ecart(valeur: number, reference: number, unite: string, decimales = 1): string {
  const delta = valeur - reference
  const signe = delta > 0 ? '+' : ''
  return `${signe}${delta.toFixed(decimales)} ${unite}`
}
