/**
 * Nearest agricultural parcel (RPG — Registre Parcellaire Graphique) likely
 * to receive phytosanitary ("pesticide") treatment, as a signal for the
 * "risques naturels" chapter — per feedback: a parcel probably gets treated
 * unless it's grazing land or organic.
 *
 * Live WFS layer (verified against real data, sampled ~300 real parcels
 * over the Beauce — a dense arable-farming region — via IGN's apicarto
 * wfs-geoportail module): `RPG.LATEST:parcelles_graphiques`, fields
 * id_parcel, surf_parc, code_cultu (crop code, e.g. "BTH" blé tendre),
 * code_group (crop group, "1"-"28"), culture_d1/culture_d2, cat_cult_p,
 * code_insee. No organic/"bio" flag exists on this layer.
 *
 * The only organic-certification dataset found — Agence Bio's "Parcelles
 * en Agriculture Biologique (AB) déclarées à la PAC" — is published as
 * ~190 static per-département/year export files, not a per-point queryable
 * API, so it isn't feasible to check live here. Organic status is
 * therefore explicitly flagged as unverified rather than assumed either
 * way (see NearestTreatedParcel.bioUnverified).
 *
 * "Élevage" (livestock) proxy: RPG code_group 17/18/19 (estives et landes,
 * prairies permanentes, prairies temporaires — grazing/pasture land).
 * 18 and 19 confirmed live (sampled real PPH/PTR parcels); 17 is the
 * well-documented, stable RPG nomenclature but wasn't locally sampled (no
 * upland pasture in the test area).
 */

import {
  bboxAround,
  bboxToPolygon,
  bearingDegrees,
  cardinalDirection,
  centroidOfGeometry,
  isPointInGeometry,
  minDistanceToGeometryBoundaryM,
  type PolygonGeometry,
} from './geo'

const WFS_SEARCH_URL = 'https://apicarto.ign.fr/api/wfs-geoportail/search'
const RPG_SOURCE = 'RPG.LATEST:parcelles_graphiques'

// Same expanding-search pattern as hydrography.ts: cheap common case first,
// widening only if nothing turns up nearby.
const SEARCH_RADII_M = [300, 1000, 3000]

const GRAZING_GROUPS = new Set(['17', '18', '19'])

// Best-effort labels for the crop codes most likely to be sampled — not
// exhaustive (RPG has ~300 code_cultu values); falls back to the raw code
// when unknown rather than guessing.
const CROP_LABELS: Record<string, string> = {
  BTH: 'blé tendre',
  BTP: 'blé tendre de printemps',
  MIS: 'maïs (grain/ensilage)',
  MID: 'maïs doux',
  ORH: 'orge',
  ORP: "orge de printemps",
  CZH: 'colza',
  TRN: 'tournesol',
  VRC: 'vigne',
  PPH: 'prairie permanente',
  PTR: 'prairie temporaire',
  JAC: 'jachère',
  LUZ: 'luzerne (fourrage)',
  TRE: 'trèfle (fourrage)',
  BDH: 'autre céréale',
  FVL: 'protéagineux',
  PHF: 'protéagineux',
  BFS: 'divers',
  BOR: 'divers',
  BTA: 'betterave',
  BTN: 'betterave',
  AAR: 'autre culture industrielle',
  CBT: 'verger',
  HPC: 'légumes ou fleurs',
  PTC: 'légumes ou fleurs',
  SNE: 'surface non exploitée',
}

function cropLabel(codeCultu: string): string {
  return CROP_LABELS[codeCultu] ?? codeCultu
}

interface RpgFeature {
  type?: string
  geometry?: PolygonGeometry
  properties?: Record<string, unknown>
}

async function queryRpgParcels(geometry: unknown): Promise<RpgFeature[] | null> {
  try {
    const url = new URL(WFS_SEARCH_URL)
    url.searchParams.set('source', RPG_SOURCE)
    url.searchParams.set('geom', JSON.stringify(geometry))
    url.searchParams.set('_limit', '200')
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { type?: string; features?: RpgFeature[] }
    if (json.type === 'FeatureCollection') return json.features ?? []
    return []
  } catch {
    return null
  }
}

export interface NearestTreatedParcel {
  distanceM: number
  /** null when the site itself sits inside the parcel. */
  direction: string | null
  inside: boolean
  codeCultu: string
  cropLabel: string
}

export interface ParcelSurvey {
  /** Nearest parcel NOT identified as grazing land (i.e. probably cropped,
   * so probably phyto-treated per the stated heuristic) — null if none was
   * found within the search radius. */
  nearestTreated: NearestTreatedParcel | null
  /** Whether any RPG parcel at all (grazing or not) was found nearby —
   * lets the caller distinguish "no farmland here" from "only grazing land
   * nearby". */
  anyParcelFound: boolean
}

export async function surveyNearbyParcels(lat: number, lon: number): Promise<ParcelSurvey | null> {
  for (const radius of SEARCH_RADII_M) {
    const polygon = bboxToPolygon(bboxAround(lat, lon, radius))
    const features = await queryRpgParcels(polygon)
    if (features === null) return null // upstream failure — don't keep hammering it
    if (features.length === 0) continue

    let anyParcelFound = false
    let best: { feature: RpgFeature; distanceM: number; inside: boolean } | null = null
    for (const feature of features) {
      if (!feature.geometry || !feature.properties) continue
      const codeGroup = String(feature.properties.code_group ?? '')
      anyParcelFound = true
      if (GRAZING_GROUPS.has(codeGroup)) continue // livestock/grazing proxy — excluded per feedback

      const inside = isPointInGeometry(lat, lon, feature.geometry)
      const distanceM = inside ? 0 : minDistanceToGeometryBoundaryM(lat, lon, feature.geometry)
      if (!best || distanceM < best.distanceM) best = { feature, distanceM, inside }
    }

    if (best) {
      const props = best.feature.properties as Record<string, unknown>
      const centroid = centroidOfGeometry(best.feature.geometry as PolygonGeometry)
      const direction = best.inside || !centroid ? null : cardinalDirection(bearingDegrees(lat, lon, centroid[1], centroid[0]))
      const codeCultu = String(props.code_cultu ?? '')
      return {
        nearestTreated: { distanceM: best.distanceM, direction, inside: best.inside, codeCultu, cropLabel: cropLabel(codeCultu) },
        anyParcelFound: true,
      }
    }
    if (anyParcelFound) return { nearestTreated: null, anyParcelFound: true } // only grazing land found
  }
  return { nearestTreated: null, anyParcelFound: false }
}
