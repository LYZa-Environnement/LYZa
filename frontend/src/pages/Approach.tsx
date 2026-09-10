import { approachSteps, principles } from '../content/approach'

export default function Approach() {
  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '46rem' }}>
        <p className="eyebrow">Démarche</p>
        <h1>Comprendre avant de recommander</h1>
        <p>
          Les problématiques environnementales sont rarement uniquement techniques. Derrière une étude de
          pollution, un projet d'aménagement, une problématique liée à l'eau ou une question réglementaire, se
          cachent souvent des enjeux multiples : financiers, opérationnels, fonciers, juridiques ou encore
          politiques.
        </p>
        <p>
          C'est pourquoi une bonne expertise ne consiste pas uniquement à produire ou analyser des données. Elle
          doit avant tout permettre de comprendre une situation dans son ensemble afin de prendre une décision
          adaptée.
        </p>
        <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
          Une bonne décision environnementale est avant tout une décision éclairée.
        </p>

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

        <h2 style={{ marginTop: '3rem' }}>Une approche fondée sur quatre principes</h2>
        <div className="grid grid--2">
          {principles.map((principle) => (
            <div key={principle.titre}>
              <h3>{principle.titre}</h3>
              <p>{principle.texte}</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: '3rem' }}>Ce que mes clients peuvent attendre</h2>
        <p>En travaillant avec moi, vous ne recevez pas simplement un avis technique. Vous bénéficiez :</p>
        <ul>
          <li>D'un regard indépendant</li>
          <li>D'une expertise en environnement et hydrogéologie</li>
          <li>D'un interlocuteur unique</li>
          <li>D'une analyse objective des enjeux</li>
          <li>D'un accompagnement orienté vers la décision</li>
        </ul>
        <p>
          Mon objectif n'est pas de produire davantage de documents. Mon objectif est de vous aider à comprendre
          votre situation, sécuriser vos choix et prendre vos décisions avec confiance.
        </p>
      </div>
    </div>
  )
}
