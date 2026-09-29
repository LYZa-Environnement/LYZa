import type { ParcelleCadastrale } from '../lib/cadastre'
import type { PolygonGeometry } from '../lib/geo'

/** The study site — the single input the whole platform works from.
 *
 * It starts as a geocoded address and becomes a surface once the reader has
 * picked the cadastral parcels: `lat`/`lon` then point at the centre of the
 * merged footprint rather than wherever the geocoder dropped the address, so
 * every distance, every map framing and every aerial frame downstream follows
 * the land under study instead of a point on a façade. */
export interface Site {
  label: string
  citycode: string
  postcode: string
  city: string
  lat: number
  lon: number
  score: number
  /** Parcels the reader selected, in the order they picked them. */
  parcelles?: ParcelleCadastrale[]
  /** Those parcels merged into one outline — what is drawn on every map. */
  emprise?: PolygonGeometry
  /** Total cadastral area of the selection, m². */
  surfaceM2?: number
  /** Where the geocoder put the address, kept so the map can still show it
   * once the site has become a footprint. */
  adresseLat?: number
  adresseLon?: number
}

/** How a reading should be read at a glance. `inconnu` is a first-class
 * value, not a failure: most of this platform's honesty comes from saying
 * "not available" instead of inventing a verdict. */
export type Level = 'favorable' | 'attention' | 'defavorable' | 'inconnu'

/** One line of an extractable table — the columns are fixed so several
 * inventories (installations classées, anciens sites industriels, secteurs
 * d'information sur les sols) land in the same sheet. */
export interface LigneTableau {
  /** National reference of the record in its own inventory. */
  reference: string
  nom: string
  activites: string
  distanceM: number | null
  direction: string | null
}

export interface Indicator {
  label: string
  /** The reading itself, already formatted for display. */
  value: string
  /** Where the reading comes from relative to the site — distance, cardinal
   * direction, upstream/downstream. Empty when the reading is commune-wide. */
  situation?: string
  detail?: string
  level?: Level
  href?: string
  /** The row's data as a table line. A block whose rows carry one can be
   * extracted as a spreadsheet: a reader who has to carry these sites into a
   * report should not have to retype fifteen lines from the screen. */
  tableau?: LigneTableau
  /** Groups this row into a collapsible block with the rows around it that
   * carry the same label. Long enumerations — ten trace elements, fifteen
   * installations, a dozen protected areas — are the substance of a rubrique
   * but they bury the handful of readings that matter, so they fold away
   * behind a summary line and open on demand. */
  pliable?: string
}

export interface Source {
  label: string
  href: string
  /** What exactly was queried, and any caveat on the reading. */
  note?: string
}

/** A feature to draw on the rubrique's map, in WGS84. */
export type MapFeature =
  | { kind: 'point'; lat: number; lon: number; label: string; color: string; group: string; href?: string }
  | { kind: 'line'; path: [number, number][]; label: string; color: string; group: string }
  | { kind: 'area'; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }; label: string; color: string; group: string }

export interface ThemeReport {
  /** Narrative reading of the data, one entry per paragraph. */
  commentaire: string[]
  indicateurs: Indicator[]
  features: MapFeature[]
  sources: Source[]
  /** Sub-topics explicitly not covered, and why — shown to the reader so an
   * absent layer is never mistaken for an absent risk. */
  lacunes: string[]
  /** Map framing: the radius the rubrique actually searched. */
  rayonM: number
}

export const LEVEL_LABELS: Record<Level, string> = {
  favorable: 'Favorable',
  attention: 'Point de vigilance',
  defavorable: 'Défavorable',
  inconnu: 'Non déterminé',
}
