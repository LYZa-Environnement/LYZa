/**
 * Client for the public Géorisques API (BRGM) — https://www.georisques.gouv.fr/doc-api
 * Called directly from the browser (no key required, CORS-enabled — the same
 * endpoints are already called this way from frontend/public/lyza-cartes.html,
 * which is the source of truth this module was checked against for the
 * response shapes of `installations_classees` and `ssp` below).
 *
 * Every function returns null on any network/parsing failure instead of
 * throwing: one upstream indicator being unavailable should never take down
 * the whole synthesis, it should just show up as "donnée indisponible".
 */

import { bearingDegrees, cardinalDirection, haversineMeters } from './geo'

const GEORISQUES_BASE_URL = 'https://georisques.gouv.fr/api/v1/'
const MAX_PAGES = 4
const PAGE_SIZE = 100

function latlon(lat: number, lon: number): string {
  return `${lon},${lat}`
}

type Json = Record<string, unknown>

async function getRaw(path: string, params: Record<string, string | number>): Promise<Json | null> {
  try {
    const url = new URL(path, GEORISQUES_BASE_URL)
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    const response = await fetch(url.toString())
    if (!response.ok) return null
    return (await response.json()) as Json
  } catch {
    return null
  }
}

/** Mirrors the `fetchPages` helper in lyza-cartes.html: some Géorisques list
 * endpoints (e.g. installations_classees) paginate via `data` + `total_pages`
 * rather than returning everything in one call. */
async function fetchPaginated(path: string, params: Record<string, string | number>): Promise<unknown[] | null> {
  let acc: unknown[] = []
  let page = 1
  let sawAnyResponse = false
  while (page <= MAX_PAGES) {
    const payload = await getRaw(path, { ...params, page, page_size: PAGE_SIZE })
    if (payload === null) break
    sawAnyResponse = true
    const data = Array.isArray(payload.data) ? payload.data : []
    acc = acc.concat(data)
    const totalPages = typeof payload.total_pages === 'number' ? payload.total_pages : 1
    if (page >= Math.min(totalPages, MAX_PAGES) || data.length === 0) break
    page++
  }
  return sawAnyResponse ? acc : null
}

function count(payload: Json | null): number | null {
  if (payload === null) return null
  if (Array.isArray(payload.data)) return payload.data.length
  return null
}

function firstField(payload: Json | null, ...candidateKeys: string[]): unknown {
  const items = Array.isArray(payload?.data) ? payload!.data : null
  if (!Array.isArray(items) || items.length === 0) return null
  const first = items[0]
  if (!first || typeof first !== 'object') return null
  for (const key of candidateKeys) {
    const value = (first as Record<string, unknown>)[key]
    if (value !== null && value !== undefined) return value
  }
  return null
}

function toInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null
}

function str(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

/** A representative [lon, lat] for a GeoJSON geometry: the point itself, or a
 * simple average of the exterior ring for a (multi)polygon — good enough for
 * a "which direction, roughly how far" reading, not for anything precise. */
function representativePoint(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== 'object') return null
  const g = geom as { type?: unknown; coordinates?: unknown }
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length === 2) {
    const [lon, lat] = g.coordinates as [number, number]
    return typeof lon === 'number' && typeof lat === 'number' ? [lon, lat] : null
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const ring = (g.coordinates as unknown[])[0]
    return averageRing(ring)
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    const firstPolygon = (g.coordinates as unknown[])[0]
    const ring = Array.isArray(firstPolygon) ? firstPolygon[0] : null
    return averageRing(ring)
  }
  return null
}

function averageRing(ring: unknown): [number, number] | null {
  if (!Array.isArray(ring) || ring.length === 0) return null
  let sumLon = 0
  let sumLat = 0
  let count = 0
  for (const point of ring) {
    if (Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number') {
      sumLon += point[0]
      sumLat += point[1]
      count++
    }
  }
  return count > 0 ? [sumLon / count, sumLat / count] : null
}

export interface Localisation {
  distanceM: number
  direction: string
}

function localise(siteLat: number, siteLon: number, geom: unknown): Localisation | null {
  const point = representativePoint(geom)
  if (!point) return null
  const [lon, lat] = point
  return { distanceM: haversineMeters(siteLat, siteLon, lat, lon), direction: cardinalDirection(bearingDegrees(siteLat, siteLon, lat, lon)) }
}

export interface ListResult<T> {
  items: T[]
  total: number
}

// ---- ICPE (installations classées) ----------------------------------------

export interface IcpeItem {
  nom: string
  commune: string
  regime: string
  codeNaf: string | null
  seveso: string | null
  ficheUrl: string | null
}

export async function fetchIcpe(lat: number, lon: number, rayon: number): Promise<ListResult<IcpeItem> | null> {
  const raw = await fetchPaginated('installations_classees', { latlon: latlon(lat, lon), rayon })
  if (raw === null) return null
  const items: IcpeItem[] = raw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const codeAIOT = str(item.codeAIOT)
    return {
      nom: str(item.raisonSociale) ?? 'Établissement',
      commune: str(item.commune) ?? '',
      regime: str(item.regime) ?? '—',
      codeNaf: str(item.codeNaf),
      seveso: str(item.statutSeveso),
      ficheUrl: codeAIOT ? `https://www.georisques.gouv.fr/risques/installations/donnees/details/${encodeURIComponent(codeAIOT)}` : null,
    }
  })
  return { items, total: items.length }
}

// ---- SSP: sites et sols pollués — bundles CASIAS (anciens sites          --
// ---- industriels) and SIS (secteurs d'information sur les sols) under    --
// ---- one endpoint, each in their own sub-object.                         --

