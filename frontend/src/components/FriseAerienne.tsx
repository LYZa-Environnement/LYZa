import { useEffect, useMemo, useState } from 'react'
import { diagonaleM } from '../lib/cadastre'
import { ringsOfGeometry, type PolygonGeometry } from '../lib/geo'
import { cadreAerien, orthoImageUrl, PERIODES, type CadreAerien } from '../lib/ortho'
import type { Site } from '../types/site'

type Couverture = 'inconnue' | 'couverte' | 'absente'

/**
 * Whether an aerial campaign actually covers this point.
 *
 * IGN's WMS answers a request outside a campaign's footprint with a valid but
 * empty image rather than an error, so a missing decade looks like a blank
 * square unless the pixels are inspected. A tiny 24 px version is fetched and
 * sampled: fully transparent, or one flat colour, means no coverage.
 *
 * The probe is deliberately separate from the displayed image, which is loaded
 * as an ordinary <img> with no crossOrigin attribute. Tying the two together
 * would mean that any CORS hiccup — a proxy, a corporate filter — stops the
 * photographs from displaying at all. Here a failed probe only costs the
 * filtering: the frame is kept and shown.
 */
async function sondeCouverture(url: string): Promise<Couverture> {
  try {
    const response = await fetch(url, { mode: 'cors' })
    // A server error says nothing about coverage — only a blank image that
    // actually decoded does. Hiding a campaign on a 500 would quietly drop a
    // decade that does have photographs.
    if (!response.ok) return 'inconnue'
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return 'inconnue'
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    bitmap.close()

    let opaques = 0
    let premier: [number, number, number] | null = null
    let uniforme = true
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue
      opaques++
      const pixel: [number, number, number] = [data[i], data[i + 1], data[i + 2]]
      if (!premier) premier = pixel
      else if (Math.abs(pixel[0] - premier[0]) + Math.abs(pixel[1] - premier[1]) + Math.abs(pixel[2] - premier[2]) > 24) uniforme = false
    }
    const total = data.length / 4
    if (opaques < total * 0.2) return 'absente'
    return uniforme ? 'absente' : 'couverte'
  } catch {
    return 'inconnue'
  }
}

/**
 * The site's footprint drawn over a frame.
 *
 * The frame is a plain <img> covering a known box, and the box is linear in
 * degrees, so the outline projects onto it with a straight percentage mapping
 * — no reprojection, and the polygon lands exactly where the parcels are on
 * the photograph. That is the whole point of the timeline once a footprint
 * exists: seeing what stood on *these* parcels in 1965, not near them.
 */
function ContourSite({ emprise, cadre }: { emprise: PolygonGeometry; cadre: CadreAerien }) {
  const largeur = cadre.est - cadre.ouest
  const hauteur = cadre.nord - cadre.sud
  const polygones = ringsOfGeometry(emprise).map((ring) =>
    ring.map(([lon, lat]) => `${(((lon - cadre.ouest) / largeur) * 100).toFixed(2)},${(((cadre.nord - lat) / hauteur) * 100).toFixed(2)}`).join(' '),
  )
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {polygones.map((points, i) => (
        <g key={i}>
          {/* A white halo under the red line: an outline in a single colour
              disappears over pale ground on the old black-and-white plates. */}
          <polygon points={points} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <polygon points={points} fill="#c34a3522" stroke="#c34a35" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  )
}

/** Decade-by-decade aerial views of the study site, each centred on it and
 * showing its outline — the visual record of what was built, cleared or
 * filled on the plot before any database recorded it. */
export default function FriseAerienne({ site, coteM }: { site: Site; coteM?: number }) {
  const [couverture, setCouverture] = useState<Record<string, Couverture>>({})

  // A fixed 250 m frame crops a large industrial site and leaves a small plot
  // lost in a field of roofs. The frame follows the footprint when there is
  // one, with enough margin to read its surroundings.
  const cote = useMemo(() => {
    if (coteM) return coteM
    if (!site.emprise) return 250
    return Math.min(2000, Math.max(200, Math.round((diagonaleM(site.emprise) * 2.4) / 50) * 50))
  }, [coteM, site.emprise])
  const cadre = useMemo(() => cadreAerien(site.lat, site.lon, cote), [site.lat, site.lon, cote])

  // Probed one after another, not all at once: nine probes plus nine display
  // images plus the rubrique's own map tiles all target data.geopf.fr, and
  // firing them together exceeds the browser's per-host connection limit —
  // requests then queue and time out, which would wrongly hide campaigns that
  // do have coverage.
  useEffect(() => {
    let annule = false
    setCouverture({})
    void (async () => {
      for (const periode of PERIODES) {
        const resultat = await sondeCouverture(orthoImageUrl(site.lat, site.lon, periode.id, cote, 24))
        if (annule) return
        setCouverture((precedent) => ({ ...precedent, [periode.id]: resultat }))
      }
    })()
    return () => {
      annule = true
    }
  }, [site.lat, site.lon, cote])

  const visibles = PERIODES.filter((periode) => couverture[periode.id] !== 'absente')

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Frise des photographies aériennes</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
        Vues de {cote} m de côté centrées sur le site, {site.emprise ? "avec le contour de l'emprise retenue" : 'repéré par la croix rouge'}. Les campagnes sans couverture à cet endroit ne sont pas affichées :
        l'absence d'une décennie signifie que l'Institut national de l'information géographique et forestière n'a pas de cliché exploitable ici, pas qu'il ne s'y passait rien.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))', gap: '1rem' }}>
        {visibles.map((periode) => (
          <figure key={periode.id} style={{ margin: 0 }}>
            <div
              style={{
                position: 'relative',
                aspectRatio: '1',
                border: '1.5px solid var(--color-border)',
                borderRadius: '6px',
                overflow: 'hidden',
                background: 'var(--level-indeterminee-bg)',
              }}
            >
              <img
                src={orthoImageUrl(site.lat, site.lon, periode.id, cote)}
                alt={`Vue aérienne du site, ${periode.label}`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* The outline when the plot has been delimited, the crosshair
                  otherwise: marking the centre of a footprint that is already
                  drawn would only clutter the frame. */}
              {site.emprise ? (
                <ContourSite emprise={site.emprise} cadre={cadre} />
              ) : (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '1.2rem',
                    height: '1.2rem',
                    transform: 'translate(-50%, -50%)',
                    border: '2px solid #c34a35',
                    borderRadius: '50%',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.85)',
                  }}
                />
              )}
            </div>
            <figcaption style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: '0.35rem' }}>{periode.label}</figcaption>
          </figure>
        ))}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0.8rem 0 0' }}>
        Source : Institut national de l'information géographique et forestière (IGN) — photographies aériennes historiques (
        <a href="https://remonterletemps.ign.fr/" target="_blank" rel="noopener noreferrer">
          Remonter le temps
        </a>
        ).
      </p>
    </div>
  )
}
