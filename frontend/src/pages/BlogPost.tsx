import { Link, Navigate, useParams } from 'react-router-dom'
import { posts } from '../content/blog'

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = posts.find((p) => p.slug === slug)

  if (!post) {
    return <Navigate to="/actualites" replace />
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '46rem' }}>
        <p className="eyebrow">{formatDate(post.date)}</p>
        <h1>{post.title}</h1>
        <p className="lede">{post.summary}</p>

        {post.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}

        <p>
          Source : <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">{post.sourceLabel}</a>
        </p>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '1.5rem 0' }}>
          {post.tags.map((tag) => (
            <span key={tag} className="badge badge--indeterminee">
              {tag}
            </span>
          ))}
        </div>

        <Link to="/actualites" className="btn btn--ghost">
          ← Toutes les actualités
        </Link>
      </div>
    </div>
  )
}
