import { useEffect, useRef, useState, type ReactNode } from 'react'
import { enFile } from '../lib/queue'
import ThemeMap from './ThemeMap'
import type { Indicator, Level, Site, ThemeReport } from '../types/site'

const LEVEL_STYLE: Record<Level, { color: string; background: string }> = {
  favorable: { color: 'var(--level-faible)', background: 'var(--level-faible-bg)' },
  attention: { color: 'var(--level-moderee)', background: 'var(--level-moderee-bg)' },
  defavorable: { color: 'var(--level-elevee)', background: 'var(--level-elevee-bg)' },
  inconnu: { color: 'var(--level-indeterminee)', background: 'var(--level-indeterminee-bg)' },
}

function IndicatorRow({ indicator }: { indicator: Indicator }) {
  const style = LEVEL_STYLE[indicator.level ?? 'inconnu']
  return (
    <li style={{ padding: '0.7rem 0', borderTop: '1px solid rgba(27, 42, 31, 0.14)' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{indicator.label}</span>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            padding: '0.1rem 0.6rem',
            borderRadius: '999px',
            color: style.color,
            background: style.background,
            border: `1.5px solid ${style.color}`,
          }}
        >
          {indicator.value}
        </span>
      </div>
      {indicator.situation && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--color-accent-deep)', fontWeight: 600 }}>{indicator.situation}</p>
      )}
      {indicator.detail && <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>{indicator.detail}</p>}
      {indicator.href && (
        <a href={indicator.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem' }}>
          Consulter la fiche →
        </a>
      )}
    </li>
  )
}

interface Props {
  id: string
  numero: number
  titre: string
  sousTitre: string
  site: Site
  build: (site: Site) => Promise<ThemeReport>
  /** Rendered under the commentary — charts, timelines, anything the
   * generic indicator list can't express. */
  children?: (report: ThemeReport) => ReactNode
}

export default function ThemeSection({ id, numero, titre, sousTitre, site, build, children }: Props) {
  const [report, setReport] = useState<ThemeReport | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const containerRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  // Six rubriques firing dozens of API calls at once would hammer every
  // upstream service for data most visitors never scroll to — each one waits
  // until it is actually approached.
  useEffect(() => {
    const node = containerRef.current
    if (!node || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  // `state` and `report` must stay out of this effect's dependencies: they
  // are written by the effect itself, so listing them would re-run it, and
  // the cleanup would cancel the very request it just started — leaving the
  // section loading forever.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setReport(null)
    setState('loading')
    // Queued rather than fired immediately: six rubriques starting at once
    // saturate the browser's per-host connection limit (see lib/queue.ts).
    enFile(() => build(site))
      .then((result) => {
        if (cancelled) return
        setReport(result)
        setState('idle')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [visible, site, build])

  return (
    <section ref={containerRef} id={id} className="section" style={{ borderTop: 'var(--border-w) solid var(--color-border)', scrollMarginTop: '1rem' }}>
      <div className="container">
        <p className="eyebrow">Rubrique {numero}</p>
        <h2 style={{ marginBottom: '0.3rem' }}>{titre}</h2>
        <p className="lede" style={{ marginBottom: '1.75rem' }}>{sousTitre}</p>

        {state === 'loading' && <p style={{ color: 'var(--color-muted)' }}>Interrogation des bases publiques…</p>}
        {state === 'error' && (
          <div className="card" style={{ borderColor: 'var(--level-elevee)' }}>
            <p style={{ margin: 0 }}>Les données de cette rubrique n'ont pas pu être récupérées. Réessayez plus tard.</p>
          </div>
        )}

        {report && (
          <>
            <div className="grid grid--2" style={{ alignItems: 'start' }}>
              <ThemeMap site={site} features={report.features} rayonM={report.rayonM} />
              <div>
                {report.commentaire.map((paragraph, i) => (
                  <p key={i} style={{ fontSize: '0.95rem' }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {report.indicateurs.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Données relevées</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {report.indicateurs.map((indicator) => (
                    <IndicatorRow key={indicator.label} indicator={indicator} />
                  ))}
                </ul>
              </div>
            )}

            {children?.(report)}

            <div className="grid grid--2" style={{ marginTop: '1.5rem', alignItems: 'start' }}>
              <div className="card">
                <h3 style={{ fontSize: '1.05rem' }}>Sources des données</h3>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                  {report.sources.map((source) => (
                    <li key={source.label} style={{ marginBottom: '0.5rem' }}>
                      <a href={source.href} target="_blank" rel="noopener noreferrer">
                        {source.label}
                      </a>
                      {source.note && <span style={{ color: 'var(--color-muted)' }}> — {source.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              {report.lacunes.length > 0 && (
                <div className="card" style={{ background: 'var(--level-indeterminee-bg)' }}>
                  <h3 style={{ fontSize: '1.05rem' }}>Ce que cette rubrique ne couvre pas</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                    {report.lacunes.map((gap) => (
                      <li key={gap} style={{ marginBottom: '0.4rem' }}>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
