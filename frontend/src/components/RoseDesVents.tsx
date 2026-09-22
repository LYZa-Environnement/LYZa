import { useEffect, useState } from 'react'
import { dominantDirections, fetchWindRose, type WindRose } from '../lib/wind'
import { safe } from '../themes/common'
import { cardinalLabelFr } from '../lib/geo'
import WindRoseChart from './WindRoseChart'
import type { Site } from '../types/site'

/** Which way the wind usually comes from here — the piece of context that
 * decides whether a nearby emitter sits upwind of the site or not. */
export default function RoseDesVents({ site }: { site: Site }) {
  const [rose, setRose] = useState<WindRose | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    // Wrapped like every other source: a hanging request must end as
    // "indisponible", not as a spinner that never resolves.
    safe(fetchWindRose(site.lat, site.lon)).then((result) => {
      if (cancelled) return
      if (result) {
        setRose(result)
        setState('ready')
      } else {
        setState('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [site.lat, site.lon])

  if (state === 'error') {
    return (
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem' }}>Rose des vents</h3>
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          Les données de vent n'ont pas pu être récupérées pour ce point.
        </p>
      </div>
    )
  }

  const dominants = rose ? dominantDirections(rose, 3) : []

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Rose des vents</h3>
      {state === 'loading' && <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Calcul en cours…</p>}
      {rose && (
        <div className="grid grid--2" style={{ alignItems: 'center' }}>
          <WindRoseChart rose={rose} />
          <div>
            <p style={{ fontSize: '0.95rem' }}>
              Sur l'année {rose.year}, le vent souffle le plus souvent du{' '}
              <strong>{dominants.map((d) => cardinalLabelFr(d.direction)).join(', du ')}</strong>
              {dominants.length > 0 && (
                <>
                  {' '}
                  ({dominants.map((d) => `${(d.share * 100).toFixed(0)} %`).join(', ')} des heures respectivement).
                </>
              )}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
              Un émetteur situé dans l'un de ces secteurs se trouve au vent du site : ses rejets atmosphériques le
              traversent plus souvent que sa seule distance ne le laisserait penser.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: 0 }}>
              Source : réanalyse ERA5 via{' '}
              <a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noopener noreferrer">
                Open-Meteo
              </a>{' '}
              — {rose.totalHours.toLocaleString('fr-FR')} heures analysées. Il s'agit d'une réanalyse à maille large, non
              d'une station Météo-France au sol.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
