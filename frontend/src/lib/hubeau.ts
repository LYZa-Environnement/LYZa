/**
 * Client for Hub'Eau (hubeau.eaufrance.fr) — public, no key, CORS-enabled.
 * Same endpoints and field names as frontend/public/lyza-cartes.html
 * (piezoMarker, qualnappeMarker, prelevMarker, riverQualityMarker), reused
 * here to find the *nearest* station to a point rather than everything in a
 * map viewport, and to read its actual measurements.
 */

import { bboxAround, bboxParam, haversineMeters } from './geo'

const HUBEAU_BASE = 'https://hubeau.eaufrance.fr/api/'

async function getData(path: string, params: Record<string, string | number>): Promise<Record<string, unknown>[] | null> {
  try {
    const url = new URL(path, HUBEAU_BASE)
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    const response = await fetch(url.toString())
    if (!response.ok && response.status !== 206) return null
    const json = (await response.json()) as { data?: unknown[] }
    return Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : []
  } catch {
    return null
  }
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

function pointCoordinates(item: Record<string, unknown>): [number, number] | null {
  const geometry = item.geometry as { coordinates?: unknown } | undefined
  const coords = geometry?.coordinates
  if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return [coords[0], coords[1]]
  }
  return null
}

function nearestByCoordinates<T extends Record<string, unknown>>(
  lat: number,
  lon: number,
  items: T[],
  getCoords: (item: T) => [number, number] | null,
): { item: T; distanceM: number } | null {
  let best: { item: T; distanceM: number } | null = null
  for (const item of items) {
    const coords = getCoords(item)
    if (!coords) continue
    const [itemLon, itemLat] = coords
    const distanceM = haversineMeters(lat, lon, itemLat, itemLon)
    if (!best || distanceM < best.distanceM) best = { item, distanceM }
  }
  return best
}

// ---- Point ADES de référence (qualité des nappes) --------------------------
//
// A single reference point rather than two independently-found ones: the
// nearest qualite_nappes/stations record is where the aquifer entity
// ("l'entité hydrogéologique") is actually described, so it's used as the
// anchor for both the aquifer name AND the depth reading — asking for the
// depth chronicle of that *same* code_bss, not of a separately-found nearest
// piezometer that could be a different point entirely.

export interface AdesReferencePoint {
  codeBss: string
  distanceM: number
  aquifere: string | null
  nature: string | null
  /** Actual measured water-table depth (best case) — from the niveaux_nappes chronicle. */
  profondeurNappeM: number | null
  /** Depth of the borehole/ouvrage itself (qualite_nappes/stations' own
   * profondeur_investigation) — a weaker fallback signal when no water-level
   * measurement is available: it's the structure's depth, not the water's,
   * but still "une information" per feedback, rather than nothing at all. */
  profondeurOuvrageM: number | null
  dateMesure: string | null
}

export async function findNearestAdesPoint(lat: number, lon: number, radiusM = 15000): Promise<AdesReferencePoint | null> {
  const stations = await getData('v1/qualite_nappes/stations', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 100 })
  if (!stations) return null
  const nearest = nearestByCoordinates(lat, lon, stations, pointCoordinates)
  if (!nearest) return null
  const codeBss = str(nearest.item.code_bss)
  if (!codeBss) return null

  let profondeurNappeM: number | null = null
  let dateMesure: string | null = null
  const chronicle = await getData('v1/niveaux_nappes/chroniques', { code_bss: codeBss, size: 1, sort: 'desc' })
  if (chronicle && chronicle.length > 0) {
    profondeurNappeM = num(chronicle[0].profondeur_nappe)
    dateMesure = str(chronicle[0].date_mesure)
  }

  return {
    codeBss,
    distanceM: nearest.distanceM,
    aquifere: str(nearest.item.nom_caracteristique_aquifere),
    nature: str(nearest.item.nom_nature_pe),
    profondeurNappeM,
    profondeurOuvrageM: num(nearest.item.profondeur_investigation),
    dateMesure,
  }
}

// ---- Qualité des cours d'eau (donne le nom du cours d'eau) -----------------

export interface NearestRiver {
  nom: string | null
  commune: string | null
  distanceM: number
}

export async function findNearestRiver(lat: number, lon: number, radiusM = 15000): Promise<NearestRiver | null> {
  // v2 endpoint, and flat longitude/latitude fields (not GeoJSON geometry) —
  // matches frontend/public/lyza-cartes.html's riverQualityMarker.
  const stations = await getData('v2/qualite_rivieres/station_pc', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 100 })
  if (!stations) return null
  const nearest = nearestByCoordinates(lat, lon, stations, (item) => {
    const longitude = num(item.longitude)
    const latitude = num(item.latitude)
    return longitude !== null && latitude !== null ? [longitude, latitude] : null
  })
  if (!nearest) return null
  return { nom: str(nearest.item.nom_cours_eau), commune: str(nearest.item.libelle_commune), distanceM: nearest.distanceM }
}

// ---- Ouvrages de prélèvement (usages sensibles des eaux souterraines) -----

export async function countPrelevements(lat: number, lon: number, radiusM = 1000): Promise<number | null> {
  const items = await getData('v1/prelevements/referentiel/ouvrages', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 300 })
  return items === null ? null : items.length
}
