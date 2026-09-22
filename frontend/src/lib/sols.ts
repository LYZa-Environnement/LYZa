/**
 * Soil description at the study site, from the GIS Sol / INRAE layers
 * published on the IGN Géoplateforme WFS.
 *
 * Two things are read here, and they answer different questions:
 *  - `sols_dominants_france_metropolitaine` — the dominant soil type of the
 *    mapping unit covering the point (FLUVIOSOL, COLLUVIOSOL…), with the
 *    pedological description of that unit.
 *  - `vibrisses_RMQS_*` — the regional *background* content of a trace
 *    element in agricultural topsoil, per grid cell. This is the reference a
 *    measured concentration should be read against: above it means enriched
 *    relative to the natural/diffuse local background, not necessarily
 *    polluted.
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
const TYPE_FOND_CADMIUM = 'vibrisses_rmqs_gpkg_03-09-2026_wfs:vibrisses_RMQS_cd_0_30'

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

export interface FondPedoGeochimique {
  element: string
  valeur: number
  unite: string
  profondeur: string
}

/** Local background cadmium content in topsoil — the one trace element whose
 * "vibrisses" grid is published as a queryable layer here. */
export async function fetchFondGeochimique(lat: number, lon: number): Promise<FondPedoGeochimique | null> {
  const features = await queryWfs(TYPE_FOND_CADMIUM, lat, lon, 5000, 3)
  if (!features || features.length === 0) return null
  const valeur = features[0].properties?.valeur
  if (typeof valeur !== 'number') return null
  return { element: 'Cadmium (Cd)', valeur, unite: 'mg/kg', profondeur: '0 – 30 cm' }
}
