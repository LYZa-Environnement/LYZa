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
export function orthoImageUrl(lat: number, lon: number, periode: string, coteM = 250, pixels = 420): string {
  const dLat = coteM / 2 / 111320
  const dLon = coteM / 2 / (111320 * Math.cos((lat * Math.PI) / 180))
  // WMS 1.3.0 with EPSG:4326 takes the bbox in latitude,longitude order.
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].join(',')
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
