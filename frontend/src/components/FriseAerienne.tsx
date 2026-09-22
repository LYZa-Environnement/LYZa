import { useState } from 'react'
import { orthoImageUrl, PERIODES } from '../lib/ortho'
import type { Site } from '../types/site'

/** Decade-by-decade aerial views of the study site, each one centred on it
 * and marked with a crosshair — the visual record of what was built, cleared
 * or filled on the plot before any database recorded it. */
export default function FriseAerienne({ site, coteM = 600 }: { site: Site; coteM?: number }) {
  const [manquantes, setManquantes] = useState<Record<string, boolean>>({})

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Frise des photographies aériennes</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
        Vues de {coteM} m de côté centrées sur le site (croix rouge). Une campagne sans couverture à cet endroit apparaît comme une
        vignette vide — l'absence d'image ne signifie pas l'absence d'activité.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))', gap: '1rem' }}>
        {PERIODES.map((periode) => (
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
                src={orthoImageUrl(site.lat, site.lon, periode.id, coteM)}
                alt={`Vue aérienne du site, ${periode.label}`}
                loading="lazy"
                onError={() => setManquantes((previous) => ({ ...previous, [periode.id]: true }))}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {manquantes[periode.id] && (
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  Pas de couverture
                </span>
              )}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '1.4rem',
                  height: '1.4rem',
                  transform: 'translate(-50%, -50%)',
                  border: '2px solid #c34a35',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
                }}
              />
            </div>
            <figcaption style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: '0.35rem' }}>{periode.label}</figcaption>
          </figure>
        ))}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0.8rem 0 0' }}>
        Source : IGN — photographies aériennes historiques (
        <a href="https://remonterletemps.ign.fr/" target="_blank" rel="noopener noreferrer">
          Remonter le temps
        </a>
        ).
      </p>
    </div>
  )
}
