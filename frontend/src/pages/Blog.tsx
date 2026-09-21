import { Link } from 'react-router-dom'
import { posts } from '../content/blog'

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Blog() {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Actualités</p>
        <h1>Veille réglementaire et environnementale</h1>
        <p className="lede">
          Une sélection de textes, décisions et données publiques qui touchent directement les sujets suivis par
          LYZa — eau, sols, risques, zones protégées. Chaque note renvoie vers sa source primaire.
        </p>

        {sorted.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', marginTop: '2rem' }}>Aucune actualité pour le moment.</p>
        ) : (
          <div className="grid grid--2" style={{ marginTop: '2rem' }}>
            {sorted.map((post) => (
              <Link
                key={post.slug}
                to={`/actualites/${post.slug}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                  {formatDate(post.date)}
                </p>
                <h3 style={{ marginBottom: '0.4rem' }}>{post.title}</h3>
                <p style={{ color: 'var(--color-muted)', marginBottom: '0.8rem' }}>{post.summary}</p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {post.tags.map((tag) => (
                    <span key={tag} className="badge badge--indeterminee">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
