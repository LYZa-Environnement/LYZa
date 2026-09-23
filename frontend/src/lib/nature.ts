/**
 * Protected and inventoried natural areas around a site, and the species
 * actually recorded there.
 *
 * Areas: IGN's API Carto "nature" module, which serves the MNHN/INPN
 * reference layers. Verified live over the Brière (a point inside a PNR,
 * a ZNIEFF I, a ZNIEFF II and two Natura 2000 sites returned exactly those):
 * the module takes a GeoJSON `geom` and returns real polygons with `nom` or
 * `sitename`/`sitecode` and a `url` to the INPN fiche. Passing `lon`/`lat`
 * query parameters instead is silently ignored — it returns unrelated
 * features from the other end of the country — so `geom` is always used.
 *
 * Species: GBIF's occurrence API, which aggregates the French SINP/INPN
 * feeds among others. Verified live: a 4 km box around Nantes returned
 * 35 000+ georeferenced occurrences.
 */

import { bboxAround, bboxToPolygon, bearingDegrees, cardinalDirection, centroidOfGeometry, isPointInGeometry, minDistanceToGeometryBoundaryM, type PolygonGeometry } from './geo'

const API_CARTO_NATURE = 'https://apicarto.ign.fr/api/nature/'
const GBIF_OCCURRENCE = 'https://api.gbif.org/v1/occurrence/search'

export interface ZonageNaturel {
  categorie: string
  nom: string
  code: string | null
  /** True when the site itself falls inside the zone. */
  inclus: boolean
  distanceM: number
  direction: string | null
  url: string | null
  /** Area of the zone in hectares, as computed by the MNHN on its own
   * geometry (`area_sig`) — the officially declared area (`surf_off`) is
   * usually empty on these layers. */
  surfaceHa: number | null
  /** Date the zone was created or designated. */
  dateCreation: string | null
  /** Body responsible for the site, when named. */
  gestionnaire: string | null
  /** True for a marine zone — a terrestrial site next to one is a different
   * proposition from one inside it. */
  marin: boolean
  geometrie: PolygonGeometry
}

const MODULES: { endpoint: string; categorie: string }[] = [
  { endpoint: 'natura-habitat', categorie: 'Natura 2000 — Directive Habitats' },
  { endpoint: 'natura-oiseaux', categorie: 'Natura 2000 — Directive Oiseaux' },
  { endpoint: 'znieff1', categorie: 'Zone naturelle d’intérêt écologique (ZNIEFF) de type I' },
  { endpoint: 'znieff2', categorie: 'Zone naturelle d’intérêt écologique (ZNIEFF) de type II' },
  { endpoint: 'pn', categorie: 'Parc national' },
  { endpoint: 'pnr', categorie: 'Parc naturel régional' },
  { endpoint: 'rnn', categorie: 'Réserve naturelle nationale' },
  { endpoint: 'rnr', categorie: 'Réserve naturelle régionale' },
]

interface NatureFeature {
  geometry?: PolygonGeometry
  properties?: Record<string, unknown>
}

