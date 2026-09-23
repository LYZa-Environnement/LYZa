/**
 * Client for Hub'Eau (hubeau.eaufrance.fr) — public, no key, CORS-enabled.
 * Same endpoints and field names as frontend/public/lyza-cartes.html
 * (piezoMarker, qualnappeMarker, prelevMarker, riverQualityMarker), reused
 * here to find the *nearest* station to a point rather than everything in a
 * map viewport, and to read its actual measurements.
 */

import { bboxAround, bboxParam, bearingDegrees, cardinalDirection, haversineMeters } from './geo'

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

// Hub'Eau/BDLISA use literal placeholder values (not empty/null) for an
// unclassified aquifer or nature — surfacing them as-is would read like a
// real aquifer named "Inconnu", so they're treated as "no data" instead.
const UNKNOWN_VALUES = new Set(['inconnu', 'inconnue', 'non renseigné', 'non renseignée', 'non communiqué', 'non communiquée', 'nc', 'indéterminé', 'indéterminée'])

function meaningfulStr(value: unknown): string | null {
  const s = str(value)
  if (s === null) return null
  return UNKNOWN_VALUES.has(s.trim().toLowerCase()) ? null : s
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
): { item: T; distanceM: number; direction: string } | null {
  let best: { item: T; distanceM: number; direction: string } | null = null
  for (const item of items) {
    const coords = getCoords(item)
    if (!coords) continue
    const [itemLon, itemLat] = coords
    const distanceM = haversineMeters(lat, lon, itemLat, itemLon)
    if (!best || distanceM < best.distanceM) {
      best = { item, distanceM, direction: cardinalDirection(bearingDegrees(lat, lon, itemLat, itemLon)) }
    }
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
  /** Modern ADES identifier (BSS001GVLA…) — this is what the public fiche URL
   * keys on; the historical `code_bss` ("04817X1698/PZ3") is shown as the
   * reference a hydrogeologist will recognise. */
  bssId: string | null
  /** "Nom de l'entité hydrogéologique" as ADES/BDLISA names it — the aquifer
   * the point actually taps. A station can reference several, so they are all
   * kept and the caller shows the first. */
  entitesHydrogeologiques: string[]
  lat: number
  lon: number
  distanceM: number
  direction: string
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
  const coords = pointCoordinates(nearest.item)
  if (!coords) return null

  let profondeurNappeM: number | null = null
  let dateMesure: string | null = null
  const chronicle = await getData('v1/niveaux_nappes/chroniques', { code_bss: codeBss, size: 1, sort: 'desc' })
  if (chronicle && chronicle.length > 0) {
    profondeurNappeM = num(chronicle[0].profondeur_nappe)
    dateMesure = str(chronicle[0].date_mesure)
  }

  return {
    codeBss,
    lat: coords[1],
    lon: coords[0],
    distanceM: nearest.distanceM,
    direction: nearest.direction,
    bssId: str(nearest.item.bss_id),
    entitesHydrogeologiques: Array.isArray(nearest.item.noms_entite_hg_bdlisa)
      ? (nearest.item.noms_entite_hg_bdlisa as unknown[]).map((n) => String(n)).filter((n) => n.trim() !== '')
      : [],
    aquifere: meaningfulStr(nearest.item.nom_caracteristique_aquifere),
    nature: meaningfulStr(nearest.item.nom_nature_pe),
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

// ---- Station de suivi de la qualité des rivières + ses dernières analyses --

export interface AnalyseRiviere {
  parametre: string
  groupe: string | null
  resultat: number | null
  unite: string | null
  date: string | null
}

export interface StationRiviere {
  code: string
  libelle: string | null
  nomCoursEau: string | null
  lat: number
  lon: number
  distanceM: number
  direction: string
  analyses: AnalyseRiviere[]
  /** Distinct parameters measured over the window queried. */
  nombreParametres: number
  derniereDate: string | null
}

/** The nearest water-quality station, with the physico-chemical parameters
 * measured there over the last few years. `analyse_pc`'s `sort=desc` does NOT
 * order by sampling date (verified live: it returned a 1981 record first), so
 * the window is bounded with `date_debut_prelevement` and the rows are sorted
 * here instead. */
export async function findNearestStationRiviere(lat: number, lon: number, radiusM = 15000, anneesEnArriere = 4): Promise<StationRiviere | null> {
  const stations = await getData('v2/qualite_rivieres/station_pc', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 100 })
  if (!stations) return null
  const nearest = nearestByCoordinates(lat, lon, stations, (item) => {
    const longitude = num(item.longitude)
    const latitude = num(item.latitude)
    return longitude !== null && latitude !== null ? [longitude, latitude] : null
  })
  if (!nearest) return null
  const code = str(nearest.item.code_station)
  if (!code) return null

  const since = new Date()
  since.setFullYear(since.getFullYear() - anneesEnArriere)
  const rows =
    (await getData('v2/qualite_rivieres/analyse_pc', {
      code_station: code,
      date_debut_prelevement: since.toISOString().slice(0, 10),
      size: 1000,
    })) ?? []

  const analyses: AnalyseRiviere[] = rows
    .map((row) => ({
      parametre: str(row.libelle_parametre) ?? 'Paramètre',
      groupe: str(row.libelle_groupe_parametre),
      resultat: num(row.resultat),
      unite: str(row.symbole_unite),
      date: str(row.date_prelevement),
    }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return {
    code,
    libelle: str(nearest.item.libelle_station),
    nomCoursEau: str(nearest.item.nom_cours_eau),
    lat: num(nearest.item.latitude) ?? lat,
    lon: num(nearest.item.longitude) ?? lon,
    distanceM: nearest.distanceM,
    direction: nearest.direction,
    analyses,
    nombreParametres: new Set(analyses.map((a) => a.parametre)).size,
    derniereDate: analyses[0]?.date ?? null,
  }
}

// ---- État piscicole : quelles espèces vivent dans le cours d'eau ----------
//
// The closest thing to a national, open "fishing" dataset. It is a scientific
// electrofishing network, not an inventory of fishing spots — no such national
// inventory exists in open data — but the species actually caught at the
// nearest station say more about the fishery interest of the watercourse than
// any proxy, and migratory or demanding species (salmonids, eel, lamprey) are
// themselves a sensitivity signal. Verified live: `etat_piscicole/stations`
// filters by bbox and `etat_piscicole/observations` returns one row per taxon
// per operation, with `nom_commun_taxon` in French.

export interface StationPiscicole {
  code: string
  libelle: string | null
  nomCoursEau: string | null
  lat: number
  lon: number
  distanceM: number
  direction: string
  /** Distinct species recorded, most recently seen first. */
  especes: string[]
  dernierInventaire: string | null
}

export async function findNearestStationPiscicole(lat: number, lon: number, radiusM = 10000): Promise<StationPiscicole | null> {
  const stations = await getData('v1/etat_piscicole/stations', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 200 })
  if (!stations) return null
  const nearest = nearestByCoordinates(lat, lon, stations, (item) => {
    const coords = pointCoordinates(item)
    if (coords) return coords
    const longitude = num(item.longitude)
    const latitude = num(item.latitude)
    return longitude !== null && latitude !== null ? [longitude, latitude] : null
  })
  if (!nearest) return null
  const code = str(nearest.item.code_station)
  if (!code) return null

  const rows = (await getData('v1/etat_piscicole/observations', { code_station: code, size: 500 })) ?? []
  const parEspece = new Map<string, string>()
  for (const row of rows) {
    const nom = str(row.nom_commun_taxon) ?? str(row.nom_latin_taxon)
    const date = str(row.date_operation) ?? ''
    if (!nom) continue
    const seen = parEspece.get(nom)
    if (!seen || date > seen) parEspece.set(nom, date)
  }
  const especes = [...parEspece.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([nom]) => nom)

  return {
    code,
    libelle: str(nearest.item.libelle_station),
    nomCoursEau: str(nearest.item.libelle_cours_eau),
    lat: nearest.item.latitude !== undefined ? (num(nearest.item.latitude) ?? lat) : lat,
    lon: nearest.item.longitude !== undefined ? (num(nearest.item.longitude) ?? lon) : lon,
    distanceM: nearest.distanceM,
    direction: nearest.direction,
    especes,
    dernierInventaire: [...parEspece.values()].sort().pop() ?? null,
  }
}

// ---- Ouvrages de prélèvement (usages sensibles des eaux souterraines) -----

export interface OuvragePrelevement {
  nom: string | null
  usage: string | null
  lat: number
  lon: number
  distanceM: number
  direction: string
}

export async function fetchPrelevements(lat: number, lon: number, radiusM = 2000): Promise<OuvragePrelevement[] | null> {
  const items = await getData('v1/prelevements/referentiel/ouvrages', { bbox: bboxParam(bboxAround(lat, lon, radiusM)), size: 300 })
  if (items === null) return null
  const out: OuvragePrelevement[] = []
  for (const item of items) {
    const coords = pointCoordinates(item)
    const itemLon = coords ? coords[0] : num(item.longitude)
    const itemLat = coords ? coords[1] : num(item.latitude)
    if (itemLon === null || itemLat === null) continue
    out.push({
      nom: str(item.nom_ouvrage),
      usage: str(item.libelle_usage),
      lat: itemLat,
      lon: itemLon,
      distanceM: haversineMeters(lat, lon, itemLat, itemLon),
      direction: cardinalDirection(bearingDegrees(lat, lon, itemLat, itemLon)),
    })
  }
  return out.sort((a, b) => a.distanceM - b.distanceM)
}
