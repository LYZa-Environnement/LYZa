/**
 * Noise exposure around a site.
 *
 * Two things are reported, and only one of them is a regulatory noise dataset:
 *
 *  - **Plan d'exposition au bruit (PEB) des aérodromes** — the real one. A
 *    national layer published by the DGAC on the Géoplateforme WFS
 *    (`dgac_peb_arrete_wfs`), verified live: one point per aerodrome with an
 *    approved PEB, carrying the aerodrome's ICAO code and a direct link to the
 *    signed arrêté (PDF). A PEB is opposable — it restricts what may be built
 *    inside its zones — so its presence near a site is a hard planning fact,
 *    not an indication.
 *
 *  - **Distance to major road and rail infrastructure** (IGN BD TOPO®) — a
 *    proximity proxy, labelled as such. There is no open national service for
 *    the strategic noise maps or the "classement sonore des infrastructures":
 *    both are produced département by département and published as scattered
 *    préfecture files, and Bruitparif's measured data covers Île-de-France
 *    only. The distance is not a sound level and the UI says so.
 *
 * `importance` on `troncon_de_route` is BD TOPO's road hierarchy, verified
 * live: "1" is the motorway/national tier down to "6" for local streets. Only
 * tiers 1-3 count as major noise sources.
 */

import { bboxAround, bboxToPolygon, bearingDegrees, cardinalDirection, haversineMeters, nearestPointOnSegment } from './geo'

const WFS_GEOPORTAIL = 'https://apicarto.ign.fr/api/wfs-geoportail/search'
const WFS_GEOPF = 'https://data.geopf.fr/wfs/ows'
const SEARCH_RADII_M = [500, 1500, 4000]

const IMPORTANCE_LABELS: Record<string, string> = {
  '1': 'Autoroute ou liaison nationale majeure',
  '2': 'Liaison régionale structurante',
  '3': 'Liaison départementale importante',
}

interface Feature {
  geometry?: { type?: string; coordinates?: unknown }
  properties?: Record<string, unknown>
}

async function queryWfs(source: string, lat: number, lon: number, radiusM: number): Promise<Feature[] | null> {
  try {
    const url = new URL(WFS_GEOPORTAIL)
    url.searchParams.set('source', source)
    url.searchParams.set('geom', JSON.stringify(bboxToPolygon(bboxAround(lat, lon, radiusM))))
    url.searchParams.set('_limit', '300')
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { features?: Feature[] }
    return json.features ?? []
  } catch {
    return null
  }
}

function nearestOnFeature(lat: number, lon: number, geometry: Feature['geometry']): { lat: number; lon: number; distanceM: number } | null {
  if (!geometry?.coordinates) return null
  const lines: [number, number][][] =
    geometry.type === 'LineString'
      ? [geometry.coordinates as [number, number][]]
      : geometry.type === 'MultiLineString'
        ? (geometry.coordinates as [number, number][][])
        : []
  let best: { lat: number; lon: number; distanceM: number } | null = null
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lon1, lat1] = line[i]
      const [lon2, lat2] = line[i + 1]
      const candidate = nearestPointOnSegment(lat, lon, lat1, lon1, lat2, lon2)
      if (!best || candidate.distanceM < best.distanceM) best = candidate
    }
  }
  return best
}

export interface SourceBruit {
  type: 'route' | 'fer'
  nom: string | null
  categorie: string | null
  distanceM: number
  direction: string
  lat: number
  lon: number
}

export interface Aerodrome {
  nom: string
  oaci: string | null
  distanceM: number
  direction: string
  lat: number
  lon: number
  /** Link to the approved PEB decree (PDF), when the layer carries one. */
  arreteUrl: string | null
}

export interface BruitReport {
  route: SourceBruit | null
  fer: SourceBruit | null
  aerodrome: Aerodrome | null
}

