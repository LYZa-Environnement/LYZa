// Hub'Eau Hydrométrie (hubeau.eaufrance.fr/api/v2/hydrometrie) — débit des
// cours d'eau. Vérifié en direct (septembre 2026) :
//   - referentiel/stations expose en_service (bool) et
//     longitude_station/latitude_station (pas une géométrie GeoJSON, à la
//     différence des autres API Hub'Eau utilisées ailleurs sur ce site) ;
//   - obs_elab avec grandeur_hydro_elab=QmnJ (débit moyen journalier) accepte
//     date_debut_obs_elab/date_fin_obs_elab et renvoie des lignes triées par
//     date croissante, resultat_obs_elab en L/s. "QmJ" (sans "n") n'est pas
//     une valeur valide de l'énumération — confirmé par l'erreur de
//     validation de l'API elle-même.
import { bboxAround, bboxParam, bearingDegrees, cardinalDirection, haversineMeters } from './geo'

const HUBEAU_HYDRO_BASE = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/'

async function getData(path: string, params: Record<string, string | number>): Promise<Record<string, unknown>[] | null> {
  try {
    const url = new URL(path, HUBEAU_HYDRO_BASE)
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

export interface HydrometryStation {
  codeStation: string
  libelle: string
  coursEau: string | null
  distanceM: number
  direction: string
}

export interface DischargePoint {
  date: string
  debitLs: number
}

/** Nearest hydrometry station within radiusM, preferring one still in
 * service (`en_service`) — a closed station's discharge series has stopped
 * updating, so it would silently read as "no recent data" instead of an
 * honest "no active station nearby". */
export async function findNearestHydrometryStation(lat: number, lon: number, radiusM = 20000): Promise<HydrometryStation | null> {
  const stations = await getData('referentiel/stations', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 100 })
  if (!stations) return null
  const active = stations.filter((s) => s.en_service === true)
  const pool = active.length > 0 ? active : stations

  let best: { item: Record<string, unknown>; distanceM: number; stationLat: number; stationLon: number } | null = null
  for (const item of pool) {
    const stationLat = num(item.latitude_station)
    const stationLon = num(item.longitude_station)
    if (stationLat === null || stationLon === null) continue
    const distanceM = haversineMeters(lat, lon, stationLat, stationLon)
    if (!best || distanceM < best.distanceM) best = { item, distanceM, stationLat, stationLon }
  }
  if (!best) return null
  const codeStation = str(best.item.code_station)
  if (!codeStation) return null

  return {
    codeStation,
    libelle: str(best.item.libelle_station) ?? 'Station de mesure',
    coursEau: str(best.item.libelle_cours_eau),
    distanceM: best.distanceM,
    direction: cardinalDirection(bearingDegrees(lat, lon, best.stationLat, best.stationLon)),
  }
}

/** Débit moyen journalier (QmnJ) sur les ~120 derniers jours — assez pour
 * lire une tendance récente (étiage qui s'installe ou se résorbe), pas une
 * comparaison statistique à l'historique pluriannuel (qui demanderait des
 * années de données par station pour être fiable, hors de portée d'un appel
 * unique côté navigateur). */
export async function fetchRecentDischarge(codeStation: string, days = 120): Promise<DischargePoint[] | null> {
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const rows = await getData('obs_elab', {
    code_entite: codeStation,
    grandeur_hydro_elab: 'QmnJ',
    date_debut_obs_elab: fmt(start),
    date_fin_obs_elab: fmt(end),
    size: 200,
    fields: 'date_obs_elab,resultat_obs_elab',
  })
  if (rows === null) return null
  const points: DischargePoint[] = []
  for (const r of rows) {
    const date = str(r.date_obs_elab)
    const debitLs = num(r.resultat_obs_elab)
    if (date !== null && debitLs !== null) points.push({ date, debitLs })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export type DischargeTrend = 'baisse' | 'hausse' | 'stable'

/** Compares the latest value to the one ~30 days earlier — a simple, honest
 * "recent direction" reading, not a classification against long-term norms
 * (see fetchRecentDischarge's note on why that isn't attempted here). */
export function dischargeTrend(points: DischargePoint[]): { trend: DischargeTrend; changePct: number } | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const targetTime = new Date(last.date).getTime() - 30 * 86400000
  let reference = points[0]
  for (const p of points) {
    if (new Date(p.date).getTime() <= targetTime) reference = p
  }
  if (reference.date === last.date || reference.debitLs === 0) return null
  const changePct = ((last.debitLs - reference.debitLs) / reference.debitLs) * 100
  const trend: DischargeTrend = changePct <= -10 ? 'baisse' : changePct >= 10 ? 'hausse' : 'stable'
  return { trend, changePct }
}
