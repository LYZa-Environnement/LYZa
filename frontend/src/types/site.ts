/** A geocoded study site — the single input the whole platform works from. */
export interface Site {
  label: string
  citycode: string
  postcode: string
  city: string
  lat: number
  lon: number
  score: number
}

/** How a reading should be read at a glance. `inconnu` is a first-class
 * value, not a failure: most of this platform's honesty comes from saying
 * "not available" instead of inventing a verdict. */
export type Level = 'favorable' | 'attention' | 'defavorable' | 'inconnu'

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
