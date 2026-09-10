import { useState } from 'react'
import { LEVEL_LABELS, type SensitivityReport, type ThemeSynthesis } from '../types/sensitivity'

function ThemeCard({ theme }: { theme: ThemeSynthesis }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
        <h3 style={{ marginBottom: '0.3rem' }}>{theme.titre}</h3>
        <span className={`badge badge--${theme.niveau}`}>{LEVEL_LABELS[theme.niveau]}</span>
      </div>
      <p style={{ marginBottom: theme.items.length ? '0.5rem' : 0 }}>{theme.resume}</p>

      {theme.items.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="btn btn--ghost"
          style={{ padding: '0.35em 0.8em', fontSize: '0.85rem' }}
        >
          {open ? 'Masquer le détail' : 'Voir le détail'}
        </button>
      )}

      {open && (
        <ul style={{ marginTop: '0.8rem' }}>
          {theme.items.map((item) => (
            <li key={item.label} style={{ marginBottom: '0.4rem' }}>
              <strong>{item.label}</strong> — {item.detail}
              <br />
              <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Source : {item.source}</span>
            </li>
          ))}
        </ul>
      )}

      {theme.donnees_manquantes.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.6rem', marginBottom: 0 }}>
          Donnée(s) indisponible(s) pour cette synthèse : {theme.donnees_manquantes.join(', ')}.
        </p>
      )}
    </div>
  )
}

export default function SensitivityPanel({ report }: { report: SensitivityReport }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ marginBottom: 0 }}>Synthèse — {report.address.city}</h2>
        <span className={`badge badge--${report.niveau_global}`}>
          Niveau global : {LEVEL_LABELS[report.niveau_global]}
        </span>
      </div>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
        Rayon d'analyse : {report.rayon_metres} m autour de l'adresse indiquée.
      </p>

      <div className="grid grid--2">
        {report.themes.map((theme) => (
          <ThemeCard key={theme.key} theme={theme} />
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--color-accent-soft)', border: 'none' }}>
        <p style={{ marginBottom: 0, fontSize: '0.9rem' }}>{report.avertissement}</p>
      </div>
    </div>
  )
}
