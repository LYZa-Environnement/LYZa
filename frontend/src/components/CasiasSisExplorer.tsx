import { type CSSProperties, useState } from 'react'
import { formatDistance } from '../lib/geo'
import { fetchSsp, type CasiasItem, type Localisation, type SisItem, type SspResult } from '../lib/georisques'
import type { AddressResult } from '../types/sensitivity'

const RADIUS_OPTIONS = [100, 250, 500, 1000, 2000, 5000]

function localisationLabel(loc: Localisation | null): string {
  return loc ? `${formatDistance(loc.distanceM)} — ${loc.direction}` : 'Non localisé'
}

function byDistance<T extends { localisation: Localisation | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.localisation?.distanceM ?? Infinity) - (b.localisation?.distanceM ?? Infinity))
}

function CasiasTable({ items }: { items: CasiasItem[] }) {
  if (items.length === 0) return <p style={{ color: 'var(--color-muted)' }}>Aucun site CASIAS recensé dans ce rayon.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
            <th style={thStyle}>Identifiant CASIAS</th>
            <th style={thStyle}>Société / activité</th>
            <th style={thStyle}>Localisation par rapport au site</th>
          </tr>
        </thead>
        <tbody>
          {byDistance(items).map((item, i) => (
            <tr key={`${item.identifiant ?? item.nom}-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={tdStyle}>{item.identifiant ?? '—'}</td>
              <td style={tdStyle}>
                {item.ficheUrl ? (
                  <a href={item.ficheUrl} target="_blank" rel="noopener noreferrer">
                    <strong>{item.nom}</strong>
                  </a>
                ) : (
                  <strong>{item.nom}</strong>
                )}
                <br />
                <span style={{ color: 'var(--color-muted)' }}>{[item.activite, item.statut, item.commune].filter(Boolean).join(' — ') || 'Descriptif non renseigné'}</span>
              </td>
              <td style={tdStyle}>{localisationLabel(item.localisation)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SisTable({ items }: { items: SisItem[] }) {
  if (items.length === 0) return <p style={{ color: 'var(--color-muted)' }}>Aucun secteur SIS recensé dans ce rayon.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
            <th style={thStyle}>Identifiant SIS</th>
            <th style={thStyle}>Secteur / descriptif</th>
            <th style={thStyle}>Localisation par rapport au site</th>
          </tr>
        </thead>
        <tbody>
          {byDistance(items).map((item, i) => (
            <tr key={`${item.identifiant ?? item.nom}-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={tdStyle}>{item.identifiant ?? '—'}</td>
              <td style={tdStyle}>
                {item.ficheUrl ? (
                  <a href={item.ficheUrl} target="_blank" rel="noopener noreferrer">
                    <strong>{item.nom}</strong>
                  </a>
                ) : (
                  <strong>{item.nom}</strong>
                )}
                <br />
                <span style={{ color: 'var(--color-muted)' }}>
                  {[item.superficieM2 ? `${Math.round(item.superficieM2)} m²` : null, item.commune].filter(Boolean).join(' — ') || 'Descriptif non renseigné'}
                </span>
              </td>
              <td style={tdStyle}>{localisationLabel(item.localisation)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: CSSProperties = { padding: '0.5rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }
const tdStyle: CSSProperties = { padding: '0.6rem', verticalAlign: 'top' }

export default function CasiasSisExplorer({ address }: { address: AddressResult }) {
  const [rayon, setRayon] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SspResult | null>(null)

  async function handleSearch() {
    setLoading(true)
    setError(null)
    try {
      const ssp = await fetchSsp(address.lat, address.lon, rayon)
      if (ssp === null) {
        setError("La recherche n'a pas pu aboutir (Géorisques indisponible). Réessayez dans un instant.")
        setResult(null)
      } else {
        setResult(ssp)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h3>Recherche détaillée — anciens sites industriels et sols pollués</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
        CASIAS regroupe, dans la base Géorisques actuelle, les anciens inventaires ex-BASIAS (sites industriels
        recensés) et ex-BASOL (sites appelant une action des pouvoirs publics) — les deux ne sont plus distingués
        par l'API, d'où un tableau unique plutôt que deux.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label htmlFor="casias-rayon" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Rayon de recherche
        </label>
        <select
          id="casias-rayon"
          value={rayon}
          onChange={(e) => setRayon(Number(e.target.value))}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r >= 1000 ? `${r / 1000} km` : `${r} m`}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--level-elevee)' }}>{error}</p>}

      {result && (
        <>
          <h4 style={{ marginTop: '1.5rem' }}>CASIAS — anciens sites industriels (ex-BASIAS / ex-BASOL)</h4>
          <CasiasTable items={result.casias.items} />

          <h4 style={{ marginTop: '2rem' }}>SIS — secteurs d'information sur les sols</h4>
          <SisTable items={result.sis.items} />
        </>
      )}
    </div>
  )
}
