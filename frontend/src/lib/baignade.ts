/**
 * Official bathing sites — in the sense of directive 2006/7/CE, so both inland
 * waters (lakes, rivers) and sea water.
 *
 * Source: the Ministry of Health's bathing-season reporting, refreshed on every
 * build by `scripts/baignade.mjs` and shipped as a static file. It used to be
 * read live from data.gouv's Tabular API, which was unreliable for two reasons:
 * the seasonal export changes resource id every year — a stale id returns
 * nothing at all — and paginated reads capped how many sites were loaded, so a
 * site simply missing from the fetched pages looked like "no bathing site
 * nearby". Shipping the whole list removes both failure modes.
 *
 * The build joins three of the dataset's files: the list of sites open for the
 * coming season, the classification of the last reported season, and that
 * season's log of closures and blooms. Naming one site and nothing else was
 * thin: what a reader wants to know about a bathing site is the quality of its
 * water and whether it had to close, not only that it exists.
 *
 * Searched for an equivalent for recreational fishing and nautical centres too:
 * neither exists as open national data. Fishing lots and nautical bases only
 * turn up as scattered département-level sets; the fish-survey network is used
 * instead to describe the watercourse's fishery interest (see hubeau.ts).
 */

import { bearingDegrees, cardinalDirection, haversineMeters } from './geo'

interface SiteBrut {
  nom?: string
  commune?: string | null
  type?: string | null
  lat?: number
  lon?: number
  qualite?: string | null
  saisonDebut?: string | null
  saisonFin?: string | null
  interdictions?: number
  cyanobacteries?: number
  pollutions?: number
}

interface FichierBaignade {
  source?: string
  saisonClassement?: number | null
  collecteLe?: string
  sites?: SiteBrut[]
}

let chargement: Promise<FichierBaignade | null> | null = null

function charger(): Promise<FichierBaignade | null> {
  if (!chargement) {
    chargement = fetch(`${import.meta.env.BASE_URL}data/baignade.json`)
      .then((response) => (response.ok ? (response.json() as Promise<FichierBaignade>) : null))
      .catch(() => null)
  }
  return chargement
}

export interface BathingSite {
  nom: string
  commune: string | null
  typeEau: string | null
  distanceM: number
  direction: string
  lat: number
  lon: number
  /** Classification of the last reported season: excellente, bonne,
   * suffisante, insuffisante — or null when the site has none yet. */
  qualite: string | null
  saisonDebut: string | null
  saisonFin: string | null
  /** Health closures recorded during the last reported season. */
  interdictions: number
  /** Cyanobacteria blooms recorded during the last reported season. */
  cyanobacteries: number
  /** Short-term pollution episodes recorded during the last reported season. */
  pollutions: number
}

export interface BathingSurvey {
  /** Every site within the search radius, nearest first. */
  sites: BathingSite[]
  /** Nearest site overall, even beyond the radius — so the rubrique can say
   * how far the nearest one actually is instead of just "none". */
  plusProche: BathingSite | null
  /** Season the published list of sites describes. */
  source: string | null
  /** Season the classifications describe, which is the previous one. */
  saisonClassement: number | null
}

export async function surveyBathingSites(lat: number, lon: number, rayonM: number): Promise<BathingSurvey> {
  const fichier = await charger()
  if (!fichier?.sites) throw new Error('liste des sites de baignade indisponible')

  const proches: BathingSite[] = []
  let plusProche: BathingSite | null = null

  for (const brut of fichier.sites) {
    if (typeof brut.lat !== 'number' || typeof brut.lon !== 'number') continue
    const distanceM = haversineMeters(lat, lon, brut.lat, brut.lon)
    if (distanceM > rayonM && plusProche && distanceM >= plusProche.distanceM) continue

    const site: BathingSite = {
      nom: brut.nom?.trim() || 'Site de baignade',
      commune: brut.commune?.trim() || null,
      typeEau: brut.type?.trim() || null,
      distanceM,
      direction: cardinalDirection(bearingDegrees(lat, lon, brut.lat, brut.lon)),
      lat: brut.lat,
      lon: brut.lon,
      qualite: brut.qualite ?? null,
      saisonDebut: brut.saisonDebut ?? null,
      saisonFin: brut.saisonFin ?? null,
      interdictions: brut.interdictions ?? 0,
      cyanobacteries: brut.cyanobacteries ?? 0,
      pollutions: brut.pollutions ?? 0,
    }
    if (!plusProche || distanceM < plusProche.distanceM) plusProche = site
    if (distanceM <= rayonM) proches.push(site)
  }

  proches.sort((a, b) => a.distanceM - b.distanceM)
  return { sites: proches, plusProche, source: fichier.source ?? null, saisonClassement: fichier.saisonClassement ?? null }
}

/** Reading of the classification: "excellente" is the top of a four-step scale
 * set by the directive, "insuffisante" the step that obliges the commune to
 * act. A site with no classification yet is left uncoloured rather than being
 * treated as a bad one. */
export function niveauQualiteBaignade(qualite: string | null): 'favorable' | 'attention' | 'defavorable' | 'inconnu' {
  switch (qualite) {
    case 'Excellente':
    case 'Bonne':
      return 'favorable'
    case 'Suffisante':
      return 'attention'
    case 'Insuffisante':
      return 'defavorable'
    default:
      return 'inconnu'
  }
}
