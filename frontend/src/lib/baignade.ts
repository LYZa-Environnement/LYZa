/**
 * Nearest official bathing site ("site de baignade" au sens de la directive
 * 2006/7/CE) to a point — the one genuinely national, direct signal found
 * for "usage sensible d'un cours d'eau" (see hydroNote.ts). Searched for
 * an equivalent for recreational fishing and nautical-activity centres too:
 * neither exists as open national data — Hub'Eau's "État piscicole" API
 * covers *scientific* electrofishing survey stations (ecological
 * monitoring), not recreational fishing zones, so it isn't used here as a
 * stand-in; using it as a "sensibilité pêche" proxy would overstate what
 * it actually says. Fishing-lot boundaries and nautical bases only turned
 * up as scattered département-level open-data sets, not a national API.
 *
 * Source: "Données de rapportage de la saison balnéaire" (Ministère de la
 * Santé), queried through data.gouv.fr's public Tabular API rather than
 * downloading the raw CSV. Schema confirmed live: Nom du site de baignade,
 * Nom de la commune, Type d'eau (Lac/Rivière/Mer...), Longitude/Latitude
 * (ETRS89 — close enough to WGS84 for this purpose, within a few cm).
 */

import { haversineMeters } from './geo'

const TABULAR_API_BASE = 'https://tabular-api.data.gouv.fr/api/resources/'
// 2026 bathing-season site list — this dataset republishes under a *new*
// resource id each season, so this needs a yearly refresh (fails safe:
// a stale id just makes findNearestBathingSite() return null, same as any
// other unavailable indicator).
const RESOURCE_ID = 'e659289d-fdc2-46c2-a025-d7e1264e4197'
const PAGE_SIZE = 1000
const MAX_PAGES = 6

interface BathingSiteRow {
  'Nom du site de baignade'?: string
  'Nom de la commune'?: string
  'Type d\'eau'?: string
  'Longitude (ETRS 89)'?: number | string
  'Latitude (ETRS 89)'?: number | string
}

let sitesPromise: Promise<BathingSiteRow[] | null> | null = null

async function loadAllSites(): Promise<BathingSiteRow[] | null> {
  if (!sitesPromise) {
    sitesPromise = (async () => {
      try {
        const acc: BathingSiteRow[] = []
        for (let page = 1; page <= MAX_PAGES; page++) {
          const url = new URL(RESOURCE_ID + '/data/', TABULAR_API_BASE)
          url.searchParams.set('page', String(page))
          url.searchParams.set('page_size', String(PAGE_SIZE))
          const response = await fetch(url.toString())
          if (!response.ok) return acc.length ? acc : null
          const json = (await response.json()) as { data?: BathingSiteRow[] }
          const rows = Array.isArray(json.data) ? json.data : []
          acc.push(...rows)
          if (rows.length < PAGE_SIZE) break
        }
        return acc
      } catch {
        return null
      }
    })()
  }
  return sitesPromise
}

export interface NearestBathingSite {
  nom: string
  commune: string | null
  typeEau: string | null
  distanceM: number
}

export async function findNearestBathingSite(lat: number, lon: number): Promise<NearestBathingSite | null> {
  const sites = await loadAllSites()
  if (!sites) return null

  let best: NearestBathingSite | null = null
  for (const site of sites) {
    const siteLon = Number(site['Longitude (ETRS 89)'])
    const siteLat = Number(site['Latitude (ETRS 89)'])
    if (!Number.isFinite(siteLon) || !Number.isFinite(siteLat)) continue
    const distanceM = haversineMeters(lat, lon, siteLat, siteLon)
    if (!best || distanceM < best.distanceM) {
      best = {
        nom: site['Nom du site de baignade']?.trim() || 'Site de baignade',
        commune: site['Nom de la commune']?.trim() || null,
        typeEau: site["Type d'eau"]?.trim() || null,
        distanceM,
      }
    }
  }
  return best
}
