import { NavLink } from 'react-router-dom'
import logo from '../assets/lyza-logo.png'

const pages = [
  { to: '/', label: 'Étudier un site', end: true },
  { to: '/sources', label: 'Méthode & sources' },
]

// The two map tools are separate pages, not routes: they get buttons rather
// than nav links, because that is how they are reached — one click from the
// top of the home page, whatever you were doing.
const outils = [
  { href: `${import.meta.env.BASE_URL}lyza-cartes.html`, label: 'LYZa Cartes', titre: 'Carte interactive des données publiques' },
  { href: `${import.meta.env.BASE_URL}lyza-maillage.html`, label: 'LYZa Maillage', titre: "Maillage d'investigation sur parcelles" },
]

const linkStyle = { textDecoration: 'none', fontSize: '0.92rem' } as const

export default function Nav() {
  return (
    <header style={{ borderBottom: 'var(--border-w) solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '4.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'var(--color-ink)' }}>
          <img src={logo} alt="LYZa" style={{ display: 'block', height: '2.6rem', width: 'auto' }} />
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.04em', marginTop: '0.2rem' }}>
            Consultation de données environnementales
          </span>
        </NavLink>
        <nav style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {pages.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              end={page.end}
              style={({ isActive }) => ({ ...linkStyle, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-accent)' : 'var(--color-ink)' })}
            >
              {page.label}
            </NavLink>
          ))}
          {outils.map((outil) => (
            <a key={outil.href} href={outil.href} className="btn btn--petit" title={outil.titre}>
              {outil.label} ↗
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
