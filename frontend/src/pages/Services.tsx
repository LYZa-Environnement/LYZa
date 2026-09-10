import { Link } from 'react-router-dom'
import { services } from '../content/services'

export default function Services() {
  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Prestations</p>
        <h1>Neuf formes d'intervention, une même logique</h1>
        <p className="lede">
          Chaque mission est construite sur mesure. Ces neuf prestations décrivent les formes d'intervention les
          plus fréquentes, du conseil stratégique aux investigations de terrain ponctuelles.
        </p>

        <div className="grid grid--3" style={{ marginTop: '2rem' }}>
          {services.map((service) => (
            <Link
              key={service.slug}
              to={`/prestations/${service.slug}`}
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
  )
}
