import { Link } from 'react-router-dom'
import { sectors } from '../content/sectors'

export default function Sectors() {
  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Secteurs d'intervention</p>
        <h1>À qui s'adresse cet accompagnement</h1>

        <div className="grid grid--2" style={{ marginTop: '2rem' }}>
          {sectors.map((sector) => (
            <div className="card" key={sector.titre}>
              <h3>{sector.titre}</h3>
              <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>{sector.description}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: '2rem' }}>
          <Link to="/contact" className="btn">
            Décrire votre situation
          </Link>
        </p>
      </div>
    </div>
  )
}
