/**
 * Historical aerial imagery of the study site, one frame per period, from
 * IGN's "Remonter le temps" collections.
 *
 * Served here through WMS GetMap rather than the WMTS tiles LYZa Cartes uses,
 * because a tile grid cannot be centred on an arbitrary point: a timeline
 * whose frames all point exactly at the site needs a bbox chosen per frame.
 * Verified live over Nantes — every period below returned a real image.
 *
 * Layer naming follows two conventions, both confirmed: the pre-2000
 * campaigns are `ORTHOIMAGERY.ORTHOPHOTOS.<période>` (with a dot), the later
 * ones `ORTHOIMAGERY.ORTHOPHOTOS<période>` (without). Coverage is national
 * but not uniform — a given period may be blank over some communes, which
 * shows up as an empty frame rather than an error.
 */

const WMS_BASE = 'https://data.geopf.fr/wms-r/wms'

export interface PeriodeAerienne {
  id: string
  label: string
  /** Roughly which decade the frame documents, for the timeline axis. */
  decennie: string
}

/**
 * Whether the service publishes the acquisition date for a period.
 *
 * The ranges in the labels are collection names, not the date of the frame a
 * reader is looking at: "1980 – 1995" over Nantes is a flight of 26 June 1993.
 * That date lives in the mosaicking graph behind each layer, reachable by
 * GetFeatureInfo — but only five of the nine layers are declared queryable in
 * the service's capabilities (checked against GetCapabilities), and even a
 * queryable one answers "no features were found" where its graph has no
 * coverage. So the exact date is shown when the service gives it and the range
 * is kept, labelled as a range, when it does not.
 */
const INTERROGEABLES = new Set(['1965-1980', '1980-1995', '2006-2010', '2021-2023', 'actuel'])

export interface PriseDeVue {
  /** Full flight date when published, e.g. "1993-06-26". */
  date: string | null
  /** Campaign year — coarser than `date` but published more often. */
  annee: number | null
}

/** Acquisition date of the frame actually served at this point, or null when
 * the service does not publish one here. */
export async function fetchPriseDeVue(lat: number, lon: number, periode: string, coteM = 250): Promise<PriseDeVue | null> {
  if (!INTERROGEABLES.has(periode)) return null
  const cadre = cadreAerien(lat, lon, coteM)
  const url = `${WMS_BASE}?${new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layerName(periode),
    QUERY_LAYERS: layerName(periode),
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: [cadre.sud, cadre.ouest, cadre.nord, cadre.est].join(','),
    WIDTH: '101',
    HEIGHT: '101',
    I: '50',
    J: '50',
    FORMAT: 'image/png',
    INFO_FORMAT: 'text/plain',
  })}`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!response.ok) return null
    const texte = await response.text()
    const date = texte.match(/^\s*date_vol\s*=\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null
    const annee = texte.match(/^\s*pva\s*=\s*(\d{4})/m)?.[1] ?? null
    if (!date && !annee) return null
    return { date, annee: annee ? Number(annee) : date ? Number(date.slice(0, 4)) : null }
  } catch {
    return null
  }
}

/** "26 juin 1993" — the plain date a reader can quote in a report. */
export function formatPriseDeVue(prise: PriseDeVue): string | null {
  if (prise.date) {
    const date = new Date(`${prise.date}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  return prise.annee ? String(prise.annee) : null
}

export const PERIODES: PeriodeAerienne[] = [
  { id: '1950-1965', label: '1950 – 1965', decennie: '1950' },
  { id: '1965-1980', label: '1965 – 1980', decennie: '1970' },
  { id: '1980-1995', label: '1980 – 1995', decennie: '1980' },
  { id: '2000-2005', label: '2000 – 2005', decennie: '2000' },
  { id: '2006-2010', label: '2006 – 2010', decennie: '2010' },
  { id: '2011-2015', label: '2011 – 2015', decennie: '2010' },
  { id: '2016-2020', label: '2016 – 2020', decennie: '2020' },
  { id: '2021-2023', label: '2021 – 2023', decennie: '2020' },
  { id: 'actuel', label: "Aujourd'hui", decennie: '2020' },
]

function layerName(periode: string): string {
  if (periode === 'actuel') return 'ORTHOIMAGERY.ORTHOPHOTOS'
  return periode.startsWith('19') ? `ORTHOIMAGERY.ORTHOPHOTOS.${periode}` : `ORTHOIMAGERY.ORTHOPHOTOS${periode}`
}

/** A square aerial view centred exactly on the site, `coteM` metres across.
 * PNG rather than JPEG: outside a campaign's footprint the WMS returns an
 * empty image, and only PNG's alpha channel tells that apart from a genuinely
 * dark photograph.
 *
 * `TRANSPARENT=TRUE` is deliberately NOT sent. It changes nothing — the
 * response is byte-identical with and without it (47 198 B on the 1950-1965
 * layer, checked) — but combined with the dotted historical layer names it
 * makes the request fail outright in the browser ("Failed to fetch",
 * ERR_TOO_MANY_RETRIES) while curl succeeds, which silently emptied the whole
 * pre-2000 half of the timeline. */
export interface CadreAerien {
  sud: number
  ouest: number
  nord: number
  est: number
}

/** The exact box a frame covers. Exported so an overlay — the site's footprint
 * drawn on the photograph — is projected onto the very box the image was
 * requested for, instead of a recomputed one that would drift from it. */
export function cadreAerien(lat: number, lon: number, coteM = 250): CadreAerien {
  const dLat = coteM / 2 / 111320
  const dLon = coteM / 2 / (111320 * Math.cos((lat * Math.PI) / 180))
  return { sud: lat - dLat, ouest: lon - dLon, nord: lat + dLat, est: lon + dLon }
}

export function orthoImageUrl(lat: number, lon: number, periode: string, coteM = 250, pixels = 420): string {
  const cadre = cadreAerien(lat, lon, coteM)
  // WMS 1.3.0 with EPSG:4326 takes the bbox in latitude,longitude order.
  const bbox = [cadre.sud, cadre.ouest, cadre.nord, cadre.est].join(',')
  return `${WMS_BASE}?${new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: layerName(periode),
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: bbox,
    WIDTH: String(pixels),
    HEIGHT: String(pixels),
    FORMAT: 'image/png',
  })}`
}
