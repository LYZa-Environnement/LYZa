import { useEffect, useState } from 'react'
import { fetchVeille, type Veille as VeilleData } from '../lib/veille'

function dateCourte(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function Veille({ limite = 9 }: { limite?: number }) {
  const [veille, setVeille] = useState<VeilleData | null>(null)

  useEffect(() => {
    let annule = false
    fetchVeille().then((resultat) => {
      if (!annule) setVeille(resultat)
    })
    return () => {
      annule = true
    }
  }, [])

  if (!veille || veille.articles.length === 0) return null

  const collecte = dateCourte(veille.collecteLe)
  const sources = [...new Set(veille.articles.map((article) => article.source))]

  return (
    <section className="section section--muted">
      <div className="container">
        <p className="eyebrow">Veille environnementale</p>
        <h2 style={{ marginBottom: '0.3rem' }}>Ce qui bouge en ce moment</h2>
        <p className="lede" style={{ marginBottom: '1.75rem' }}>
          Réglementation, données publiques, état de l'environnement : les dernières publications de {sources.length} sources de référence
          {collecte ? `, relevées le ${collecte}` : ''}.
        </p>

        <div className="grid grid--3">
          {veille.articles.slice(0, limite).map((article) => (
            <a
              key={article.lien}
              href={article.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-accent)' }}>
                {article.source}
                {dateCourte(article.date) ? ` · ${dateCourte(article.date)}` : ''}
              </span>
              <strong style={{ fontSize: '0.98rem', lineHeight: 1.3 }}>{article.titre}</strong>
              {article.resume && <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{article.resume}</span>}
            </a>
          ))}
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '1.25rem' }}>
          Les articles restent la propriété de leurs éditeurs ; les liens renvoient vers les publications d'origine. La veille est
          rafraîchie chaque jour, elle n'est pas en temps réel.
        </p>
      </div>
    </section>
  )
}
