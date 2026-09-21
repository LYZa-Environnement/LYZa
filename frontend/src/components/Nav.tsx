import { NavLink } from 'react-router-dom'
import logo from '../assets/lyza-logo.png'

// Les outils gratuits (évaluation de site, LYZa Cartes, eau quantitative) et
// la veille réglementaire (actualités) sont mis en avant en premier — c'est
// le cœur de la plateforme. La partie prestation payante (« Accompagnement »)
// est volontairement reléguée en tout dernier, sans mise en avant visuelle,
// et « Présentation » n'apparaît plus du tout ici (encore accessible depuis
// le pied de page) : à la demande de l'utilisateur, le site se présente
// d'abord comme un outil d'aide à la décision en libre accès, l'accompagnement
// restant possible mais très secondaire.
const links = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/carte', label: 'Évaluer un site', highlight: true },
  { to: `${import.meta.env.BASE_URL}lyza-cartes.html`, label: 'LYZa Cartes', external: true, highlight: true },
  { to: '/eau-quantitative', label: 'Eau quantitative', highlight: true },
  { to: '/actualites', label: 'Actualités' },
  { to: '/contact', label: 'Contact' },
  { to: '/accompagnement', label: 'Accompagnement' },
]

export default function Nav() {
  return (
    <header style={{ borderBottom: 'var(--border-w) solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '4.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'var(--color-ink)' }}>
          <img src={logo} alt="LYZa" style={{ display: 'block', height: '2.6rem', width: 'auto' }} />
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.04em', marginTop: '0.2rem' }}>
            Environnement &amp; hydrogéologie
          </span>
        </NavLink>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
          {links.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                style={{
                  textDecoration: 'none',
                  fontSize: '0.92rem',
                  fontWeight: link.highlight ? 700 : 500,
                  color: link.highlight ? 'var(--color-accent)' : 'var(--color-ink)',
                }}
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  fontSize: '0.92rem',
                  fontWeight: isActive || link.highlight ? 700 : 500,
                  color: isActive || link.highlight ? 'var(--color-accent)' : 'var(--color-ink)',
                })}
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>
      </div>
    </header>
  )
}
