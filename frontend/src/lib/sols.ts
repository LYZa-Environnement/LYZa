/**
 * Soil description at the study site, from the GIS Sol / INRAE layers
 * published on the IGN Géoplateforme WFS.
 *
 * Two things are read here, and they answer different questions:
 *  - `sols_dominants_france_metropolitaine` — the dominant soil type of the
 *    mapping unit covering the point (FLUVIOSOL, COLLUVIOSOL…), with the
 *    pedological description of that unit.
 *  - `vibrisses_RMQS` — the regional *background* contents of ten trace
 *    elements in agricultural topsoil, per grid cell. This is the reference a
 *    measured concentration should be read against: above it means enriched
 *    relative to the natural/diffuse local background, not necessarily
 *    polluted. The per-element layers published alongside cover cadmium only;
 *    the base layer carries As, Cd, Co, Cr, Cu, Hg, Mo, Ni, Pb and Zn as
 *    attributes, which is what is read here.
 *
 * Both layers are served in Lambert 93 only — verified live: an EPSG:4326
 * BBOX returns zero features whatever the axis order, while the same window
 * in EPSG:2154 returns the expected polygons. Hence the projection dance.
 *
 * The RMQS *measurement* table (`Teneurs_ponctuelles_49_variables_RMQS`) is
 * deliberately not used: it is published without geometry (verified — every
 * feature has `geometry: null`), because RMQS site coordinates are withheld
 * to protect the landowners. There is therefore no way to report the RMQS
 * measurements nearest a given address, and the UI says so rather than
 * implying the network has no data.
 *
 * The typenames embed a publication date and will change when GIS Sol
 * republishes; a stale one simply yields null, like any other unavailable
 * source.
 */

import { fromLambert93, lambert93Bbox } from './geo'

const WFS_BASE = 'https://data.geopf.fr/wfs/ows'

const TYPE_SOLS_DOMINANTS = 'etude_34015_gpkg_04-09-2026_wfs:sols_dominants_france_metropolitaine'
const TYPE_FOND_TOUS_ELEMENTS = 'vibrisses_rmqs_gpkg_03-09-2026_wfs:vibrisses_RMQS'

interface WfsFeature {
  geometry?: { type?: string; coordinates?: unknown } | null
  properties?: Record<string, unknown>
}

async function queryWfs(typename: string, lat: number, lon: number, radiusM: number, count = 5): Promise<WfsFeature[] | null> {
  try {
    const url = `${WFS_BASE}?${new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: typename,
      COUNT: String(count),
      OUTPUTFORMAT: 'application/json',
      BBOX: `${lambert93Bbox(lat, lon, radiusM)},EPSG:2154`,
    })}`
    const response = await fetch(url)
    if (!response.ok) return null
    const json = (await response.json()) as { features?: WfsFeature[] }
    return json.features ?? []
  } catch {
    return null
  }
}

/** Reprojects a Lambert 93 GeoJSON geometry to WGS84 in place-free fashion,
 * so it can be handed straight to Leaflet. */
function reproject(geometry: { type?: string; coordinates?: unknown }): { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } | null {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  const convert = (node: unknown, depth: number): unknown => {
    if (depth === 0) {
      const [x, y] = node as [number, number]
      return fromLambert93(x, y)
    }
    return (node as unknown[]).map((child) => convert(child, depth - 1))
  }
  const depth = geometry.type === 'Polygon' ? 2 : 3
  return { type: geometry.type, coordinates: convert(geometry.coordinates, depth) }
}

export interface TypeDeSol {
  nomSolDominant: string | null
  nomUniteCartographique: string | null
  partSolDominant: number | null
  geometrie: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } | null
}

export async function fetchTypeDeSol(lat: number, lon: number): Promise<TypeDeSol | null> {
  const features = await queryWfs(TYPE_SOLS_DOMINANTS, lat, lon, 1200, 3)
  if (!features || features.length === 0) return null
  const props = features[0].properties ?? {}
  const geometry = features[0].geometry
  return {
    nomSolDominant: typeof props.nom_sol_dominant === 'string' ? props.nom_sol_dominant : null,
    nomUniteCartographique: typeof props.nom_ucs === 'string' ? props.nom_ucs : null,
    partSolDominant: typeof props.pourcent_sol_dominant === 'number' ? props.pourcent_sol_dominant : null,
    geometrie: geometry ? reproject(geometry) : null,
  }
}

export interface ElementTrace {
  symbole: string
  nom: string
  valeur: number
  unite: string
}

export interface FondPedoGeochimique {
  elements: ElementTrace[]
  profondeur: string
  /** Grid cell the values describe — they are not point measurements. */
  cellule: number | null
}

// The attribute names on the full `vibrisses_RMQS` layer, verified live:
// "<symbole>_0_30" for topsoil and "<symbole>_30_50" below it. Only the
// topsoil horizon is reported — it is the one that matters for exposure and
// the one that is populated nationally.
const ELEMENTS: { cle: string; symbole: string; nom: string }[] = [
  { cle: 'as_0_30', symbole: 'As', nom: 'Arsenic' },
  { cle: 'cd_0_30', symbole: 'Cd', nom: 'Cadmium' },
  { cle: 'co_0_30', symbole: 'Co', nom: 'Cobalt' },
  { cle: 'cr_0_30', symbole: 'Cr', nom: 'Chrome' },
  { cle: 'cu_0_30', symbole: 'Cu', nom: 'Cuivre' },
  { cle: 'hg_0_30', symbole: 'Hg', nom: 'Mercure' },
  { cle: 'mo_0_30', symbole: 'Mo', nom: 'Molybdène' },
  { cle: 'ni_0_30', symbole: 'Ni', nom: 'Nickel' },
  { cle: 'pb_0_30', symbole: 'Pb', nom: 'Plomb' },
  { cle: 'zn_0_30', symbole: 'Zn', nom: 'Zinc' },
]

/** Local background contents of the trace elements the RMQS "vibrisses" grid
 * publishes — ten of them, not just cadmium: the per-element layers only cover
 * Cd, but the base layer carries every element as an attribute. */
export async function fetchFondGeochimique(lat: number, lon: number): Promise<FondPedoGeochimique | null> {
  const features = await queryWfs(TYPE_FOND_TOUS_ELEMENTS, lat, lon, 5000, 3)
  if (!features || features.length === 0) return null
  const props = features[0].properties ?? {}
  const elements: ElementTrace[] = []
  for (const { cle, symbole, nom } of ELEMENTS) {
    const valeur = props[cle]
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) continue
    elements.push({ symbole, nom, valeur, unite: 'mg/kg' })
  }
  if (elements.length === 0) return null
  return {
    elements,
    profondeur: '0 – 30 cm',
    cellule: typeof props.no_cellule === 'number' ? props.no_cellule : null,
  }
}