async function findNearest(
  source: string,
  type: SourceBruit['type'],
  lat: number,
  lon: number,
  accept: (props: Record<string, unknown>) => boolean,
  describe: (props: Record<string, unknown>) => { nom: string | null; categorie: string | null },
): Promise<SourceBruit | null> {
  for (const radius of SEARCH_RADII_M) {
    const features = await queryWfs(source, lat, lon, radius)
    if (features === null) return null
    let best: SourceBruit | null = null
    for (const feature of features) {
      const props = feature.properties ?? {}
      if (!accept(props)) continue
      const nearest = nearestOnFeature(lat, lon, feature.geometry)
      if (!nearest) continue
      if (!best || nearest.distanceM < best.distanceM) {
        const { nom, categorie } = describe(props)
        best = {
          type,
          nom,
          categorie,
          distanceM: nearest.distanceM,
          direction: cardinalDirection(bearingDegrees(lat, lon, nearest.lat, nearest.lon)),
          lat: nearest.lat,
          lon: nearest.lon,
        }
      }
    }
    if (best) return best
  }
  return null
}

/** Nearest aerodrome holding an approved noise-exposure plan. The layer is
 * small (one point per aerodrome nationally) and has no spatial filter worth
 * using, so it is fetched whole and searched locally. */
async function findAerodromePeb(lat: number, lon: number): Promise<Aerodrome | null> {
  try {
    const url = `${WFS_GEOPF}?${new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: 'dgac_peb_arrete_wfs:dgac_peb_arrete_wfs',
      COUNT: '1000',
      OUTPUTFORMAT: 'application/json',
    })}`
    const response = await fetch(url)
    if (!response.ok) return null
    const json = (await response.json()) as { features?: Feature[] }
    let best: Aerodrome | null = null
    for (const feature of json.features ?? []) {
      const geometry = feature.geometry
      if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) continue
      const [featureLon, featureLat] = geometry.coordinates as [number, number]
      if (!Number.isFinite(featureLon) || !Number.isFinite(featureLat)) continue
      const distanceM = haversineMeters(lat, lon, featureLat, featureLon)
      if (best && distanceM >= best.distanceM) continue
      const props = feature.properties ?? {}
      const arrete = typeof props.arrete_peb === 'string' && props.arrete_peb.startsWith('http') ? props.arrete_peb : null
      best = {
        nom: typeof props.nom === 'string' ? props.nom : 'Aérodrome',
        oaci: typeof props.oaci === 'string' ? props.oaci : null,
        distanceM,
        direction: cardinalDirection(bearingDegrees(lat, lon, featureLat, featureLon)),
        lat: featureLat,
        lon: featureLon,
        arreteUrl: arrete,
      }
    }
    return best
  } catch {
    return null
  }
}

export async function fetchSourcesBruit(lat: number, lon: number): Promise<BruitReport> {
  const [route, fer, aerodrome] = await Promise.all([
    findNearest(
      'BDTOPO_V3:troncon_de_route',
      'route',
      lat,
      lon,
      (props) => ['1', '2', '3'].includes(String(props.importance ?? '')) && props.etat_de_l_objet === 'En service',
      (props) => ({
        nom: (typeof props.nom_collaboratif_gauche === 'string' && props.nom_collaboratif_gauche) || (typeof props.numero === 'string' ? props.numero : null),
        categorie: IMPORTANCE_LABELS[String(props.importance ?? '')] ?? null,
      }),
    ),
    findNearest(
      'BDTOPO_V3:troncon_de_voie_ferree',
      'fer',
      lat,
      lon,
      // "Voie de service" is a siding or depot track, not a running line —
      // verified as a real `nature` value on this layer, and excluded because
      // it carries no through traffic worth reading as a noise source.
      (props) => props.etat_de_l_objet === 'En service' && props.nature !== 'Voie de service',
      (props) => ({
        nom: null,
        categorie:
          [typeof props.nature === 'string' ? props.nature : null, props.electrifie === true ? 'électrifiée' : null].filter(Boolean).join(', ') || null,
      }),
    ),
    findAerodromePeb(lat, lon),
  ])
  return { route, fer, aerodrome }
}
