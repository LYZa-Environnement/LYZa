import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSensitivity } from '../api/client'
import AddressSearch from '../components/AddressSearch'
import CasiasSisExplorer from '../components/CasiasSisExplorer'
import SensitivityMap from '../components/SensitivityMap'
import SensitivityPanel from '../components/SensitivityPanel'
import { buildHydroNote, type HydroNote } from '../lib/hydroNote'
import type { AddressResult, SensitivityReport } from '../types/sensitivity'

const RADIUS_M = 1000

const THEME_TO_SERVICES: Record<string, { slug: string; label: string }[]> = {
  sols: [
    { slug: 'due-diligence', label: 'Due diligence environnementale' },
    { slug: 'investigations-ponctuelles', label: 'Investigations et prélèvements ponctuels' },
  ],
  eau: [{ slug: 'hydrogeologie', label: 'Hydrogéologie et protection de la ressource en eau' }],
  risques_naturels: [{ slug: 'changement-climatique', label: 'Adaptation au changement climatique' }],
  activites_industrielles: [{ slug: 'conseil-strategique', label: 'Conseil stratégique en environnement' }],
}

export default function Carte() {
  const [address, setAddress] = useState<AddressResult | null>(null)
  const [report, setReport] = useState<SensitivityReport | null>(null)
  const [hydroNote, setHydroNote] = useState<HydroNote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(selected: AddressResult) {
    setAddress(selected)
    setReport(null)
    setHydroNote(null)
    setError(null)
    setLoading(true)
    try {
      const [sensitivity, hydro] = await Promise.all([fetchSensitivity(selected, RADIUS_M), buildHydroNote(selected.lat, selected.lon)])
      setReport(sensitivity)
      setHydroNote(hydro)
    } catch {
      setError("La synthèse n'a pas pu être calculée pour cette adresse. Vous pouvez réessayer, ou me contacter directement.")
    } finally {
      setLoading(false)
    }
  }

  const suggestedServices =
    report?.themes
      .filter((t) => t.niveau === 'moderee' || t.niveau === 'elevee')
      .flatMap((t) => THEME_TO_SERVICES[t.key] ?? []) ?? []
  const uniqueServices = Array.from(new Map(suggestedServices.map((s) => [s.slug, s])).values())

  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Évaluer un site</p>
        <h1>Sensibilité environnementale</h1>
        <p className="lede">
          Renseignez une adresse pour la situer sur une carte et obtenir une première synthèse par thème (sols,
          eau, risques naturels, activités industrielles), construite à partir des bases de données publiques
          disponibles à proximité.
        </p>

        <div style={{ maxWidth: '34rem', margin: '1.5rem 0 2rem' }}>
          <AddressSearch onSelect={handleSelect} />
        </div>

        {!address && (
          <p style={{ color: 'var(--color-muted)' }}>
            Commencez par saisir une adresse ci-dessus pour afficher la carte et la synthèse.
          </p>
        )}

        {address && (
          <div className="grid grid--2" style={{ alignItems: 'start' }}>
            <div style={{ height: '24rem' }}>
              <SensitivityMap address={address} radiusMeters={RADIUS_M} />
            </div>
            <div>
              {loading && <p>Analyse en cours…</p>}
              {error && (
                <div className="card" style={{ borderColor: 'var(--level-elevee)' }}>
                  <p style={{ marginBottom: '0.5rem' }}>{error}</p>
                  <Link to="/contact">Me contacter →</Link>
                </div>
              )}
              {report && <SensitivityPanel report={report} />}
            </div>
          </div>
        )}

        {hydroNote && (
          <div className="card" style={{ marginTop: '2rem' }}>
            <h3>Note de vulnérabilité et de sensibilité — eaux superficielles et souterraines</h3>
            {hydroNote.paragraphs.map((paragraph, i) => (
              <p key={i} style={{ fontSize: '0.92rem' }}>
                {paragraph.text}
                {paragraph.linkHref && (
                  <>
                    {' '}
                    <a href={paragraph.linkHref} target="_blank" rel="noopener noreferrer">
                      {paragraph.linkLabel ?? 'En savoir plus'} →
                    </a>
                  </>
                )}
              </p>
            ))}
          </div>
        )}

        {address && (
          <div style={{ marginTop: '2rem' }}>
            <CasiasSisExplorer address={address} />
          </div>
        )}

        {report && (
          <div className="section section--muted" style={{ marginTop: '3rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
            <h2>Aller plus loin</h2>
            <p>
              Cette synthèse s'appuie sur des données publiques et donne une première lecture des enjeux. Pour un
              site présentant des enjeux avérés, une étude ciblée (sol, eau, réglementaire) permet de vérifier ces
              signaux et de sécuriser une décision.
            </p>
            {uniqueServices.length > 0 ? (
              <div className="grid grid--3">
                {uniqueServices.map((service) => (
                  <Link key={service.slug} to={`/prestations/${service.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <strong>{service.label}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--color-muted)' }}>
                Aucun signal notable n'a été relevé à proximité : c'est une bonne base, à confirmer si votre
                projet le justifie.
              </p>
            )}
            <p style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/contact" className="btn">
                Échanger sur ce site
              </Link>
              <a href={`${import.meta.env.BASE_URL}lyza-cartes.html`} className="btn btn--ghost">
                Ouvrir LYZa Cartes (calques détaillés) →
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
