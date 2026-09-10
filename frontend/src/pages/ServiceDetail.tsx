import { Link, Navigate, useParams } from 'react-router-dom'
import { services } from '../content/services'

export default function ServiceDetail() {
  const { slug } = useParams()
  const service = services.find((s) => s.slug === slug)

  if (!service) {
    return <Navigate to="/prestations" replace />
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '46rem' }}>
        <p className="eyebrow">
          Prestation {String(service.numero).padStart(2, '0')} / {services.length}
        </p>
        <h1>{service.titre}</h1>
        <p className="lede">{service.accroche}</p>
        <p>{service.intro}</p>

        {service.points.map((group) => (
          <div key={group.titre}>
            <h3>{group.titre}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}

        {service.public && (
          <div>
            <h3>Pour qui ?</h3>
            <ul>
              {service.public.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link to="/contact" className="btn">
            Échanger sur un besoin
          </Link>
          <Link to="/prestations" className="btn btn--ghost">
            ← Toutes les prestations
          </Link>
        </div>
      </div>
    </div>
  )
}
