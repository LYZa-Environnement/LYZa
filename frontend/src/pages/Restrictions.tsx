import { useState } from 'react'
import AddressSearch from '../components/AddressSearch'
import { GRAVITE_LABEL, TYPE_LABEL, fetchRestrictions, sortBySeverityDesc, type NiveauGravite, type VigieauZone } from '../lib/vigieau'
import type { AddressResult } from '../types/sensitivity'

const GRAVITE_STYLE: Record<NiveauGravite, { color: string; bg: string }> = {
  vigilance: { color: '#a3671a', bg: '#f6ecd9' },
  alerte: { color: '#c9711f', bg: '#faead9' },
  alerte_renforcee: { color: '#c34a35', bg: '#f7e3dd' },
  crise: { color: '#7a1f1f', bg: '#f0d9d9' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function GraviteBadge({ niveau }: { niveau: NiveauGravite }) {
  const style = GRAVITE_STYLE[niveau]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.3em 0.8em',
        borderRadius: 999,
        border: '1.5px solid currentColor',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: style.color,
        background: style.bg,
      }}
    >
      {GRAVITE_LABEL[niveau]}
    </span>
  )
}

function ZoneCard({ zone }: { zone: VigieauZone }) {
  const thematiques = Array.from(new Set(zone.usages.map((u) => u.thematique)))
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <GraviteBadge niveau={zone.niveauGravite} />
        <span className="badge badge--indeterminee">{TYPE_LABEL[zone.type]}</span>
      </div>
      <h3 style={{ marginBottom: '0.3rem' }}>{zone.nom}</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
        Arrêté en vigueur du {formatDate(zone.arrete.dateDebutValidite)} au {formatDate(zone.arrete.dateFinValidite)} —
        département {zone.departement}.
      </p>

      {zone.usages.length > 0 && (
        <details style={{ marginTop: '0.8rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}>
            Usages concernés ({zone.usages.length})
          </summary>
          <div style={{ marginTop: '0.8rem', display: 'grid', gap: '1rem' }}>
            {thematiques.map((thematique) => (
              <div key={thematique}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>{thematique}</p>
                <ul style={{ marginTop: 0, marginBottom: 0 }}>
                  {zone.usages
                    .filter((u) => u.thematique === thematique)
                    .map((u) => (
                      <li key={u.id} style={{ fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                        <strong>{u.nom}</strong> — {u.description}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <p style={{ marginTop: '0.8rem', marginBottom: 0 }}>
        <a href={zone.arrete.cheminFichier} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>
          Voir l'arrêté (PDF) →
        </a>
      </p>
    </div>
  )
}

export default function Restrictions() {
  const [address, setAddress] = useState<AddressResult | null>(null)
  const [zones, setZones] = useState<VigieauZone[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(selected: AddressResult) {
    setAddress(selected)
    setZones(null)
    setError(null)
    setLoading(true)
    try {
      const result = await fetchRestrictions(selected.lat, selected.lon)
      if (result === null) {
        setError("Les restrictions n'ont pas pu être récupérées pour cette adresse. Vous pouvez réessayer dans un instant.")
      } else {
        setZones(sortBySeverityDesc(result))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '46rem' }}>
        <p className="eyebrow">Outil gratuit</p>
        <h1>Restrictions d'eau en vigueur</h1>
        <p className="lede">
          Renseignez une adresse pour connaître le niveau de restriction d'eau actuellement en vigueur — eaux
          superficielles, eaux souterraines et eau potable — d'après les arrêtés préfectoraux publiés sur VigiEau
          (ministère de la Transition écologique).
        </p>

        <div style={{ marginTop: '2rem' }}>
          <AddressSearch onSelect={handleSelect} />
        </div>

        {loading && <p style={{ color: 'var(--color-muted)', marginTop: '1.5rem' }}>Recherche en cours…</p>}
        {error && <p style={{ color: 'var(--level-elevee)', marginTop: '1.5rem' }}>{error}</p>}

        {zones !== null && !loading && (
          <div style={{ marginTop: '2rem' }}>
            {zones.length === 0 ? (
              <p style={{ color: 'var(--color-muted)' }}>
                Aucune zone de restriction n'est actuellement en vigueur à cette adresse d'après VigiEau.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {zones.map((zone) => (
                  <ZoneCard key={`${zone.id}-${zone.type}`} zone={zone} />
                ))}
              </div>
            )}
          </div>
        )}

        {address && (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '2.5rem' }}>
            Source :{' '}
            <a href="https://www.vigieau.gouv.fr" target="_blank" rel="noopener noreferrer">
              VigiEau
            </a>{' '}
            — données mises à jour par les services de l'État à chaque nouvel arrêté. Cette lecture ne remplace pas
            l'arrêté préfectoral lui-même, seul document opposable.
          </p>
        )}
      </div>
    </div>
  )
}