export interface CasiasItem {
  identifiant: string | null
  nom: string
  commune: string
  activite: string | null
  statut: string | null
  ficheUrl: string | null
  localisation: Localisation | null
}

export interface SisItem {
  identifiant: string | null
  nom: string
  commune: string
  superficieM2: number | null
  ficheUrl: string | null
  localisation: Localisation | null
}

export interface SspResult {
  casias: ListResult<CasiasItem>
  sis: ListResult<SisItem>
}

function subResultCount(sub: Json | undefined, dataLength: number): number {
  const results = sub?.results
  return typeof results === 'number' ? results : dataLength
}

function identifiantOf(item: Record<string, unknown>, ...candidateKeys: string[]): string | null {
  for (const key of candidateKeys) {
    const value = str(item[key])
    if (value) return value
  }
  return null
}

export async function fetchSsp(lat: number, lon: number, rayon: number): Promise<SspResult | null> {
  const payload = await getRaw('ssp', { latlon: latlon(lat, lon), rayon })
  if (payload === null) return null

  const casiasSub = payload.casias as Json | undefined
  const casiasRaw = Array.isArray(casiasSub?.data) ? (casiasSub!.data as unknown[]) : []
  const casiasItems: CasiasItem[] = casiasRaw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      identifiant: identifiantOf(item, 'identifiant', 'id_etablissement', 'id', 'code_etablissement'),
      nom: str(item.nom_etablissement) ?? 'Site industriel',
      commune: str(item.nom_commune) ?? '',
      activite: str(item.activite_principale),
      statut: str(item.statut),
      ficheUrl: str(item.fiche_risque),
      localisation: localise(lat, lon, item.geom),
    }
  })

  const sisConclusions = payload.conclusions_sis as Json | undefined
  const sisSup = payload.conclusions_sup as Json | undefined
  const sisConclusionsData = Array.isArray(sisConclusions?.data) ? (sisConclusions!.data as unknown[]) : []
  const sisSupData = Array.isArray(sisSup?.data) ? (sisSup!.data as unknown[]) : []
  const sisItems: SisItem[] = [...sisConclusionsData, ...sisSupData].map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      identifiant: identifiantOf(item, 'identifiant', 'id_zone', 'id', 'code_zone'),
      nom: str(item.nom) ?? "Secteur d'information sur les sols",
      commune: str(item.nom_commune) ?? '',
      superficieM2: typeof item.superficie === 'number' ? item.superficie : null,
      ficheUrl: str(item.fiche_risque),
      localisation: localise(lat, lon, item.geom),
    }
  })
  const sisTotal = subResultCount(sisConclusions, sisConclusionsData.length) + subResultCount(sisSup, sisSupData.length)

  return {
    casias: { items: casiasItems, total: subResultCount(casiasSub, casiasItems.length) },
    sis: { items: sisItems, total: sisTotal },
  }
}

// ---- Other point indicators (counts only — no proven per-item schema) ----

export async function countTim(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await getRaw('tim', { latlon: latlon(lat, lon), rayon }))
}

export async function countMvt(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await getRaw('mvt', { latlon: latlon(lat, lon), rayon }))
}

export async function countCavites(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await getRaw('cavites', { latlon: latlon(lat, lon), rayon }))
}

export async function inAzi(lat: number, lon: number, rayon: number): Promise<boolean | null> {
  const c = count(await getRaw('azi', { latlon: latlon(lat, lon), rayon }))
  return c === null ? null : c > 0
}

// ---- Arrêtés catastrophe naturelle (GASPAR) --------------------------------

export interface CatnatItem {
  libelle: string
  dateDebut: string | null
  dateFin: string | null
  datePublication: string | null
}

/** Arrêtés liés aux inondations pour la commune. */
export async function fetchCatnatInondation(codeInsee: string): Promise<CatnatItem[] | null> {
  const payload = await getRaw('gaspar/catnat', { code_insee: codeInsee })
  if (payload === null) return null
  const items = Array.isArray(payload.data) ? payload.data : []
  return items
    .map((entry) => (entry ?? {}) as Record<string, unknown>)
    .filter((item) => String(item.libelle_risque_jo ?? '').toLowerCase().includes('inond'))
    .map((item) => ({
      libelle: str(item.libelle_risque_jo) ?? 'Catastrophe naturelle',
      dateDebut: str(item.date_debut_evt),
      dateFin: str(item.date_fin_evt),
      datePublication: str(item.date_publication_arrete) ?? str(item.date_publication_jo),
    }))
}

export async function zonageSismique(codeInsee: string): Promise<number | null> {
  const payload = await getRaw('zonage_sismique', { code_insee: codeInsee })
  return toInt(firstField(payload, 'zone_sismicite', 'code_zone'))
}

export async function argilesExposition(codeInsee: string): Promise<string | null> {
  const payload = await getRaw('argiles', { code_insee: codeInsee })
  const value = firstField(payload, 'expo', 'alea', 'exposition')
  return value === null ? null : String(value)
}

export async function radonClasse(codeInsee: string): Promise<number | null> {
  const payload = await getRaw('radon', { code_insee: codeInsee })
  return toInt(firstField(payload, 'classe_potentiel', 'classe'))
}

/** General-purpose link to Géorisques' own address/commune risk lookup —
 * used as a catch-all "see everything" link. URL pattern is best-effort
 * (built from the commune's INSEE code); spot-check once deployed. */
export function communeRiskPortalUrl(codeInsee: string): string {
  return `https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi?code_insee=${encodeURIComponent(codeInsee)}`
}
