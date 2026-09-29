/**
 * The watercourse nearest a site, assembled as a single polyline ordered
 * from upstream to downstream — so anything else nearby can be placed
 * *amont* or *aval* of the site, not merely "500 m au nord".
 *
 * Source: IGN BD TOPO® `BDTOPO_V3:troncon_hydrographique`, queried through
 * API Carto's wfs-geoportail module (the same access path hydrography.ts
 * already uses for `cours_d_eau`). This layer is used rather than
 * `cours_d_eau` because it carries `sens_de_l_ecoulement` — verified live
 * over the Loire basin: "Sens direct" (flow follows the digitised vertex
 * order), "Sens inverse" (flow runs against it), or an indeterminate value
 * for standing/ambiguous water. Without that attribute there is no honest
 * way to tell upstream from downstream, and the rubriques say so instead of
 * guessing.
 */

import { bboxAround, bboxToPolygon, bearingDegrees, cardinalDirection, haversineMeters, nearestPointOnSegment } from './geo'

const WFS_SEARCH_URL = 'https://apicarto.ign.fr/api/wfs-geoportail/search'
const SOURCE = 'BDTOPO_V3:troncon_hydrographique'
/** Named watercourses. The tronçon layer carries the flow direction but its
 * own `toponyme` is empty on every reach sampled — the name lives here, keyed
 * by the identifier the tronçons point at. */
const SOURCE_COURS = 'BDTOPO_V3:cours_d_eau'
const SEARCH_RADII_M = [500, 2000, 6000]
/** How far downstream the outlet is looked for, and in how many hops. A ditch
 * usually reaches a named river within a kilometre or two; past that the
 * answer stops being about this site. */
const EXUTOIRE_HOPS = 5
const EXUTOIRE_RAYON_M = 400

type Position = [number, number]

interface Troncon {
  path: Position[]
  coursDEau: string | null
  nom: string | null
  flowKnown: boolean
}

/** A named watercourse found further out, when the nearest one carries no
 * toponym in BD TOPO — an unnamed ditch 80 m away says less about a site than
 * the river it drains into. */
export interface CoursDEauNomme {
  nom: string
  distanceM: number
  direction: string
  path: [number, number][]
}

/** The named watercourse the site's reach eventually flows into.
 *
 * A ditch 80 m from a plot matters — it is the first thing that carries runoff
 * away — but on its own it names nothing a reader recognises. Following it
 * downstream to the river it joins turns "un fossé au nord" into "un fossé qui
 * rejoint la Loire 1,6 km en aval". */
export interface Exutoire {
  nom: string
  /** Distance along the network from the site's reach to the confluence. */
  cheminM: number
  /** Straight-line distance and direction from the site to the confluence. */
  distanceM: number
  direction: string
  lat: number
  lon: number
  /** How many watercourses are crossed before reaching the named one. */
  relais: number
}

export interface ReseauHydro {
  /** Upstream-to-downstream ordered path, in [lat, lon] for Leaflet. */
  path: [number, number][]
  nom: string | null
  /** Set only when `nom` is null: the closest watercourse that does have a
   * name, so the reader still gets a recognisable receptor. */
  premierNomme: CoursDEauNomme | null
  /** Shortest distance from the site to the watercourse, in metres. */
  distanceM: number
  direction: string
  /** False when BD TOPO gives no usable flow direction here — callers must
   * then omit any amont/aval wording rather than assume one. */
  flowKnown: boolean
  /** Distance along the ordered path at which the site projects. */
  siteOffsetM: number
  /** Total length of the assembled path. */
  longueurM: number
  /** The named watercourse this reach drains into, when it is not itself
   * named and one can be reached downstream. */
  exutoire: Exutoire | null
}

function reverse(path: Position[]): Position[] {
  return [...path].reverse()
}

