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
  /** Representative position of the feature — needed to draw it on a map,
   * not just to describe how far away it is. */
  lat: number
  lon: number
}

function localise(siteLat: number, siteLon: number, geom: unknown): Localisation | null {
  const point = representativePoint(geom)
  if (!point) return null
  const [lon, lat] = point
  return { distanceM: haversineMeters(siteLat, siteLon, lat, lon), direction: cardinalDirection(bearingDegrees(siteLat, siteLon, lat, lon)), lat, lon }
}

/** Same as `localise`, but for endpoints (mvt, cavites) that give flat
 * longitude/latitude fields directly rather than a GeoJSON geom. */
function localisePoint(siteLat: number, siteLon: number, itemLon: unknown, itemLat: unknown): Localisation | null {
  const lon = typeof itemLon === 'number' ? itemLon : Number(itemLon)
  const lat = typeof itemLat === 'number' ? itemLat : Number(itemLat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return { distanceM: haversineMeters(siteLat, siteLon, lat, lon), direction: cardinalDirection(bearingDegrees(siteLat, siteLon, lat, lon)), lat, lon }
}

/** Géorisques' gaspar/catnat dates are DD/MM/YYYY strings (verified live
 * against the real API), not directly parseable by `new Date()` — which
 * would misread e.g. "11/02/1987" as 2 November instead of 11 February. */
export function parseFrenchDate(value: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return Number.isNaN(date.getTime()) ? null : date
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
  localisation: Localisation | null
  /** Whether the establishment is actually under an ICPE regime today.
   * `installations_classees` also returns sites recorded as "Non ICPE" —
   * verified live: 62 of the 93 entries within 3 km of central Nantes — which
   * are establishments known to the inspectorate but not classified. Counting
   * them as installations classées would inflate every reading, so callers
   * filter on this rather than on the raw list. */
  classee: boolean
}

/** True for a SEVESO establishment at any threshold. The field carries a
 * descriptive label ("Seveso seuil haut"…) or a negative one, not a flag. */
export function estSeveso(item: IcpeItem): boolean {
  return item.seveso !== null && !/^\s*(non|néant)/i.test(item.seveso)
}

export async function fetchIcpe(lat: number, lon: number, rayon: number): Promise<ListResult<IcpeItem> | null> {
  const raw = await fetchPaginated('installations_classees', { latlon: latlon(lat, lon), rayon })
  if (raw === null) return null
  const items: IcpeItem[] = raw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const codeAIOT = str(item.codeAIOT)
    const regime = str(item.regime) ?? '—'
    return {
      nom: str(item.raisonSociale) ?? 'Établissement',
      commune: str(item.commune) ?? '',
      regime,
      classee: !/^non icpe$/i.test(regime),
      codeNaf: str(item.codeNaf),
      seveso: str(item.statutSeveso),
      ficheUrl: codeAIOT ? `https://www.georisques.gouv.fr/risques/installations/donnees/details/${encodeURIComponent(codeAIOT)}` : null,
      // Flat latitude/longitude fields, not a geom object — verified against
      // the proven reference (lyza-cartes.html's icpeMarker).
      localisation: localisePoint(lat, lon, item.longitude, item.latitude),
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

const SSP_PAGE_SIZE = 100
const SSP_MAX_PAGES = 5

/** `/ssp` paginates its casias/conclusions_sis/conclusions_sup sub-lists
 * together under one `page`/`page_size` — verified live: a dense 500m radius
 * in central Paris returned 104 CASIAS results across several pages with the
 * default (unspecified) page size, so a single unpaginated call was silently
 * truncating the list. */
export async function fetchSsp(lat: number, lon: number, rayon: number): Promise<SspResult | null> {
  const casiasAcc: unknown[] = []
  const sisConclusionsAcc: unknown[] = []
  const sisSupAcc: unknown[] = []
  let casiasTotal = 0
  let sisConclusionsTotal = 0
  let sisSupTotal = 0
  let sawAnyResponse = false

  for (let page = 1; page <= SSP_MAX_PAGES; page++) {
    const payload = await getRaw('ssp', { latlon: latlon(lat, lon), rayon, page, page_size: SSP_PAGE_SIZE })
    if (payload === null) break
    sawAnyResponse = true

    const casiasSub = payload.casias as Json | undefined
    const sisConclusions = payload.conclusions_sis as Json | undefined
    const sisSup = payload.conclusions_sup as Json | undefined

    const casiasData = Array.isArray(casiasSub?.data) ? (casiasSub!.data as unknown[]) : []
    const sisConclusionsData = Array.isArray(sisConclusions?.data) ? (sisConclusions!.data as unknown[]) : []
    const sisSupData = Array.isArray(sisSup?.data) ? (sisSup!.data as unknown[]) : []

    casiasAcc.push(...casiasData)
    sisConclusionsAcc.push(...sisConclusionsData)
    sisSupAcc.push(...sisSupData)

    casiasTotal = subResultCount(casiasSub, casiasAcc.length)
    sisConclusionsTotal = subResultCount(sisConclusions, sisConclusionsAcc.length)
    sisSupTotal = subResultCount(sisSup, sisSupAcc.length)

    const maxTotalPages = Math.max(
      typeof casiasSub?.total_pages === 'number' ? casiasSub.total_pages : 1,
      typeof sisConclusions?.total_pages === 'number' ? sisConclusions.total_pages : 1,
      typeof sisSup?.total_pages === 'number' ? sisSup.total_pages : 1,
    )
    const gotNothingThisPage = casiasData.length === 0 && sisConclusionsData.length === 0 && sisSupData.length === 0
    if (page >= Math.min(maxTotalPages, SSP_MAX_PAGES) || gotNothingThisPage) break
  }

  if (!sawAnyResponse) return null

  const casiasItems: CasiasItem[] = casiasAcc.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      identifiant: identifiantOf(item, 'identifiant_casias', 'identifiant_ssp'),
      nom: str(item.nom_etablissement) ?? 'Site industriel',
      commune: str(item.nom_commune) ?? '',
      activite: str(item.activite_principale),
      statut: str(item.statut),
      ficheUrl: str(item.fiche_risque),
      localisation: localise(lat, lon, item.geom),
    }
  })

  // conclusions_sis/conclusions_sup items weren't observed live (none nearby
  // at the point tested) — identifiant field name here is inferred by
  // analogy with identifiant_casias/identifiant_ssp, not confirmed.
  const sisItems: SisItem[] = [...sisConclusionsAcc, ...sisSupAcc].map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      identifiant: identifiantOf(item, 'identifiant_sis', 'identifiant_ssp', 'identifiant'),
      nom: str(item.nom) ?? "Secteur d'information sur les sols",
      commune: str(item.nom_commune) ?? '',
      superficieM2: typeof item.superficie === 'number' ? item.superficie : null,
      ficheUrl: str(item.fiche_risque),
      localisation: localise(lat, lon, item.geom),
    }
  })

  return {
    casias: { items: casiasItems, total: casiasTotal },
    sis: { items: sisItems, total: sisConclusionsTotal + sisSupTotal },
  }
}

