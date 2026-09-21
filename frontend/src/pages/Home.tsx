import { Link } from 'react-router-dom'
import { posts } from '../content/blog'

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const THEMES = ['Eau souterraine', 'Sites & sols pollués', 'Risques naturels', 'ICPE & activités industrielles']
const lyzaCartesUrl = `${import.meta.env.BASE_URL}lyza-cartes.html`

export default function Home() {
  const latestPosts = [...posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)

  return (
    <>
      <section className="section">
        <div className="container">
          <p className="eyebrow">LYZa — plateforme d'évaluation environnementale</p>
          <h1 style={{ maxWidth: '42rem' }}>
            Évaluer la vulnérabilité d'un site face à son environnement, à partir des données publiques.
          </h1>
          <p className="lede">
            Risques naturels et technologiques, sites et sols pollués, eau souterraine et superficielle : LYZa
            croise en direct les bases de données publiques (Géorisques, Hub'Eau, BRGM, IGN, VigiEau...) et les
            présente sur des cartes, gratuitement et sans compte, pour une première lecture avant toute décision.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <Link to="/carte" className="btn">
              Évaluer la vulnérabilité d'un site
            </Link>
            <a href={lyzaCartesUrl} className="btn btn--ghost">
              Explorer LYZa Cartes
            </a>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '2.5rem' }}>
            {THEMES.map((theme) => (
              <span key={theme} className="badge badge--indeterminee">
                {theme}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <p className="eyebrow">Outils gratuits</p>
          <h2>Trois outils en libre accès, sans compte</h2>
          <p className="lede">
            Chaque outil présente ses résultats sur une carte en priorité — la donnée brute vient en complément,
            pas l'inverse.
          </p>
          <div className="grid grid--3" style={{ marginTop: '2rem' }}>
            <div className="card">
              <h3>Évaluer un site</h3>
              <p style={{ color: 'var(--color-muted)' }}>
                Entrez une adresse : une lecture en deux temps — les risques qui s'appliquent au site (naturels,
                industriels), puis l'impact qu'une activité sur ce site pourrait avoir sur son environnement.
              </p>
              <div style={{ display: 'grid', gap: '0.6rem', margin: '1rem 0' }}>
                <span className="badge badge--faible">Risques naturels — Faible</span>
                <span className="badge badge--moderee">Risques industriels — Modérée</span>
              </div>
              <Link to="/carte" className="btn">
                Ouvrir la carte
              </Link>
            </div>
            <div className="card">
              <h3>LYZa Cartes</h3>
              <p style={{ color: 'var(--color-muted)' }}>
                L'explorateur cartographique complet : ICPE et leurs émissions déclarées, sites et sols pollués,
                BSS, nappes et eau potable, espaces protégés, cadastre, photos aériennes historiques et bien plus —
                à parcourir librement.
              </p>
              <a href={lyzaCartesUrl} className="btn" style={{ marginTop: '0.5rem' }}>
                Explorer LYZa Cartes
              </a>
            </div>
            <div className="card">
              <h3>Eau quantitative</h3>
              <p style={{ color: 'var(--color-muted)' }}>
                Pour les collectivités : état des ressources en eau (souterraine et superficielle), arrêtés de
                restriction en vigueur, et exemples concrets pour réduire les consommations sur un territoire.
              </p>
              <Link to="/eau-quantitative" className="btn" style={{ marginTop: '0.5rem' }}>
                Ouvrir l'outil
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '0.75rem',
            }}
          >
            <div>
              <p className="eyebrow">Actualités</p>
              <h2 style={{ marginBottom: 0 }}>Veille réglementaire et environnementale</h2>
            </div>
            <Link to="/actualites">Toutes les actualités →</Link>
          </div>
          <p className="lede" style={{ marginBottom: '1.5rem' }}>
            Eau, sols pollués, risques naturels et industriels, zones protégées : une note ajoutée dès qu'une
            actualité réglementaire ou technique pertinente est identifiée, en général chaque jour.
          </p>

          {latestPosts.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>Aucune actualité pour le moment.</p>
          ) : (
            <div className="grid grid--3">
              {latestPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/actualites/${post.slug}`}
                  className="card"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                    {formatDate(post.date)}
                  </p>
                  <h3 style={{ marginBottom: '0.4rem', fontSize: '1.1rem' }}>{post.title}</h3>
                  <p style={{ color: 'var(--color-muted)', marginBottom: 0, fontSize: '0.92rem' }}>{post.summary}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section--muted" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>
            Un accompagnement plus poussé reste possible au-delà des outils en libre accès, si une situation le
            justifie.
          </p>
          <Link to="/accompagnement">En savoir plus sur l'accompagnement →</Link>
        </div>
      </section>
    </>
  )
}
