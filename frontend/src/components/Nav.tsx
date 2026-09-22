import { NavLink } from 'react-router-dom'
import logo from '../assets/lyza-logo.png'

const links = [
  { to: '/', label: 'Consulter une adresse', end: true },
  { to: `${import.meta.env.BASE_URL}lyza-cartes.html`, label: 'LYZa Cartes', external: true },
  { to: '/sources', label: 'Méthode & sources' },
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
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
          {links.map((link) =>
            link.external ? (
              <a key={link.to} href={link.to} style={{ ...linkStyle, fontWeight: 700, color: 'var(--color-accent)' }}>
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                style={({ isActive }) => ({ ...linkStyle, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-accent)' : 'var(--color-ink)' })}
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