// ---- Other point indicators (counts only — no proven per-item schema) ----

export async function countTim(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await getRaw('tim', { latlon: latlon(lat, lon), rayon }))
}

// ---- Mouvements de terrain (BRGM) — fields verified live: identifiant,
// type, lieu, commentaire_lieu, date_debut, longitude, latitude. No public
// per-item fiche URL was found (unlike ICPE/CASIAS/SIS), so these are listed
// with their own detail (type, lieu, date, distance) rather than a link.

export interface MvtItem {
  type: string
  lieu: string | null
  dateDebut: string | null
  localisation: Localisation | null
}

export async function fetchMvt(lat: number, lon: number, rayon: number): Promise<ListResult<MvtItem> | null> {
  const raw = await fetchPaginated('mvt', { latlon: latlon(lat, lon), rayon })
  if (raw === null) return null
  const items: MvtItem[] = raw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      type: str(item.type) ?? 'Mouvement de terrain',
      lieu: str(item.lieu) ?? str(item.commentaire_lieu),
      dateDebut: str(item.date_debut),
      localisation: localisePoint(lat, lon, item.longitude, item.latitude),
    }
  })
  return { items, total: items.length }
}

// ---- Cavités souterraines (BRGM) — fields verified live: identifiant,
// type, nom, reperage_geo, longitude, latitude. Same absence of a public
// per-item fiche URL.

export interface CaviteItem {
  type: string
  nom: string | null
  localisation: Localisation | null
}

export async function fetchCavites(lat: number, lon: number, rayon: number): Promise<ListResult<CaviteItem> | null> {
  const raw = await fetchPaginated('cavites', { latlon: latlon(lat, lon), rayon })
  if (raw === null) return null
  const items: CaviteItem[] = raw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      type: str(item.type) ?? 'Cavité souterraine',
      nom: str(item.nom),
      localisation: localisePoint(lat, lon, item.longitude, item.latitude),
    }
  })
  return { items, total: items.length }
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
  datePublicationArrete: string | null
  datePublicationJo: string | null
  /** Unique national identifier for the decree (verified live field:
   * code_national_catnat) — shown as a plain reference; no public page
   * keyed on it directly was found, so it isn't turned into a link. */
  codeNational: string | null
}