async function queryTroncons(lat: number, lon: number, radiusM: number): Promise<Troncon[] | null> {
  try {
    const url = new URL(WFS_SEARCH_URL)
    url.searchParams.set('source', SOURCE)
    url.searchParams.set('geom', JSON.stringify(bboxToPolygon(bboxAround(lat, lon, radiusM))))
    url.searchParams.set('_limit', '200')
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { features?: { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }[] }
    const out: Troncon[] = []
    for (const feature of json.features ?? []) {
      const geometry = feature.geometry
      if (!geometry?.coordinates) continue
      const lines: Position[][] =
        geometry.type === 'LineString'
          ? [(geometry.coordinates as number[][]).map((c) => [c[0], c[1]] as Position)]
          : geometry.type === 'MultiLineString'
            ? (geometry.coordinates as number[][][]).map((line) => line.map((c) => [c[0], c[1]] as Position))
            : []
      const props = feature.properties ?? {}
      const sens = String(props.sens_de_l_ecoulement ?? '')
      const flowKnown = sens === 'Sens direct' || sens === 'Sens inverse'
      for (const line of lines) {
        if (line.length < 2) continue
        out.push({
          path: sens === 'Sens inverse' ? reverse(line) : line,
          coursDEau: typeof props.liens_vers_cours_d_eau === 'string' ? props.liens_vers_cours_d_eau : null,
          nom: typeof props.toponyme === 'string' && props.toponyme.trim() ? props.toponyme.trim() : null,
          flowKnown,
        })
      }
    }
    return out
  } catch {
    return null
  }
}

/** Names of the watercourses around a point, keyed by the identifier the
 * tronçons carry in `liens_vers_cours_d_eau`. */
async function fetchNomsCoursDEau(lat: number, lon: number, radiusM: number): Promise<Map<string, string>> {
  const noms = new Map<string, string>()
  try {
    const url = new URL(WFS_SEARCH_URL)
    url.searchParams.set('source', SOURCE_COURS)
    url.searchParams.set('geom', JSON.stringify(bboxToPolygon(bboxAround(lat, lon, radiusM))))
    url.searchParams.set('_limit', '150')
    const response = await fetch(url.toString())
    if (!response.ok) return noms
    const json = (await response.json()) as { features?: { properties?: Record<string, unknown> }[] }
    for (const feature of json.features ?? []) {
      const props = feature.properties ?? {}
      const id = typeof props.cleabs === 'string' ? props.cleabs : null
      const nom = typeof props.toponyme === 'string' && props.toponyme.trim() ? props.toponyme.trim() : null
      if (id && nom) noms.set(id, nom)
    }
  } catch {
    // An unnamed watercourse is a lesser answer, never a reason to drop the
    // whole hydrographic reading.
  }
  return noms
}

/** `liens_vers_cours_d_eau` can hold several identifiers separated by a
 * slash where a reach belongs to more than one course — the first one that
 * resolves to a name is the one to show. */
function nomDe(lien: string | null, noms: Map<string, string>): string | null {
  if (!lien) return null
  for (const id of lien.split('/')) {
    const nom = noms.get(id.trim())
    if (nom) return nom
  }
  return null
}

function projectOnPath(lat: number, lon: number, path: Position[]): { distanceM: number; offsetM: number; lat: number; lon: number } | null {
  let travelled = 0
  let best: { distanceM: number; offsetM: number; lat: number; lon: number } | null = null
  for (let i = 0; i < path.length - 1; i++) {
    const [lon1, lat1] = path[i]
    const [lon2, lat2] = path[i + 1]
    const segmentLength = haversineMeters(lat1, lon1, lat2, lon2)
    const nearest = nearestPointOnSegment(lat, lon, lat1, lon1, lat2, lon2)
    if (!best || nearest.distanceM < best.distanceM) {
      const alongSegment = haversineMeters(lat1, lon1, nearest.lat, nearest.lon)
      best = { distanceM: nearest.distanceM, offsetM: travelled + alongSegment, lat: nearest.lat, lon: nearest.lon }
    }
    travelled += segmentLength
  }
  return best
}

/** Greedy end-to-end chaining of the tronçons of one watercourse: repeatedly
 * append whichever remaining tronçon starts closest to the current chain's
 * downstream end. Each tronçon is already oriented upstream-to-downstream, so
 * the assembled chain is too. */
