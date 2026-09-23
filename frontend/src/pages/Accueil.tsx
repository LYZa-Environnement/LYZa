import { useCallback, useEffect, useState } from 'react'
import AddressSearch from '../components/AddressSearch'
import FriseAerienne from '../components/FriseAerienne'
import RoseDesVents from '../components/RoseDesVents'
import ThemeSection from '../components/ThemeSection'
import Veille from '../components/Veille'
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

const PRINCIPES = [
  {
    titre: 'Interrogé en direct',
    texte: "Chaque rubrique appelle les API publiques au moment où vous la consultez. Rien n'est stocké, rien n'est mis en cache.",
  },
  {
    titre: 'Situé par rapport au site',
    texte: "Distance et direction pour chaque élément, et position amont ou aval quand le sens d'écoulement du cours d'eau est connu.",
  },
  {
    titre: 'Les manques affichés',
    texte: "Chaque rubrique liste ce qu'elle ne couvre pas et pourquoi. Une donnée absente est une question ouverte, pas un feu vert.",
  },
]

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
            Saisissez une adresse : LYZa interroge les bases publiques françaises et européennes — Géorisques, Hub'Eau, IGN, INPN,
            GIS Sol, Copernicus — et restitue six lectures cartographiées de son environnement, avec les sources, les distances et les
            limites de chaque donnée.
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
            <div className="grid grid--3" style={{ marginTop: '2.5rem' }}>
              {PRINCIPES.map((principe) => (
                <div key={principe.titre} className="card">
                  <strong style={{ display: 'block', marginBottom: '0.35rem' }}>{principe.titre}</strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>{principe.texte}</span>
                </div>
              ))}
            </div>
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

      {!site && (
        <section className="section section--muted">
          <div className="container">
            <p className="eyebrow">Les six rubriques</p>
            <h2 style={{ marginBottom: '0.3rem' }}>Ce qui est restitué pour chaque adresse</h2>
            <p className="lede" style={{ marginBottom: '1.75rem' }}>
              Chaque rubrique part d'une carte au 1:25 000, situe les données par rapport au site, et cite ses sources.
            </p>
            <div className="grid grid--3">
              {RUBRIQUES.map((rubrique, index) => (
                <div key={rubrique.id} className="card">
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-accent)' }}>
                    RUBRIQUE {index + 1}
                  </span>
                  <h3 style={{ fontSize: '1.05rem', margin: '0.3rem 0 0.4rem' }}>{rubrique.titre}</h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-muted)' }}>{rubrique.sousTitre}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

      <Veille />

      <section className="section section--deep">
        <div className="container">
          <h2>Comment lire ces données</h2>
          <p>
            Les distances et les directions sont mesurées depuis le point géocodé de l'adresse, et les positions amont/aval s'appuient sur
            le sens d'écoulement renseigné dans la BD TOPO® de l'IGN. L'échelle de chaque donnée est annoncée : une donnée communale ne
            décrit pas une parcelle, un modèle à 11 km de maille ne décrit pas une rue.
          </p>
          <p>
            Une donnée absente n'est pas une donnée rassurante : chaque rubrique liste explicitement ce qu'elle ne couvre pas et pourquoi.
            Cette plateforme donne une lecture documentaire à distance — elle ne remplace ni une visite de site, ni une étude réglementaire.
          </p>
        </div>
      </section>
    </>
  )
}
