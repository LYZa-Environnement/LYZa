import { useCallback, useEffect, useState } from 'react'
import AddressSearch from '../components/AddressSearch'
import FriseAerienne from '../components/FriseAerienne'
import RoseDesVents from '../components/RoseDesVents'
import ThemeSection from '../components/ThemeSection'
import { RUBRIQUES } from '../themes'
import type { Site } from '../types/site'

const STORAGE_KEY = 'lyza.site'

function loadSite(): Site | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Site) : null
  } catch {
    return null
  }
}

export default function Accueil() {
  const [site, setSite] = useState<Site | null>(loadSite)

  useEffect(() => {
    try {
      if (site) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(site))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // A blocked sessionStorage only costs the convenience of keeping the
      // address across a reload — never the page itself.
    }
  }, [site])

  const handleSelect = useCallback((selected: Site) => {
    setSite(selected)
  }, [])

  return (
    <>
      <section className="section">
        <div className="container">
          <p className="eyebrow">Plateforme de consultation de données</p>
          <h1 style={{ maxWidth: '20ch' }}>Ce que les données publiques disent d'une adresse</h1>
          <p className="lede">
            Saisissez une adresse : LYZa interroge en direct les bases publiques françaises et européennes — Géorisques,
            Hub'Eau, IGN, INPN, Copernicus — et restitue six lectures cartographiées de son environnement, avec les sources,
            les distances et les limites de chaque donnée.
          </p>

          <div style={{ maxWidth: '36rem', margin: '2rem 0 1rem' }}>
            <AddressSearch onSelect={handleSelect} />
          </div>

          {site ? (
            <div className="card" style={{ maxWidth: '36rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)' }}>Site étudié</p>
              <strong style={{ fontSize: '1.05rem' }}>{site.label}</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                {site.lat.toFixed(5)}, {site.lon.toFixed(5)} — commune {site.city} ({site.citycode})
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--color-muted)' }}>
              Aucune adresse saisie. Les six rubriques ci-dessous s'afficheront une fois un site sélectionné.
            </p>
          )}

          {site && (
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.5rem' }}>
              {RUBRIQUES.map((rubrique, index) => (
                <a
                  key={rubrique.id}
                  href={`#${rubrique.id}`}
                  className="badge"
                  style={{ textDecoration: 'none', color: 'var(--color-accent)', background: 'var(--color-accent-soft)' }}
                >
                  {index + 1}. {rubrique.titre}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      {site &&
        RUBRIQUES.map((rubrique, index) => (
          <ThemeSection
            key={rubrique.id}
            id={rubrique.id}
            numero={index + 1}
            titre={rubrique.titre}
            sousTitre={rubrique.sousTitre}
            site={site}
            build={rubrique.build}
          >
            {() => (
              <>
                {rubrique.id === 'air' && <RoseDesVents site={site} />}
                {rubrique.id === 'sol' && <FriseAerienne site={site} />}
              </>
            )}
          </ThemeSection>
        ))}

      {site && (
        <section className="section section--deep">
          <div className="container">
            <h2>Comment lire ces données</h2>
            <p>
              Chaque rubrique interroge les sources publiques au moment où vous la consultez : rien n'est stocké, rien n'est
              recalculé à partir d'un cache. Les distances et les directions sont mesurées depuis le point géocodé de
              l'adresse, et les positions amont/aval s'appuient sur le sens d'écoulement renseigné dans la BD TOPO® de l'IGN.
            </p>
            <p>
              Une donnée absente n'est pas une donnée rassurante : chaque rubrique liste explicitement ce qu'elle ne couvre
              pas et pourquoi. Cette plateforme donne une lecture documentaire à distance — elle ne remplace ni une visite de
              site, ni une étude réglementaire.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
