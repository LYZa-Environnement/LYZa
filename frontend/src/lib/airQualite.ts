/**
 * Air quality at a point, from Open-Meteo's Air Quality API (CAMS Europe
 * reanalysis/forecast, ~11 km grid). Verified live: no key, CORS-enabled,
 * returns the pollutant concentrations, the European AQI and its
 * per-pollutant sub-indices, plus pollen counts, in one call.
 *
 * This is a *model*, not a measuring station, and the UI says so. France's
 * actual reference measurements (Géod'Air / the AASQA network) are not
 * available through an open, key-free per-point API, so what this reports as
 * "distance à la mesure" is the distance to the centre of the model grid cell
 * that was actually evaluated — the API echoes it back in `latitude` and
 * `longitude`, which differ from the requested coordinates by up to half a
 * cell. Presenting that distance is the honest version of the question "how
 * far is this reading from my site".
 */

import { haversineMeters } from './geo'

const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality'

// Only parameters confirmed live against the API — an unknown name makes the
// whole request fail, so this list is not extended without checking.
const CURRENT_PARAMS = [
  'pm10',
  'pm2_5',
  'nitrogen_dioxide',
  'ozone',
  'sulphur_dioxide',
  'carbon_monoxide',
  'ammonia',
  'dust',
  'european_aqi',
  'european_aqi_pm2_5',
  'european_aqi_no2',
  'european_aqi_o3',
  'grass_pollen',
  'birch_pollen',
  'alder_pollen',
  'ragweed_pollen',
] as const

export interface Polluant {
  cle: string
  libelle: string
  valeur: number
  unite: string
  /** Reference value the reading is read against, when one applies. */
  reference?: string
}

export interface AirQualite {
  /** European AQI, 0-100+: <20 bon, <40 moyen, <60 dégradé, <80 mauvais. */
  indiceEuropeen: number | null
  polluants: Polluant[]
  pollens: Polluant[]
  /** Distance from the site to the centre of the evaluated model grid cell. */
  distanceMailleM: number
  heure: string | null
}

const LIBELLES: Record<string, { libelle: string; reference?: string }> = {
  pm10: { libelle: 'Particules PM10', reference: 'Valeur limite journalière UE : 45 µg/m³' },
  pm2_5: { libelle: 'Particules PM2,5', reference: 'Valeur limite annuelle UE : 10 µg/m³' },
  nitrogen_dioxide: { libelle: 'Dioxyde d’azote (NO₂)', reference: 'Valeur limite annuelle UE : 20 µg/m³' },
  ozone: { libelle: 'Ozone (O₃)', reference: 'Seuil d’information : 180 µg/m³ (moyenne horaire)' },
  sulphur_dioxide: { libelle: 'Dioxyde de soufre (SO₂)', reference: 'Valeur limite journalière UE : 50 µg/m³' },
  carbon_monoxide: { libelle: 'Monoxyde de carbone (CO)' },
  ammonia: { libelle: 'Ammoniac (NH₃)', reference: 'Marqueur d’activité agricole/élevage' },
  dust: { libelle: 'Poussières désertiques' },
}

const POLLENS: Record<string, string> = {
  grass_pollen: 'Pollens de graminées',
  birch_pollen: 'Pollens de bouleau',
  alder_pollen: 'Pollens d’aulne',
  ragweed_pollen: 'Pollens d’ambroisie',
}

export function qualifieIndice(indice: number): string {
  if (indice < 20) return 'Bon'
  if (indice < 40) return 'Moyen'
  if (indice < 60) return 'Dégradé'
  if (indice < 80) return 'Mauvais'
  if (indice < 100) return 'Très mauvais'
  return 'Extrêmement mauvais'
}

export async function fetchAirQualite(lat: number, lon: number): Promise<AirQualite | null> {
  try {
    const url = `${BASE}?${new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: CURRENT_PARAMS.join(','),
      timezone: 'Europe/Paris',
    })}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as {
      latitude?: number
      longitude?: number
      current?: Record<string, number | string>
      current_units?: Record<string, string>
    }
    const current = data.current
    if (!current) return null
    const units = data.current_units ?? {}

    const read = (key: string): number | null => {
      const value = current[key]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }

    const polluants: Polluant[] = []
    for (const [cle, meta] of Object.entries(LIBELLES)) {
      const valeur = read(cle)
      if (valeur === null) continue
      polluants.push({ cle, libelle: meta.libelle, valeur, unite: units[cle] ?? 'µg/m³', reference: meta.reference })
    }

    const pollens: Polluant[] = []
    for (const [cle, libelle] of Object.entries(POLLENS)) {
      const valeur = read(cle)
      if (valeur === null) continue
      pollens.push({ cle, libelle, valeur, unite: units[cle] ?? 'grains/m³' })
    }

    const mailleLat = typeof data.latitude === 'number' ? data.latitude : lat
    const mailleLon = typeof data.longitude === 'number' ? data.longitude : lon

    return {
      indiceEuropeen: read('european_aqi'),
      polluants,
      pollens,
      distanceMailleM: haversineMeters(lat, lon, mailleLat, mailleLon),
      heure: typeof current.time === 'string' ? current.time : null,
    }
  } catch {
    return null
  }
}
