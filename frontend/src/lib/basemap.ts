/**
 * IGN Géoplateforme base layers.
 *
 * The 1:25 000 topographic map (SCAN 25®) is not part of the open WMTS
 * service on data.geopf.fr — its GetCapabilities lists no SCAN 25 layer at
 * all (only PLANIGNV2, the orthophotos and a few historical scans), and
 * every SCAN-25 layer name 400s there. It is served instead by the keyed
 * endpoint below under the generic `GEOGRAPHICALGRIDSYSTEMS.MAPS` pyramid,
 * with the public `ign_scan_ws` Géoportail key — verified live: real SCAN 25
 * tiles (contour lines, spot heights, topographic symbology) from z0 to z18,
 * 404 beyond, hence maxNativeZoom.
 */

const SCAN_KEY = 'ign_scan_ws'

export const IGN_ATTRIBUTION = 'IGN-F/Géoplateforme'

/** Carte IGN au 1:25 000 (SCAN 25®) — the platform's default base map. */
export const SCAN25_URL =
  `https://data.geopf.fr/private/wmts?apikey=${SCAN_KEY}` +
  '&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS&EXCEPTIONS=text/xml&FORMAT=image/jpeg' +
  '&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal' +
  '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

export const SCAN25_MAX_NATIVE_ZOOM = 18

export function geopfUrl(layer: string, format = 'image/png', style = 'normal'): string {
  return (
    `https://data.geopf.fr/wmts?LAYER=${layer}&EXCEPTIONS=text/xml&FORMAT=${format}` +
    `&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=${style}` +
    '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
  )
}

export const ORTHO_URL = geopfUrl('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg')
export const PLAN_IGN_URL = geopfUrl('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2')

export interface BaseLayerOption {
  id: string
  label: string
  url: string
  attribution: string
  maxNativeZoom: number
}

export const BASE_LAYERS: BaseLayerOption[] = [
  { id: 'scan25', label: 'Carte IGN 1:25 000', url: SCAN25_URL, attribution: `${IGN_ATTRIBUTION} — SCAN 25®`, maxNativeZoom: SCAN25_MAX_NATIVE_ZOOM },
  { id: 'ortho', label: 'Photo aérienne', url: ORTHO_URL, attribution: IGN_ATTRIBUTION, maxNativeZoom: 19 },
  { id: 'plan', label: 'Plan IGN', url: PLAN_IGN_URL, attribution: IGN_ATTRIBUTION, maxNativeZoom: 19 },
]
