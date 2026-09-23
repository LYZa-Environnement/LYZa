/**
 * Air quality at a point, from Open-Meteo's Air Quality API (CAMS Europe,
 * ~11 km grid). Verified live: no key, CORS-enabled, and the hourly archive
 * covers whole past years, so an *annual mean* can be computed rather than
 * reporting whatever the concentration happens to be right now.
 *
 * Annual means are what this reports, deliberately: a single hourly value
 * swings with the weather and says almost nothing about a site, whereas the
 * regulatory limits that matter for a location — and the WHO guidelines — are
 * themselves annual. The current hour is still fetched, and clearly labelled
 * as such, so the reader can tell a live reading from a yearly average.
 *
 * This is a *model*, not a measuring station. France's reference measurements
 * (Géod'Air / the AASQA network) have no open, key-free per-point API, so what
 * is reported as the distance "to the measurement" is the distance to the
 * centre of the model grid cell actually evaluated — the API echoes it back in
 * `latitude`/`longitude`, up to half a cell away from the requested point.
 */

import { haversineMeters } from './geo'

const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality'

/** Pollutants with a meaningful annual reading, and the values it is read
 * against. `limiteUe` is the binding annual limit value of directive
 * 2008/50/CE where one exists; `oms` is the 2021 WHO guideline, stricter and
 * not binding. Ozone has no annual limit value — it is regulated on 8-hour
 * maxima — so it carries a guideline only and is never coloured red on an
 * annual mean it was never meant to be judged by. */
const POLLUANTS: Record<string, { libelle: string; limiteUe?: number; oms?: number; note?: string }> = {
  pm10: { libelle: 'Particules PM10', limiteUe: 40, oms: 15, note: 'Valeur limite annuelle UE : 40 µg/m³ — ligne directrice OMS : 15 µg/m³' },
  pm2_5: { libelle: 'Particules PM2,5', limiteUe: 25, oms: 5, note: 'Valeur limite annuelle UE : 25 µg/m³ — ligne directrice OMS : 5 µg/m³' },
  nitrogen_dioxide: { libelle: 'Dioxyde d’azote (NO₂)', limiteUe: 40, oms: 10, note: 'Valeur limite annuelle UE : 40 µg/m³ — ligne directrice OMS : 10 µg/m³' },
  sulphur_dioxide: { libelle: 'Dioxyde de soufre (SO₂)', oms: 20, note: 'Pas de valeur limite annuelle sanitaire ; 20 µg/m³ pour la protection des écosystèmes' },
  ozone: { libelle: 'Ozone (O₃)', note: "Réglementé sur les maxima journaliers 8 h (seuil d'information 180 µg/m³), pas en moyenne annuelle" },
  carbon_monoxide: { libelle: 'Monoxyde de carbone (CO)', note: 'Réglementé sur le maximum journalier 8 h (10 mg/m³)' },
  ammonia: { libelle: 'Ammoniac (NH₃)', note: "Non réglementé dans l'air ambiant — marqueur d'activité agricole et d'élevage" },
}

const HOURLY_PARAMS = Object.keys(POLLUANTS)

export type NiveauPolluant = 'favorable' | 'attention' | 'defavorable' | 'inconnu'

export interface PolluantAnnuel {
  cle: string
  libelle: string
  /** Mean over the whole reference year, µg/m³. */
  moyenneAnnuelle: number
  /** Highest hourly value of that year — the peak behind the average. */
  maxHoraire: number
  unite: string
  note?: string
  niveau: NiveauPolluant
}

export interface AirQualite {
  /** Year the annual statistics describe. */
  annee: number
  polluants: PolluantAnnuel[]
  /** European AQI right now, for the live reading alongside the annual ones. */
  indiceActuel: number | null
  heureActuelle: string | null
  /** Distance from the site to the centre of the evaluated model grid cell. */
  distanceMailleM: number
}

function niveau(valeur: number, meta: { limiteUe?: number; oms?: number }): NiveauPolluant {
  if (meta.limiteUe !== undefined && valeur > meta.limiteUe) return 'defavorable'
  if (meta.oms !== undefined && valeur > meta.oms) return 'attention'
  if (meta.oms === undefined && meta.limiteUe === undefined) return 'inconnu'
  return 'favorable'
}

export function qualifieIndice(indice: number): string {
  if (indice < 20) return 'Bon'
  if (indice < 40) return 'Moyen'
  if (indice < 60) return 'Dégradé'
  if (indice < 80) return 'Mauvais'
  if (indice < 100) return 'Très mauvais'
  return 'Extrêmement mauvais'
}

export function niveauIndice(indice: number): NiveauPolluant {
  if (indice < 40) return 'favorable'
  if (indice < 60) return 'attention'
  return 'defavorable'
}

export async function fetchAirQualite(lat: number, lon: number): Promise<AirQualite | null> {
  // The CAMS archive lags by a few days, so the last *complete* calendar year
  // is the most recent one that can be averaged honestly.
  const annee = new Date().getFullYear() - 1
  try {
    const url = `${BASE}?${new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: `${annee}-01-01`,
      end_date: `${annee}-12-31`,
      hourly: HOURLY_PARAMS.join(','),
      current: 'european_aqi',
      timezone: 'Europe/Paris',
    })}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as {
      latitude?: number
      longitude?: number
      hourly?: Record<string, (number | null)[]>
      hourly_units?: Record<string, string>
      current?: Record<string, number | string>
    }
    const hourly = data.hourly
    if (!hourly) return null
    const units = data.hourly_units ?? {}

    const polluants: PolluantAnnuel[] = []
    for (const [cle, meta] of Object.entries(POLLUANTS)) {
      const serie = (hourly[cle] ?? []).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      if (serie.length === 0) continue
      const moyenne = serie.reduce((a, b) => a + b, 0) / serie.length
      polluants.push({
        cle,
        libelle: meta.libelle,
        moyenneAnnuelle: moyenne,
        maxHoraire: Math.max(...serie),
        unite: units[cle] ?? 'µg/m³',
        note: meta.note,
        niveau: niveau(moyenne, meta),
      })
    }
    if (polluants.length === 0) return null

    const current = data.current ?? {}
    const indice = typeof current.european_aqi === 'number' ? current.european_aqi : null
    const mailleLat = typeof data.latitude === 'number' ? data.latitude : lat
    const mailleLon = typeof data.longitude === 'number' ? data.longitude : lon

    return {
      annee,
      polluants,
      indiceActuel: indice,
      heureActuelle: typeof current.time === 'string' ? current.time : null,
      distanceMailleM: haversineMeters(lat, lon, mailleLat, mailleLon),
    }
  } catch {
    return null
  }
}
