import { useMemo, useState } from 'react'
import { Circle, CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { BASE_LAYERS } from '../lib/basemap'
import type { MapFeature, Site } from '../types/site'

interface Props {
  site: Site
  features: MapFeature[]
  rayonM: number
  height?: string
}

function Frame({ site, rayonM }: { site: Site; rayonM: number }) {
  const map = useMap()
  // Fit the searched radius rather than a fixed zoom: a rubrique looking 10 km
  // out and one looking 500 m out need very different framings.
  const bounds = useMemo(() => {
    const dLat = rayonM / 111320
    const dLon = rayonM / (111320 * Math.cos((site.lat * Math.PI) / 180))
    return [
      [site.lat - dLat, site.lon - dLon],
      [site.lat + dLat, site.lon + dLon],
    ] as [[number, number], [number, number]]
  }, [site.lat, site.lon, rayonM])

  map.fitBounds(bounds, { padding: [12, 12] })
  return null
}

export default function ThemeMap({ site, features, rayonM, height = '26rem' }: Props) {
  const [baseId, setBaseId] = useState(BASE_LAYERS[0].id)
  const base = BASE_LAYERS.find((b) => b.id === baseId) ?? BASE_LAYERS[0]

  const groups = useMemo(() => {
    const seen = new Map<string, string>()
    for (const f of features) if (!seen.has(f.group)) seen.set(f.group, f.color)
    return [...seen.entries()]
  }, [features])

  return (
    <div>
      <div style={{ height, border: 'var(--border-w) solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <MapContainer center={[site.lat, site.lon]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer key={base.id} url={base.url} attribution={base.attribution} maxNativeZoom={base.maxNativeZoom} maxZoom={19} />

          <Circle center={[site.lat, site.lon]} radius={rayonM} pathOptions={{ color: '#1b2a1f', weight: 1, dashArray: '4 4', fillOpacity: 0.03 }} />

          {features.map((feature, i) => {
            if (feature.kind === 'point') {
              return (
                <CircleMarker
                  key={`p${i}`}
                  center={[feature.lat, feature.lon]}
                  radius={6}
                  pathOptions={{ color: '#1b2a1f', weight: 1.5, fillColor: feature.color, fillOpacity: 0.9 }}
                >
                  <Tooltip>{feature.label}</Tooltip>
                </CircleMarker>
              )
            }
            if (feature.kind === 'line') {
              return (
                <Polyline key={`l${i}`} positions={feature.path} pathOptions={{ color: feature.color, weight: 3 }}>
                  <Tooltip sticky>{feature.label}</Tooltip>
                </Polyline>
              )
            }
            return (
              <GeoJSON
                key={`a${i}`}
                data={{ type: 'Feature', geometry: feature.geometry, properties: {} } as never}
                style={{ color: feature.color, weight: 2, fillColor: feature.color, fillOpacity: 0.15 }}
              >
                <Tooltip sticky>{feature.label}</Tooltip>
              </GeoJSON>
            )
          })}

          {/* Drawn last so the site marker always sits above the data layers. */}
          <CircleMarker center={[site.lat, site.lon]} radius={8} pathOptions={{ color: '#fffdf7', weight: 3, fillColor: '#c34a35', fillOpacity: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>
              Site étudié
            </Tooltip>
          </CircleMarker>

          <Frame site={site} rayonM={rayonM} />
        </MapContainer>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', marginTop: '0.6rem', fontSize: '0.8rem' }}>
        <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
          {BASE_LAYERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setBaseId(option.id)}
              style={{
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: option.id === baseId ? 700 : 500,
                border: '1.5px solid var(--color-border)',
                background: option.id === baseId ? 'var(--color-accent)' : 'var(--color-surface)',
                color: option.id === baseId ? 'var(--color-accent-ink)' : 'var(--color-ink)',
              }}
            >
              {option.label}
            </button>
          ))}
        </span>
        {groups.map(([group, color]) => (
          <span key={group} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-muted)' }}>
            <span style={{ width: '0.7rem', height: '0.7rem', borderRadius: '50%', background: color, border: '1px solid var(--color-border)' }} />
            {group}
          </span>
        ))}
      </div>
    </div>
  )
}
