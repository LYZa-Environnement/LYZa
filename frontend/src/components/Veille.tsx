import { useEffect, useMemo, useState } from 'react'
import { fetchVeille, type ArticleVeille, type Veille as VeilleData } from '../lib/veille'

function dateCourte(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

/** One sentence per angle, so the tabs say what they cover rather than making
 * the reader click through four of them to find out. */
const INTENTIONS: Record<string, string> = {
  science: 'Travaux de recherche et publications sur l’état de l’environnement.',
  politique: 'Réglementation, décisions publiques et données officielles françaises.',
  international: 'Europe, Nations unies et ce qui se décide ou s’observe hors de France.',
  innovation: 'Procédés, technologies et projets qui cherchent à changer la donne.',
}

function Onglet({ actif, libelle, nombre, onClick }: { actif: boolean; libelle: string; nombre: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      style={{
        padding: '0.35rem 0.9rem',
        borderRadius: '999px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 700,
        border: '1.5px solid var(--color-border)',
        background: actif ? 'var(--color-accent)' : 'var(--color-surface)',
        color: actif ? 'var(--color-accent-ink)' : 'var(--color-ink)',
      }}
    >
      {libelle} <span style={{ opacity: 0.7, fontWeight: 500 }}>({nombre})</span>
    </button>
  )
}

function Carte({ article }: { article: ArticleVeille }) {
  const date = dateCourte(article.date)
  return (
    <a
      href={article.lien}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-accent)' }}>
        {article.source}
        {date ? ` · ${date}` : ''}
        {article.langue === 'en' ? ' · en anglais' : ''}
      </span>
      <strong style={{ fontSize: '0.98rem', lineHeight: 1.3 }}>{article.titre}</strong>
      {article.resume && <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{article.resume}</span>}
    </a>
  )
}

export default function Veille({ limite = 12 }: { limite?: number }) {
  const [veille, setVeille] = useState<VeilleData | null>(null)
  const [categorie, setCategorie] = useState<string>('toutes')

  useEffect(() => {
    let annule = false
    fetchVeille().then((resultat) => {
      if (!annule) setVeille(resultat)
    })
    return () => {
      annule = true
    }
  }, [])

  // Only the angles that actually have articles today get a tab: a tab that
  // opens on nothing is worse than no tab at all.
  const onglets = useMemo(() => {
    if (!veille) return []
    return Object.entries(veille.categories ?? {})
      .map(([cle, libelle]) => ({ cle, libelle, nombre: veille.articles.filter((article) => article.categorie === cle).length }))
      .filter((onglet) => onglet.nombre > 0)
  }, [veille])

  if (!veille || veille.articles.length === 0) return null

  const collecte = dateCourte(veille.collecteLe)
  const sources = [...new Set(veille.articles.map((article) => article.source))]
  const affiches = (categorie === 'toutes' ? veille.articles : veille.articles.filter((article) => article.categorie === categorie)).slice(0, limite)

  return (
    <section className="section section--muted">
      <div className="container">
        <p className="eyebrow">Veille environnementale</p>
        <h2 style={{ marginBottom: '0.3rem' }}>Ce qui bouge en ce moment</h2>
        <p className="lede" style={{ marginBottom: '1.25rem' }}>
          Les dernières publications de {sources.length} sources de référence{collecte ? `, relevées le ${collecte}` : ''}, rangées en quatre
          angles de lecture.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Onglet actif={categorie === 'toutes'} libelle="Tout" nombre={veille.articles.length} onClick={() => setCategorie('toutes')} />
          {onglets.map((onglet) => (
            <Onglet
              key={onglet.cle}
              actif={categorie === onglet.cle}
              libelle={onglet.libelle}
              nombre={onglet.nombre}
              onClick={() => setCategorie(onglet.cle)}
            />
          ))}
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1.5rem', minHeight: '1.3em' }}>
          {categorie === 'toutes' ? 'Tous les angles confondus, du plus récent au plus ancien.' : (INTENTIONS[categorie] ?? '')}
        </p>

        <div className="grid grid--3">
          {affiches.map((article) => (
            <Carte key={article.lien} article={article} />
          ))}
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '1.25rem' }}>
          Le classement par angle est automatique, à partir des mots employés dans le titre et le chapeau : il oriente la lecture, il ne
          qualifie pas l’article. Les articles restent la propriété de leurs éditeurs ; les liens renvoient vers les publications d’origine.
          La veille est rafraîchie chaque jour, elle n’est pas en temps réel.
        </p>
      </div>
    </section>
  )
}