/** Arrêtés liés aux inondations et/ou coulées de boue pour la commune.
 * Confirmed live (Nîmes, 1987): the official label for this risk category is
 * exactly "Inondations et/ou Coulées de Boue", already matched by "inond" —
 * the "coulée de boue" check is kept as a safety net for any other wording. */
export async function fetchCatnatInondation(codeInsee: string): Promise<CatnatItem[] | null> {
  const payload = await getRaw('gaspar/catnat', { code_insee: codeInsee })
  if (payload === null) return null
  const items = Array.isArray(payload.data) ? payload.data : []
  return items
    .map((entry) => (entry ?? {}) as Record<string, unknown>)
    .filter((item) => {
      const libelle = String(item.libelle_risque_jo ?? '').toLowerCase()
      return libelle.includes('inond') || libelle.includes('coulee de boue') || libelle.includes('coulée de boue')
    })
    .map((item) => ({
      libelle: str(item.libelle_risque_jo) ?? 'Catastrophe naturelle',
      dateDebut: str(item.date_debut_evt),
      dateFin: str(item.date_fin_evt),
      datePublicationArrete: str(item.date_publication_arrete),
      datePublicationJo: str(item.date_publication_jo),
      codeNational: str(item.code_national_catnat),
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

// ---- Risques recensés pour la commune (GASPAR) ----------------------------

/** The commune's official risk list. Verified live (44109): `gaspar/risques`
 * returns a single record whose `risques_detail` holds one entry per risk,
 * with a hierarchical `num_risque` — "11" is the family (Inondation) and
 * "112", "114", "116" its sub-types. The families are what a reader wants;
 * the sub-types are returned too so a caller can detail one. */
export interface RisqueCommune {
  numero: string
  libelle: string
  /** True for a top-level family (two-digit code), false for a sub-type. */
  famille: boolean
}

export async function fetchRisquesCommune(codeInsee: string): Promise<RisqueCommune[] | null> {
  const payload = await getRaw('gaspar/risques', { code_insee: codeInsee })
  if (payload === null) return null
  const items = Array.isArray(payload.data) ? payload.data : []
  const first = items[0] as Record<string, unknown> | undefined
  const detail = Array.isArray(first?.risques_detail) ? (first!.risques_detail as Record<string, unknown>[]) : []
  return detail
    .map((entry) => ({
      numero: str(entry.num_risque) ?? '',
      libelle: str(entry.libelle_risque_long) ?? '',
      famille: (str(entry.num_risque) ?? '').length <= 2,
    }))
    .filter((risque) => risque.libelle !== '')
}

// ---- Plans de prévention des risques (PPRN / PPRT) ------------------------

/** PPR procedures affecting the commune. These two endpoints use a different
 * shape and a different parameter from the rest of the Géorisques API —
 * verified live: it is `codeInsee` (camelCase; `code_insee` is silently
 * ignored and returns all 6 584 national records), and the payload paginates
 * as `content` / `totalElements` rather than `data` / `results`. */
export interface PprItem {
  identifiant: string | null
  libelle: string
  typeProcedure: string | null
  /** Zoning categories defined by the plan, when it has a regulatory map. */
  zonages: string[]
}

async function fetchPpr(endpoint: 'pprn' | 'pprt', codeInsee: string): Promise<PprItem[] | null> {
  const payload = await getRaw(`gaspar/${endpoint}`, { codeInsee, page: 0, size: 50 })
  if (payload === null) return null
  const content = Array.isArray(payload.content) ? payload.content : []
  return content.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const zonage = item.zonageReglementaire as Record<string, unknown> | undefined
    const types = Array.isArray(zonage?.listTypeReg) ? (zonage!.listTypeReg as Record<string, unknown>[]) : []
    return {
      identifiant: str(item.idGaspar),
      libelle: str(item.libPpr) ?? 'Plan de prévention des risques',
      typeProcedure: str(item.modeleProcedure),
      zonages: [...new Set(types.map((type) => str(type.libelle)).filter((label): label is string => label !== null))],
    }
  })
}

export function fetchPprn(codeInsee: string): Promise<PprItem[] | null> {
  return fetchPpr('pprn', codeInsee)
}

export function fetchPprt(codeInsee: string): Promise<PprItem[] | null> {
  return fetchPpr('pprt', codeInsee)
}

/** General-purpose link to Géorisques' own address/commune risk lookup —
 * used as a catch-all "see everything" link. URL pattern is best-effort
 * (built from the commune's INSEE code); spot-check once deployed. */
export function communeRiskPortalUrl(codeInsee: string): string {
  return `https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi?code_insee=${encodeURIComponent(codeInsee)}`
}
