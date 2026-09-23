/**
 * Nearest installation nucléaire de base (INB), with its distance and
 * direction from the site.
 *
 * Géorisques serves the national INB layer two ways, and neither can be used
 * live from a browser: `/api/v1/installations_nucleaires` only accepts a
 * single `code_insee` (no radius, no bounding box — verified: every other
 * parameter returns "paramètres de recherches manquants"), so finding the
 * *nearest* one would mean querying every commune around the site; and the
 * WFS layer that does hold the whole country (`ms:INSTALLATIONS_NUCLEAIRES`
 * on mapsref.brgm.fr) sends no CORS headers.
 *
 * The layer is small and changes rarely, so it is shipped as a static file
 * generated from that WFS — the same approach as the catchment protection
 * perimeters and the coastal-erosion decree list. Regenerate it when the
 * national fleet changes.
 */

import { bearingDegrees, cardinalDirection, haversineMeters } from './geo'

export interface InstallationNucleaire {
  nom: string
  site: string | null
  type: string | null
  exploitant: string | null
  commune: string | null
  /** Radius of the plan particulier d'intervention, in metres. */
  rayonPpiM: number | null
  /** Whether iodine tablets are distributed around the site. */
  risqueIode: boolean
  lat: number
  lon: number
}

export interface InstallationNucleaireProche extends InstallationNucleaire {
  distanceM: number
  direction: string
  /** True when the site falls inside the installation's PPI radius. */
  dansPpi: boolean
}

interface FichierInb {
  nom?: string
  site?: string
  type?: string
  exploitant?: string
  commune?: string
  rayonPpiM?: string | number
  risqueIode?: boolean
  lat?: number
  lon?: number
}

let chargement: Promise<FichierInb[] | null> | null = null

function charger(): Promise<FichierInb[] | null> {
  if (!chargement) {
    chargement = fetch(`${import.meta.env.BASE_URL}data/inb.json`)
      .then((response) => (response.ok ? (response.json() as Promise<FichierInb[]>) : null))
      .catch(() => null)
  }
  return chargement
}

export async function findNearestInb(lat: number, lon: number): Promise<InstallationNucleaireProche | null> {
  const liste = await charger()
  if (!liste) throw new Error('liste INB indisponible')

  let best: InstallationNucleaireProche | null = null
  for (const entree of liste) {
    if (typeof entree.lat !== 'number' || typeof entree.lon !== 'number') continue
    const distanceM = haversineMeters(lat, lon, entree.lat, entree.lon)
    if (best && distanceM >= best.distanceM) continue
    const rayonPpiM = entree.rayonPpiM === undefined ? null : Number(entree.rayonPpiM)
    best = {
      nom: entree.nom ?? entree.site ?? 'Installation nucléaire de base',
      site: entree.site ?? null,
      type: entree.type ?? null,
      exploitant: entree.exploitant ?? null,
      commune: entree.commune ?? null,
      // A zero radius means "no PPI for this installation", not a
      // zero-metre one — verified on research reactors and irradiators.
      rayonPpiM: rayonPpiM !== null && Number.isFinite(rayonPpiM) && rayonPpiM > 0 ? rayonPpiM : null,
      risqueIode: entree.risqueIode === true,
      lat: entree.lat,
      lon: entree.lon,
      distanceM,
      direction: cardinalDirection(bearingDegrees(lat, lon, entree.lat, entree.lon)),
      dansPpi: false,
    }
  }
  if (best && best.rayonPpiM !== null) best.dansPpi = best.distanceM <= best.rayonPpiM
  return best
}