async function queryModule(endpoint: string, lat: number, lon: number, radiusM: number): Promise<NatureFeature[] | null> {
  try {
    const url = new URL(endpoint, API_CARTO_NATURE)
    url.searchParams.set('geom', JSON.stringify(bboxToPolygon(bboxAround(lat, lon, radiusM))))
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { features?: NatureFeature[] }
    return json.features ?? []
  } catch {
    return null
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function fetchZonagesNaturels(lat: number, lon: number, radiusM = 5000): Promise<ZonageNaturel[] | null> {
  const results = await Promise.all(MODULES.map((module) => queryModule(module.endpoint, lat, lon, radiusM)))
  if (results.every((result) => result === null)) return null

  const zonages: ZonageNaturel[] = []
  results.forEach((features, index) => {
    const { categorie } = MODULES[index]
    for (const feature of features ?? []) {
      const geometry = feature.geometry
      if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue
      const props = feature.properties ?? {}
      const inclus = isPointInGeometry(lat, lon, geometry)
      const centroid = centroidOfGeometry(geometry)
      zonages.push({
        categorie,
        nom: str(props.nom) ?? str(props.sitename) ?? categorie,
        code: str(props.sitecode) ?? str(props.id_mnhn) ?? str(props.id_local),
        inclus,
        distanceM: inclus ? 0 : minDistanceToGeometryBoundaryM(lat, lon, geometry),
        direction: inclus || !centroid ? null : cardinalDirection(bearingDegrees(lat, lon, centroid[1], centroid[0])),
        url: str(props.url),
        surfaceHa: typeof props.area_sig === 'number' ? props.area_sig : typeof props.surf_off === 'number' ? props.surf_off : null,
        dateCreation: str(props.date_crea),
        gestionnaire: str(props.gest_site),
        marin: String(props.marin ?? '').toUpperCase() === 'T',
        geometrie: geometry,
      })
    }
  })
  return zonages.sort((a, b) => a.distanceM - b.distanceM)
}

export interface Espece {
  /** Scientific (canonical) name — always present. */
  nom: string
  /** French vernacular name when GBIF has one, else null. */
  nomFrancais: string | null
  groupe: string | null
  occurrences: number
}

export interface EspecesObservees {
  /** Total georeferenced occurrences recorded in the search box. */
  total: number
  /** Most frequently recorded species, commonest first. */
  especes: Espece[]
  rayonM: number
}

// GBIF returns the taxonomic class in Latin; these are the groups a reader is
// actually likely to recognise. Anything unmapped falls back to the Latin name
// rather than being dropped.
const GROUPES: Record<string, string> = {
  Aves: 'Oiseaux',
  Mammalia: 'Mammifères',
  Insecta: 'Insectes',
  Amphibia: 'Amphibiens',
  Reptilia: 'Reptiles',
  Actinopterygii: 'Poissons',
  Magnoliopsida: 'Plantes à fleurs',
  Liliopsida: 'Plantes à fleurs',
  Polypodiopsida: 'Fougères',
  Pinopsida: 'Conifères',
  Arachnida: 'Arachnides',
  Gastropoda: 'Mollusques',
  Bryopsida: 'Mousses',
  Lecanoromycetes: 'Lichens',
  Agaricomycetes: 'Champignons',
}

async function frenchName(key: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.gbif.org/v1/species/${encodeURIComponent(key)}/vernacularNames?limit=100`)
    if (!response.ok) return null
    const json = (await response.json()) as { results?: { vernacularName?: string; language?: string }[] }
    const match = json.results?.find((entry) => entry.language === 'fra' && entry.vernacularName)
    return match?.vernacularName ?? null
  } catch {
    return null
  }
}

export async function fetchEspeces(lat: number, lon: number, radiusM = 2000): Promise<EspecesObservees | null> {
  const box = bboxAround(lat, lon, radiusM)
  try {
    const url = `${GBIF_OCCURRENCE}?${new URLSearchParams({
      decimalLatitude: `${box.south},${box.north}`,
      decimalLongitude: `${box.west},${box.east}`,
      hasCoordinate: 'true',
      hasGeospatialIssue: 'false',
      limit: '0',
      facet: 'speciesKey',
      facetLimit: '12',
    })}`
    const response = await fetch(url)
    if (!response.ok) return null
    const json = (await response.json()) as { count?: number; facets?: { field: string; counts: { name: string; count: number }[] }[] }
    // The facet field comes back upper-snake-cased ("SPECIES_KEY"), not as the
    // "speciesKey" that was requested — verified live.
    const counts = json.facets?.find((facet) => facet.field === 'SPECIES_KEY')?.counts ?? []

    const especes = await Promise.all(
      counts.map(async (entry): Promise<Espece | null> => {
        try {
          const [taxonResponse, nomFrancais] = await Promise.all([
            fetch(`https://api.gbif.org/v1/species/${encodeURIComponent(entry.name)}`),
            frenchName(entry.name),
          ])
          if (!taxonResponse.ok) return null
          const taxon = (await taxonResponse.json()) as { scientificName?: string; canonicalName?: string; class?: string; phylum?: string }
          const latinGroup = taxon.class ?? taxon.phylum ?? null
          return {
            nom: taxon.canonicalName ?? taxon.scientificName ?? entry.name,
            nomFrancais,
            groupe: latinGroup ? (GROUPES[latinGroup] ?? latinGroup) : null,
            occurrences: entry.count,
          }
        } catch {
          return null
        }
      }),
    )

    return { total: json.count ?? 0, especes: especes.filter((e): e is Espece => e !== null), rayonM: radiusM }
  } catch {
    return null
  }
}
