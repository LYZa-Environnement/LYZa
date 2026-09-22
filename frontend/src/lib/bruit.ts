/**
 * Noise exposure — by proximity to the infrastructure that causes it, not by
 * measured or modelled sound levels.
 *
 * There is no open national API serving strategic noise maps (cartes de bruit
 * stratégiques) or the "classement sonore des infrastructures de transport"
 * per point: both are produced département by département and published as
 * scattered PDF/SIG files by each préfecture, and Bruitparif's measured data
 * covers Île-de-France only. So this reports what *is* nationally available
 * and verifiable — the distance to the nearest major road and railway, from
 * IGN BD TOPO® — and the UI states plainly that this is a proxy for exposure,
 * not a sound level.
 *
 * `importance` on `troncon_de_route` is BD TOPO's road-hierarchy field,
 * verified live: "1" is the national/motorway top tier down to "6" for local
 * streets. Only tiers 1-3 are treated as major noise sources.
 */

import { bboxAround, bboxToPolygon, bearingDegrees, cardinalDirection, nearestPointOnSegment } from './geo'

const WFS_SEARCH_URL = 'https://apicarto.ign.fr/api/wfs-geoportail/search'
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
    const url = new URL(WFS_SEARCH_URL)
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
  /** Nearest point of the infrastructure, for the map. */
  lat: number
  lon: number
}

export interface BruitReport {
  route: SourceBruit | null
  fer: SourceBruit | null
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

export async function fetchSourcesBruit(lat: number, lon: number): Promise<BruitReport> {
  const [route, fer] = await Promise.all([
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
        categorie: [typeof props.nature === 'string' ? props.nature : null, props.electrifie === true ? 'électrifiée' : null]
          .filter(Boolean)
          .join(', ') || null,
      }),
    ),
  ])
  return { route, fer }
}
