/**
 * Client for the public Géorisques API (BRGM) — https://www.georisques.gouv.fr/doc-api
 * Called directly from the browser (no key required, CORS-enabled — the same
 * endpoints are already called this way from frontend/public/lyza-cartes.html).
 *
 * Every function returns null on any network/parsing failure instead of
 * throwing: one upstream indicator being unavailable should never take down
 * the whole synthesis, it should just show up as "donnée indisponible".
 */

const GEORISQUES_BASE_URL = 'https://georisques.gouv.fr/api/v1/'

function latlon(lat: number, lon: number): string {
  return `${lon},${lat}`
}

type JsonValue = Record<string, unknown> | unknown[] | null

async function get(path: string, params: Record<string, string | number>): Promise<JsonValue> {
  try {
    const url = new URL(path, GEORISQUES_BASE_URL)
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    const response = await fetch(url.toString())
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function count(payload: JsonValue): number | null {
  if (payload === null) return null
  if (Array.isArray(payload)) return payload.length
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (typeof obj.totalElements === 'number') return obj.totalElements
    if (Array.isArray(obj.data)) return obj.data.length
  }
  return null
}

function firstField(payload: JsonValue, ...candidateKeys: string[]): unknown {
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).data
      : null
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

/** Anciens sites industriels et activités de service (BASIAS). */
export async function countBasias(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await get('basias', { latlon: latlon(lat, lon), rayon }))
}

/** Sites et sols pollués, ou potentiellement pollués (ex-BASOL). */
export async function countSsp(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await get('ssp', { latlon: latlon(lat, lon), rayon }))
}

/** Installations classées pour la protection de l'environnement. */
export async function countIcpe(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await get('installations_classees', { latlon: latlon(lat, lon), rayon }))
}

/** Canalisations de transport de matières dangereuses. */
export async function countTim(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await get('tim', { latlon: latlon(lat, lon), rayon }))
}

/** Mouvements de terrain recensés. */
export async function countMvt(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await get('mvt', { latlon: latlon(lat, lon), rayon }))
}

/** Cavités souterraines recensées. */
export async function countCavites(lat: number, lon: number, rayon: number): Promise<number | null> {
  return count(await get('cavites', { latlon: latlon(lat, lon), rayon }))
}

/** Atlas des zones inondables — y a-t-il une zone recensée à proximité ? */
export async function inAzi(lat: number, lon: number, rayon: number): Promise<boolean | null> {
  const c = count(await get('azi', { latlon: latlon(lat, lon), rayon }))
  return c === null ? null : c > 0
}

/** Arrêtés de catastrophe naturelle liés aux inondations sur la commune. */
export async function catnatInondationCount(codeInsee: string): Promise<number | null> {
  const payload = await get('gaspar/catnat', { code_insee: codeInsee })
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).data
      : null
  if (!Array.isArray(items)) return null
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const label = String((item as Record<string, unknown>).libelle_risque_jo ?? '')
    return label.toLowerCase().includes('inond')
  }).length
}

export async function zonageSismique(codeInsee: string): Promise<number | null> {
  const payload = await get('zonage_sismique', { code_insee: codeInsee })
  return toInt(firstField(payload, 'zone_sismicite', 'code_zone'))
}

export async function argilesExposition(codeInsee: string): Promise<string | null> {
  const payload = await get('argiles', { code_insee: codeInsee })
  const value = firstField(payload, 'expo', 'alea', 'exposition')
  return value === null ? null : String(value)
}

export async function radonClasse(codeInsee: string): Promise<number | null> {
  const payload = await get('radon', { code_insee: codeInsee })
  return toInt(firstField(payload, 'classe_potentiel', 'classe'))
}