function chain(troncons: Troncon[]): Position[] {
  if (troncons.length === 0) return []
  const remaining = [...troncons]
  let current = remaining.shift()!
  let path = [...current.path]

  while (remaining.length > 0) {
    const tail = path[path.length - 1]
    let bestIndex = -1
    let bestGap = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const head = remaining[i].path[0]
      const gap = haversineMeters(tail[1], tail[0], head[1], head[0])
      if (gap < bestGap) {
        bestGap = gap
        bestIndex = i
      }
    }
    // A gap wider than a BD TOPO vertex tolerance means the next tronçon is
    // on a different branch (or past a confluence), not a continuation.
    if (bestIndex === -1 || bestGap > 60) break
    current = remaining.splice(bestIndex, 1)[0]
    path = path.concat(current.path.slice(1))
  }
  return path
}

/**
 * Walks the network downstream from the end of a reach until it reaches a
 * named watercourse.
 *
 * At each step the tronçons around the current downstream end are fetched, and
 * the nearest one belonging to a *different* course is taken as the receiving
 * watercourse. Verified live: an unnamed channel south of Nantes resolves to
 * la Loire in one hop (1,6 km), an unnamed ditch in the Vendée bocage to la
 * Mozée in two (1,5 km).
 *
 * Returns null rather than a guess when the walk runs out of hops, leaves the
 * search radius, or hits a reach with no downstream neighbour — a site whose
 * runoff disappears into a closed depression is a real case, and inventing a
 * receptor for it would be worse than saying nothing.
 */
async function findExutoire(
  lat: number,
  lon: number,
  depart: Position[],
  coursDepart: string | null,
  noms: Map<string, string>,
): Promise<Exutoire | null> {
  let path = depart
  let courant = coursDepart
  let cheminM = 0
  for (let i = 0; i < path.length - 1; i++) cheminM += haversineMeters(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0])

  const nomsConnus = new Map(noms)

  for (let relais = 0; relais < EXUTOIRE_HOPS; relais++) {
    const queue = path[path.length - 1]
    const voisins = await queryTroncons(queue[1], queue[0], EXUTOIRE_RAYON_M)
    if (!voisins || voisins.length === 0) return null

    // Measured against the receiving watercourse's *segments*, not its
    // vertices. A confluence falls wherever the two lines meet, which is
    // almost never on a digitised vertex: measuring vertex-to-vertex reported
    // 128 m for a junction that is physically a junction — verified on an
    // unnamed ditch in the Vendée bocage, where it lost la Mozée entirely.
    let recepteur: Troncon | null = null
    let ecart = Infinity
    let confluence: Position = queue
    for (const troncon of voisins) {
      if (troncon.coursDEau === courant) continue
      const projection = projectOnPath(queue[1], queue[0], troncon.path)
      if (projection && projection.distanceM < ecart) {
        ecart = projection.distanceM
        recepteur = troncon
        confluence = [projection.lon, projection.lat]
      }
    }
    // Past this the "receiving" watercourse is simply another one in the
    // neighbourhood, not one this reach flows into.
    if (!recepteur || ecart > 120) return null

    for (const [id, nom] of await fetchNomsCoursDEau(queue[1], queue[0], 3000)) nomsConnus.set(id, nom)
    const nom = recepteur.nom ?? nomDe(recepteur.coursDEau, nomsConnus)
    if (nom) {
      return {
        nom,
        cheminM,
        distanceM: haversineMeters(lat, lon, confluence[1], confluence[0]),
        direction: cardinalDirection(bearingDegrees(lat, lon, confluence[1], confluence[0])),
        lat: confluence[1],
        lon: confluence[0],
        relais,
      }
    }

    courant = recepteur.coursDEau
    const suite = chain([recepteur, ...voisins.filter((t) => t !== recepteur && t.coursDEau === recepteur!.coursDEau)])
    if (suite.length < 2) return null
    for (let i = 0; i < suite.length - 1; i++) cheminM += haversineMeters(suite[i][1], suite[i][0], suite[i + 1][1], suite[i + 1][0])
    path = suite
  }
  return null
}

