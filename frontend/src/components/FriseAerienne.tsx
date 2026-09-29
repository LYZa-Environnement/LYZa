import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { diagonaleM } from '../lib/cadastre'
import { ringsOfGeometry, type PolygonGeometry } from '../lib/geo'
import { cadreAerien, orthoImageUrl, PERIODES, type CadreAerien, type PeriodeAerienne } from '../lib/ortho'
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

/** The site on a frame: its outline once the plot has been delimited, a
 * crosshair otherwise — marking the centre of a footprint that is already
 * drawn would only clutter the frame. */
function RepereSite({ site, cadre }: { site: Site; cadre: CadreAerien }) {
  if (site.emprise) return <ContourSite emprise={site.emprise} cadre={cadre} />
  return (
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
  )
}

/** Pixel width requested from the WMS for an enlarged frame. The service
 * serves up to 2048, but that is a 3 MB plate for a picture nobody zooms into
 * pixel by pixel; 1400 shows the detail a 250 m frame actually holds. */
const PIXELS_LOUPE = 1400

/**
 * An enlarged frame, over the page.
 *
 * The thumbnail is kept underneath while the full-size plate loads: it is
 * already in cache, so the enlargement appears instantly in a coarse form and
 * sharpens when the real image arrives, instead of opening on a grey square
 * for the second or two a 1.7 MB photograph takes.
 */
function Loupe({
  site,
  cadre,
  cote,
  periodes,
  index,
  onFermer,
  onNaviguer,
}: {
  site: Site
  cadre: CadreAerien
  cote: number
  periodes: PeriodeAerienne[]
  index: number
  onFermer: () => void
  onNaviguer: (index: number) => void
}) {
  const periode = periodes[index]
  const [charge, setCharge] = useState(false)
  const boutonFermer = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setCharge(false)
  }, [periode.id])

  // Escape closes, the arrows walk the timeline: a reader comparing decades
  // should not have to go back to the grid between two frames.
  useEffect(() => {
    const touche = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFermer()
      else if (event.key === 'ArrowLeft' && index > 0) onNaviguer(index - 1)
      else if (event.key === 'ArrowRight' && index < periodes.length - 1) onNaviguer(index + 1)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [index, periodes.length, onFermer, onNaviguer])

  // The page must not scroll behind the overlay, and focus has to land inside
  // it — otherwise the next Tab walks the page the reader cannot see.
  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    boutonFermer.current?.focus()
    return () => {
      document.body.style.overflow = precedent
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vue aérienne du site, ${periode.label}`}
      onClick={onFermer}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(16, 20, 17, 0.88)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.9rem',
        padding: 'clamp(0.75rem, 3vw, 2rem)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(90vw, 78vh)',
          aspectRatio: '1',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          background: '#1b2a1f',
        }}
      >
        <img
          src={orthoImageUrl(site.lat, site.lon, periode.id, cote)}
          alt=""
          aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(1px)' }}
        />
        <img
          src={orthoImageUrl(site.lat, site.lon, periode.id, cote, PIXELS_LOUPE)}
          alt={`Vue aérienne du site, ${periode.label}`}
          onLoad={() => setCharge(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: charge ? 1 : 0,
            transition: 'opacity 0.25s',
          }}
        />
        <RepereSite site={site} cadre={cadre} />
      </div>

      <div
        onClick={(event) => event.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fffdf7', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        <button type="button" className="btn btn--ghost" onClick={() => onNaviguer(index - 1)} disabled={index === 0} aria-label="Vue précédente">
          ←
        </button>
        <span style={{ fontWeight: 700, minWidth: '9rem', textAlign: 'center' }}>{periode.label}</span>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onNaviguer(index + 1)}
          disabled={index === periodes.length - 1}
          aria-label="Vue suivante"
        >
          →
        </button>
        <button type="button" className="btn" ref={boutonFermer} onClick={onFermer}>
          Fermer
        </button>
      </div>
      <p style={{ color: '#fffdf7bb', fontSize: '0.82rem', margin: 0, textAlign: 'center' }} onClick={(event) => event.stopPropagation()}>
        Vue de {cote} m de côté · {index + 1} / {periodes.length} · flèches ← → pour changer de période, Échap pour fermer
      </p>
    </div>
  )
}

/** Decade-by-decade aerial views of the study site, each centred on it and
 * showing its outline — the visual record of what was built, cleared or
 * filled on the plot before any database recorded it. */
export default function FriseAerienne({ site, coteM }: { site: Site; coteM?: number }) {
  const [couverture, setCouverture] = useState<Record<string, Couverture>>({})
  const [agrandie, setAgrandie] = useState<number | null>(null)

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
  const fermer = useCallback(() => setAgrandie(null), [])
  const naviguer = useCallback((index: number) => setAgrandie(index), [])

  // A frame vanishing from the grid while enlarged — the coverage probe
  // finishing late — must not leave the overlay pointing past the end.
  useEffect(() => {
    if (agrandie !== null && agrandie >= visibles.length) setAgrandie(visibles.length > 0 ? visibles.length - 1 : null)
  }, [agrandie, visibles.length])

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Frise des photographies aériennes</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
        Vues de {cote} m de côté centrées sur le site, {site.emprise ? "avec le contour de l'emprise retenue" : 'repéré par la croix rouge'}. Les campagnes sans couverture à cet endroit ne sont pas affichées :
        l'absence d'une décennie signifie que l'Institut national de l'information géographique et forestière n'a pas de cliché exploitable ici, pas qu'il ne s'y passait rien.
        Cliquez sur une vue pour l'agrandir.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))', gap: '1rem' }}>
        {visibles.map((periode, index) => (
          <figure key={periode.id} style={{ margin: 0 }}>
            {/* A button, not a bare image with a click handler: enlarging a
                photograph is an action, and it has to be reachable with the
                keyboard like any other. */}
            <button
              type="button"
              onClick={() => setAgrandie(index)}
              aria-label={`Agrandir la vue aérienne ${periode.label}`}
              style={{
                display: 'block',
                width: '100%',
                padding: 0,
                position: 'relative',
                aspectRatio: '1',
                border: '1.5px solid var(--color-border)',
                borderRadius: '6px',
                overflow: 'hidden',
                background: 'var(--level-indeterminee-bg)',
                cursor: 'zoom-in',
              }}
            >
              <img
                src={orthoImageUrl(site.lat, site.lon, periode.id, cote)}
                alt=""
                aria-hidden
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <RepereSite site={site} cadre={cadre} />
            </button>
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

      {agrandie !== null && visibles[agrandie] && (
        <Loupe site={site} cadre={cadre} cote={cote} periodes={visibles} index={agrandie} onFermer={fermer} onNaviguer={naviguer} />
      )}
    </div>
  )
}
