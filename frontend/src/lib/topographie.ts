/**
 * Relief at the site: how high it stands and which way it drains.
 *
 * Slope is the missing half of the watercourse reading. Knowing that a ditch
 * runs 80 m to the north says little on its own; knowing the plot falls 3 %
 * towards the north says that whatever leaves the site goes into it. It is
 * also what decides where a spill, a runoff plume or a plume of fines
 * actually travels, which no inventory of nearby installations can tell.
 *
 * Source: IGN's altimetry service over RGE ALTI®, the 1 m to 5 m national
 * elevation model. The service takes a batch of points in one call — verified
 * live up to 196 — so a whole sampling grid costs a single request.
 */

import { cardinalDirection, type PolygonGeometry } from './geo'
import { emprisesBounds } from './cadastre'

const ALTI_URL = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json'
const DELAI_MS = 20000
/** 9 × 9 = 81 points: dense enough that a single ditch or embankment does not
 * set the slope on its own, small enough for one request. */
const COTE_GRILLE = 9
/** Box sampled when the site is only a point, in metres. */
const COTE_DEFAUT_M = 200

export interface Topographie {
  altitudeMin: number
  altitudeMax: number
  /** Altitude at the centre of the sampled area. */
  altitudeCentre: number
  /** Average slope over the sampled area, in percent. */
  pentePourcent: number
  /** Cardinal direction the ground falls towards. */
  penteDirection: string
  /** Side of the sampled square, in metres. */
  coteM: number
  /** How well a single plane describes the ground here, 0 to 1. Low values
   * mean the relief is not a simple slope — a talweg, a terrace, a mound — and
   * a single "x % towards the north" would flatten that away. */
  planarite: number
}

interface Echantillon {
  est: number
  nord: number
  z: number
}

/** The square actually sampled: the footprint's own extent when there is one,
 * so the slope describes the plot rather than its neighbourhood. */
function zoneEchantillon(lat: number, lon: number, emprise?: PolygonGeometry): { lat: number; lon: number; coteM: number } {
  if (!emprise) return { lat, lon, coteM: COTE_DEFAUT_M }
  const bounds = emprisesBounds(emprise)
  if (!bounds) return { lat, lon, coteM: COTE_DEFAUT_M }
  const [[sud, ouest], [nord, est]] = bounds
  const hauteur = (nord - sud) * 111320
  const largeur = (est - ouest) * 111320 * Math.cos(((nord + sud) / 2) * (Math.PI / 180))
  return {
    lat: (sud + nord) / 2,
    lon: (ouest + est) / 2,
    // A little wider than the plot: a slope read strictly inside a small
    // parcel is mostly the noise of the elevation model.
    coteM: Math.min(1000, Math.max(120, Math.round(Math.max(hauteur, largeur) * 1.2))),
  }
}