export async function findReseauHydro(lat: number, lon: number): Promise<ReseauHydro | null> {
  for (const radius of SEARCH_RADII_M) {
    const troncons = await queryTroncons(lat, lon, radius)
    if (troncons === null) return null
    if (troncons.length === 0) continue

    let nearest: { troncon: Troncon; distanceM: number } | null = null
    for (const troncon of troncons) {
      const projection = projectOnPath(lat, lon, troncon.path)
      if (!projection) continue
      if (!nearest || projection.distanceM < nearest.distanceM) nearest = { troncon, distanceM: projection.distanceM }
    }
    if (!nearest) continue

    // A reach with no `liens_vers_cours_d_eau` — most ditches — cannot be
    // grouped by identifier, so it is grouped with the other unidentified
    // reaches and let `chain` follow the physical continuation. Keeping it
    // alone left the assembled path ending mid-ditch, a hundred metres short
    // of the stream it runs into, which is why no outlet was ever found for
    // exactly the sites that need one most.
    const sameCourse = nearest.troncon.coursDEau
      ? troncons.filter((t) => t.coursDEau === nearest!.troncon.coursDEau)
      : troncons.filter((t) => t.coursDEau === null)
    // Start the chain from the tronçon carrying the site, so the assembled
    // path runs through the site's own reach rather than a parallel branch.
    const ordered = [nearest.troncon, ...sameCourse.filter((t) => t !== nearest!.troncon)]
    const path = chain(ordered)
    const projection = projectOnPath(lat, lon, path)
    if (!projection) continue

    let longueurM = 0
    for (let i = 0; i < path.length - 1; i++) longueurM += haversineMeters(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0])

    // Names come from the cours_d_eau layer: the tronçon layer carries the
    // flow direction but leaves `toponyme` empty on every reach sampled, so
    // relying on it alone left almost every watercourse anonymous.
    const noms = await fetchNomsCoursDEau(lat, lon, Math.max(radius, 3000))
    const nom =
      nearest.troncon.nom ??
      sameCourse.find((t) => t.nom)?.nom ??
      nomDe(nearest.troncon.coursDEau, noms) ??
      null

    // When the nearest watercourse has no toponym, look through the same
    // result set for the closest one that does, so the reader is given a
    // receptor they can actually recognise.
    let premierNomme: CoursDEauNomme | null = null
    if (!nom) {
      for (const troncon of troncons) {
        if (!troncon.nom) continue
        const projection = projectOnPath(lat, lon, troncon.path)
        if (!projection) continue
        if (!premierNomme || projection.distanceM < premierNomme.distanceM) {
          premierNomme = {
            nom: troncon.nom,
            distanceM: projection.distanceM,
            direction: cardinalDirection(bearingDegrees(lat, lon, projection.lat, projection.lon)),
            path: troncon.path.map(([plon, plat]) => [plat, plon] as [number, number]),
          }
        }
      }
    }

    // Only when the reach itself has no name: naming the outlet of a river
    // the reader can already identify adds nothing.
    const exutoire = nom ? null : await findExutoire(lat, lon, path, nearest.troncon.coursDEau, noms)

    return {
      path: path.map(([plon, plat]) => [plat, plon] as [number, number]),
      nom,
      premierNomme,
      exutoire,
      distanceM: projection.distanceM,
      direction: cardinalDirection(bearingDegrees(lat, lon, projection.lat, projection.lon)),
      flowKnown: nearest.troncon.flowKnown,
      siteOffsetM: projection.offsetM,
      longueurM,
    }
  }
  return null
}

export type PositionRelative = 'amont' | 'aval' | 'inconnue'

/** Where a point sits relative to the site along the watercourse. Returns
 * 'inconnue' when flow direction is unknown, when the point projects too far
 * from the network to be on it, or when the two projections are too close
 * together for the ordering to mean anything. */
export function positionRelative(reseau: ReseauHydro, lat: number, lon: number): PositionRelative {
  if (!reseau.flowKnown) return 'inconnue'
  const path: Position[] = reseau.path.map(([plat, plon]) => [plon, plat] as Position)
  const projection = projectOnPath(lat, lon, path)
  if (!projection) return 'inconnue'
  const delta = projection.offsetM - reseau.siteOffsetM
  if (Math.abs(delta) < 50) return 'inconnue'
  return delta > 0 ? 'aval' : 'amont'
}

export function positionLabel(position: PositionRelative): string {
  if (position === 'amont') return 'en amont hydraulique du site'
  if (position === 'aval') return 'en aval hydraulique du site'
  return ''
}
