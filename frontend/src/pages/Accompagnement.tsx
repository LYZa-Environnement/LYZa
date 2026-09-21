import { Link } from 'react-router-dom'
import { approachSteps, principles } from '../content/approach'
import { sectors } from '../content/sectors'
import { services } from '../content/services'

export default function Accompagnement() {
  return (
    <>
      <div className="section">
        <div className="container" style={{ maxWidth: '46rem' }}>
          <p className="eyebrow">Accompagnement</p>
          <h1>Comprendre avant de recommander</h1>
          <p className="lede">
            LYZa est avant tout conçu comme un outil d'aide à la décision en libre accès — « Évaluer un site »
            et LYZa Cartes. Certaines situations nécessitent toutefois un accompagnement plus approfondi : voici
            comment je travaille, pour qui, et sous quelles formes cet accompagnement peut prendre corps, si
            besoin.
          </p>
        </div>
      </div>

      <div className="section section--muted">
        <div className="container" style={{ maxWidth: '46rem' }}>
          <h2>Comment je travaille</h2>
          <p>
            Les problématiques environnementales sont rarement uniquement techniques. Derrière une étude de
            pollution, un projet d'aménagement, une problématique liée à l'eau ou une question réglementaire, se
            cachent souvent des enjeux multiples : financiers, opérationnels, fonciers, juridiques ou encore
            politiques.
          </p>
          <p>
            C'est pourquoi une bonne expertise ne consiste pas uniquement à produire ou analyser des données.
            Elle doit avant tout permettre de comprendre une situation dans son ensemble afin de prendre une
            décision adaptée.
          </p>
          <p className="quote">Une bonne décision environnementale est avant tout une décision éclairée.</p>

          <div style={{ marginTop: '2.5rem', display: 'grid', gap: '2rem' }}>
            {approachSteps.map((step) => (
              <div key={step.numero} style={{ display: 'flex', gap: '1.25rem' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.5rem',
                    color: 'var(--color-accent)',
                    minWidth: '2.5rem',
                  }}
                >
                  {String(step.numero).padStart(2, '0')}
                </span>
                <div>
                  <h3>{step.titre}</h3>
                  {step.texte.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: '3rem' }}>Quatre principes</h3>
          <div className="grid grid--2">
            {principles.map((principle) => (
              <div key={principle.titre}>
                <h4>{principle.titre}</h4>
                <p>{principle.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <p className="eyebrow">Pour qui</p>
          <h2>Secteurs d'intervention</h2>
          <div className="grid grid--2" style={{ marginTop: '2rem' }}>
            {sectors.map((sector) => (
              <div className="card" key={sector.titre}>
                <h3>{sector.titre}</h3>
                <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>{sector.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section section--muted">
        <div className="container">
          <p className="eyebrow">Sous quelle forme, si besoin</p>
          <h2>Neuf formes d'intervention, une même logique</h2>
          <p className="lede">
            Chaque mission est construite sur mesure. Ces neuf prestations décrivent les formes d'intervention
            les plus fréquentes, du conseil stratégique aux investigations de terrain ponctuelles.
          </p>
          <div className="grid grid--3" style={{ marginTop: '2rem' }}>
            {services.map((service) => (
              <Link
                key={service.slug}
                to={`/accompagnement/${service.slug}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <span className="eyebrow">{String(service.numero).padStart(2, '0')}</span>
                <h3 style={{ marginBottom: '0.4rem' }}>{service.titre}</h3>
                <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>{service.accroche}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="container" style={{ maxWidth: '46rem' }}>
          <h2>Ce que mes clients peuvent attendre</h2>
          <p>En travaillant avec moi, vous ne recevez pas simplement un avis technique. Vous bénéficiez :</p>
          <ul>
            <li>D'un regard indépendant</li>
            <li>D'une expertise en environnement et hydrogéologie</li>
            <li>D'un interlocuteur unique</li>
            <li>D'une analyse objective des enjeux</li>
            <li>D'un accompagnement orienté vers la décision</li>
          </ul>
          <p>
            Mon objectif n'est pas de produire davantage de documents. Mon objectif est de vous aider à
            comprendre votre situation, sécuriser vos choix et prendre vos décisions avec confiance.
          </p>
          <p style={{ marginTop: '2rem' }}>
            <Link to="/contact" className="btn">
              Décrire votre situation
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