export async function fetchTopographie(lat: number, lon: number, emprise?: PolygonGeometry): Promise<Topographie | null> {
  const zone = zoneEchantillon(lat, lon, emprise)
  const demiLat = zone.coteM / 2 / 111320
  const demiLon = zone.coteM / 2 / (111320 * Math.cos((zone.lat * Math.PI) / 180))

  const lats: number[] = []
  const lons: number[] = []
  for (let i = 0; i < COTE_GRILLE; i++) {
    for (let j = 0; j < COTE_GRILLE; j++) {
      lats.push(zone.lat - demiLat + (2 * demiLat * i) / (COTE_GRILLE - 1))
      lons.push(zone.lon - demiLon + (2 * demiLon * j) / (COTE_GRILLE - 1))
    }
  }

  const controller = new AbortController()
  const minuteur = setTimeout(() => controller.abort(), DELAI_MS)
  let altitudes: { lat: number; lon: number; z: number }[]
  try {
    const url = new URL(ALTI_URL)
    url.searchParams.set('lon', lons.map((v) => v.toFixed(6)).join('|'))
    url.searchParams.set('lat', lats.map((v) => v.toFixed(6)).join('|'))
    url.searchParams.set('resource', 'ign_rge_alti_wld')
    url.searchParams.set('delimiter', '|')
    url.searchParams.set('indent', 'false')
    url.searchParams.set('measures', 'false')
    const response = await fetch(url.toString(), { signal: controller.signal })
    if (!response.ok) return null
    const json = (await response.json()) as { elevations?: { lat?: number; lon?: number; z?: number }[] }
    altitudes = (json.elevations ?? [])
      .filter((e): e is { lat: number; lon: number; z: number } => typeof e.z === 'number' && typeof e.lat === 'number' && typeof e.lon === 'number')
      // The service returns -99999 where it has no data, which would otherwise
      // become a spectacular cliff.
      .filter((e) => e.z > -1000 && e.z < 9000)
  } catch {
    return null
  } finally {
    clearTimeout(minuteur)
  }
  if (altitudes.length < 12) return null

  // Local metric frame centred on the sampled area, so a least-squares plane
  // can be fitted without worrying about degrees of longitude shrinking.
  const cosLat = Math.cos((zone.lat * Math.PI) / 180)
  const points: Echantillon[] = altitudes.map((e) => ({
    est: (e.lon - zone.lon) * 111320 * cosLat,
    nord: (e.lat - zone.lat) * 111320,
    z: e.z,
  }))

  const n = points.length
  const moyEst = points.reduce((s, p) => s + p.est, 0) / n
  const moyNord = points.reduce((s, p) => s + p.nord, 0) / n
  const moyZ = points.reduce((s, p) => s + p.z, 0) / n

  // Least squares on z = a·est + b·nord + c, solved on the 2×2 normal equations.
  let sEE = 0
  let sNN = 0
  let sEN = 0
  let sEZ = 0
  let sNZ = 0
  for (const p of points) {
    const de = p.est - moyEst
    const dn = p.nord - moyNord
    const dz = p.z - moyZ
    sEE += de * de
    sNN += dn * dn
    sEN += de * dn
    sEZ += de * dz
    sNZ += dn * dz
  }
  const det = sEE * sNN - sEN * sEN
  if (Math.abs(det) < 1e-6) return null
  const a = (sEZ * sNN - sNZ * sEN) / det
  const b = (sNZ * sEE - sEZ * sEN) / det

  // The gradient (a, b) points uphill; water goes the other way.
  const pente = Math.sqrt(a * a + b * b)
  const azimutDescente = (Math.atan2(-a, -b) * 180) / Math.PI

  // How much of the height variation the plane accounts for: a talweg or a
  // terrace leaves most of it unexplained, and the reading says so.
  let residus = 0
  let total = 0
  for (const p of points) {
    const prevu = moyZ + a * (p.est - moyEst) + b * (p.nord - moyNord)
    residus += (p.z - prevu) ** 2
    total += (p.z - moyZ) ** 2
  }

  const zs = points.map((p) => p.z)
  const centre = points.reduce((meilleur, p) => (p.est ** 2 + p.nord ** 2 < meilleur.est ** 2 + meilleur.nord ** 2 ? p : meilleur), points[0])

  return {
    altitudeMin: Math.min(...zs),
    altitudeMax: Math.max(...zs),
    altitudeCentre: centre.z,
    pentePourcent: pente * 100,
    penteDirection: cardinalDirection((azimutDescente + 360) % 360),
    coteM: zone.coteM,
    planarite: total > 0 ? Math.max(0, 1 - residus / total) : 1,
  }
}

/** Plain-language reading of a slope, because a percentage alone means little
 * to anyone who does not work with them daily. */
export function qualifiePente(pourcent: number): string {
  if (pourcent < 1) return 'terrain quasi plat'
  if (pourcent < 3) return 'pente faible'
  if (pourcent < 8) return 'pente modérée'
  if (pourcent < 15) return 'pente marquée'
  return 'pente forte'
}

