/**
 * Cadastral parcels, and the merged footprint the whole platform then works
 * from.
 *
 * A postal address is a point; a site is a surface. Geocoding an address puts
 * the marker somewhere on the plot — often on the building, sometimes on the
 * road axis — and every distance, every aerial frame and every "is the site
 * inside this zone" question is then answered for that arbitrary point rather
 * than for the land actually under study. Picking the parcels and merging them
 * replaces that guess with the perimeter the reader means.
 *
 * Source: IGN's API Carto cadastre module, backed by PCI Express (the
 * "parcellaire express" the Géoplateforme also serves as a tile layer, so what
 * a reader clicks and what is returned come from the same dataset).
 */

import union from '@turf/union'
import { featureCollection, polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/helpers'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { PolygonGeometry } from './geo'

const PARCELLE_URL = 'https://apicarto.ign.fr/api/cadastre/parcelle'
const DELAI_MS = 15000

export interface ParcelleCadastrale {
  /** National parcel identifier, e.g. "44109000EO0207". */
  idu: string
  section: string | null
  numero: string | null
  commune: string | null
  codeInsee: string | null
  /** Cadastral area in m², as recorded in the register — not recomputed from
   * the geometry, which would differ by a few percent. */
  contenanceM2: number | null
  geometry: PolygonGeometry
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : null
}

/** The parcel under a point, or null where the cadastre has none — a road, a
 * river, a public space, or a commune still under the older "cadastre
 * napoléonien" that PCI Express does not cover. */
export async function fetchParcelleAt(lat: number, lon: number): Promise<ParcelleCadastrale | null> {
  const controller = new AbortController()
  const minuteur = setTimeout(() => controller.abort(), DELAI_MS)
  try {
    const geom = JSON.stringify({ type: 'Point', coordinates: [lon, lat] })
    const response = await fetch(`${PARCELLE_URL}?geom=${encodeURIComponent(geom)}`, { signal: controller.signal })
    if (!response.ok) return null
    const collection = (await response.json()) as { features?: { properties?: Record<string, unknown>; geometry?: PolygonGeometry }[] }
    const feature = collection.features?.[0]
    if (!feature?.geometry) return null
    const p = feature.properties ?? {}
    const idu = texte(p.idu)
    if (!idu) return null
    return {
      idu,
      section: texte(p.section),
      numero: texte(p.numero),
      commune: texte(p.nom_com),
      codeInsee: texte(p.code_insee),
      contenanceM2: typeof p.contenance === 'number' ? p.contenance : null,
      geometry: feature.geometry,
    }
  } catch {
    return null
  } finally {
    clearTimeout(minuteur)
  }
}

function enFeature(geometry: PolygonGeometry): Feature<Polygon | MultiPolygon> {
  return geometry.type === 'Polygon'
    ? (turfPolygon(geometry.coordinates as number[][][]) as Feature<Polygon>)
    : (turfMultiPolygon(geometry.coordinates as number[][][][]) as Feature<MultiPolygon>)
}

/**
 * Merges the selected parcels into a single footprint.
 *
 * Adjacent parcels dissolve into one outline, which is the point: the shared
 * boundary between two plots of the same site is a property line, not a
 * feature of the land. Parcels that do not touch stay as separate parts of a
 * MultiPolygon rather than being joined by a fictitious bridge.
 *
 * A union can fail on degenerate geometry. When it does, the parcels are kept
 * side by side instead of dropping the selection: an outline with visible
 * internal boundaries is still the right perimeter.
 */
export function fusionner(parcelles: ParcelleCadastrale[]): PolygonGeometry | null {
  if (parcelles.length === 0) return null
  if (parcelles.length === 1) return parcelles[0].geometry
  try {
    const fusion = union(featureCollection(parcelles.map((parcelle) => enFeature(parcelle.geometry))))
    if (fusion?.geometry) return fusion.geometry as PolygonGeometry
  } catch {
    // fall through to the unmerged footprint below
  }
  return {
    type: 'MultiPolygon',
    coordinates: parcelles.flatMap((parcelle) =>
      parcelle.geometry.type === 'Polygon' ? [parcelle.geometry.coordinates] : (parcelle.geometry.coordinates as unknown[]),
    ),
  } as PolygonGeometry
}

/** Total cadastral area of a selection, in m². */
export function surfaceTotale(parcelles: ParcelleCadastrale[]): number {
  return parcelles.reduce((somme, parcelle) => somme + (parcelle.contenanceM2 ?? 0), 0)
}

export function formatSurface(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ha`
  return `${Math.round(m2).toLocaleString('fr-FR')} m²`
}

/** "EO 0207" — how a parcel is referred to on the ground and in a deed. */
export function libelleParcelle(parcelle: ParcelleCadastrale): string {
  return [parcelle.section, parcelle.numero].filter(Boolean).join(' ') || parcelle.idu
}

/** Bounding box of a footprint, as [south, west, north, east]. */
export function emprisesBounds(geometry: PolygonGeometry): [[number, number], [number, number]] | null {
  const rings: number[][][] =
    geometry.type === 'Polygon' ? (geometry.coordinates as number[][][]) : (geometry.coordinates as number[][][][]).flat()
  let sud = Infinity
  let ouest = Infinity
  let nord = -Infinity
  let est = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lat < sud) sud = lat
      if (lat > nord) nord = lat
      if (lon < ouest) ouest = lon
      if (lon > est) est = lon
    }
  }
  return Number.isFinite(sud) ? [[sud, ouest], [nord, est]] : null
}

/**
 * Centre of a footprint, as [lon, lat].
 *
 * Deliberately the centre of its bounding box, not `centroidOfGeometry`: that
 * one averages the vertices of the *first* ring, so on a footprint made of
 * several parcels it returns the centre of whichever parcel happens to come
 * first and ignores the rest. This point is not cosmetic — it becomes the
 * site's lat/lon, so every distance, every map framing and every aerial frame
 * downstream hangs off it.
 */
export function centreEmprise(geometry: PolygonGeometry): [number, number] | null {
  const bounds = emprisesBounds(geometry)
  if (!bounds) return null
  const [[sud, ouest], [nord, est]] = bounds
  return [(ouest + est) / 2, (sud + nord) / 2]
}

/** Longest side of the footprint in metres — what a frame has to span to show
 * the whole site. */
export function diagonaleM(geometry: PolygonGeometry): number {
  const bounds = emprisesBounds(geometry)
  if (!bounds) return 0
  const [[sud, ouest], [nord, est]] = bounds
  const hauteur = (nord - sud) * 111320
  const largeur = (est - ouest) * 111320 * Math.cos(((nord + sud) / 2) * (Math.PI / 180))
  return Math.max(hauteur, largeur)
}
