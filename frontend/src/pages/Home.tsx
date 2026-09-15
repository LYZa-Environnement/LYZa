import { Link } from 'react-router-dom'
import MapMotif from '../components/MapMotif'
import { services } from '../content/services'

export default function Home() {
  const highlighted = services.filter((s) => ['conseil-strategique', 'hydrogeologie', 'due-diligence'].includes(s.slug))

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="grid grid--2" style={{ alignItems: 'center' }}>
            <div>
              <p className="eyebrow">LYZa — Léo Yecora-Zorzano</p>
              <h1>Conseil stratégique en environnement, hydrogéologie et maîtrise des risques environnementaux.</h1>
              <p className="lede">
                J'accompagne les entreprises, collectivités et administrations dans leurs réflexions et leurs
                décisions relatives aux enjeux environnementaux, à la protection des ressources en eau et à la
                gestion des risques.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                <Link to="/carte" className="btn">
                  Évaluer la sensibilité d'un site
                </Link>
                <Link to="/prestations" className="btn btn--ghost">
                  Voir les prestations
                </Link>
              </div>
            </div>
            <MapMotif style={{ width: '100%', maxWidth: '22rem', margin: '0 auto', display: 'block' }} />
          </div>
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <div className="grid grid--2" style={{ alignItems: 'start' }}>
            <div>
              <h2>Une expertise, pas un guichet d'études</h2>
              <p>
                La plupart des acteurs du secteur produisent des études, réalisent des mesures ou interviennent
                sur le terrain. Ces prestations sont souvent indispensables, mais elles ne répondent pas toujours
                à la question principale que se pose un dirigeant, un élu ou un responsable de projet :
              </p>
              <p className="quote">« Que signifie réellement cette situation et quelle décision devons-nous prendre ? »</p>
            </div>
            <div>
              <p>
                Mon rôle consiste avant tout à apporter un regard indépendant et une capacité d'analyse permettant
                de transformer une information technique parfois complexe en éléments de décision clairs et
                exploitables. J'interviens comme un partenaire de confiance capable d'aider à comprendre les
                enjeux, évaluer les risques et orienter les choix stratégiques.
              </p>
              <Link to="/presentation">En savoir plus sur la démarche →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Outil</p>
          <div className="grid grid--2" style={{ alignItems: 'center' }}>
            <div>
              <h2>Une première lecture de la sensibilité environnementale d'un site</h2>
              <p>
                Entrez une adresse : elle est positionnée sur une carte simplifiée, et une lecture en deux temps
                est construite à partir des bases de données publiques disponibles à proximité — les risques qui
                s'appliquent au site (naturels, industriels), puis l'impact qu'une activité sur ce site pourrait
                avoir sur son environnement.
              </p>
              <p style={{ color: 'var(--color-muted)' }}>
                Cette synthèse est un point de départ, pas un diagnostic : elle permet d'identifier s'il est
                pertinent d'aller plus loin, et sur quel sujet.
              </p>
              <Link to="/carte" className="btn" style={{ marginTop: '0.5rem' }}>
                Ouvrir la carte
              </Link>
            </div>
            <div className="card" aria-hidden="true">
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <span className="badge badge--faible">Risques naturels — Faible</span>
                <span className="badge badge--moderee">Risques industriels — Modérée</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <p className="eyebrow">Prestations</p>
          <h2>Quelques exemples de missions</h2>
          <div className="grid grid--3">
            {highlighted.map((service) => (
              <div className="card" key={service.slug}>
                <h3>{service.titre}</h3>
                <p style={{ color: 'var(--color-muted)' }}>{service.accroche}</p>
                <Link to={`/prestations/${service.slug}`}>Voir le détail →</Link>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '1.5rem' }}>
            <Link to="/prestations">Voir les neuf prestations →</Link>
          </p>
        </div>
      </section>
    </>
  )
}
