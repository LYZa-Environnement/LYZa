import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/presentation', label: 'Présentation' },
  { to: '/prestations', label: 'Prestations' },
  { to: '/carte', label: 'Évaluer un site' },
  { to: `${import.meta.env.BASE_URL}lyza-cartes.html`, label: 'LYZa Cartes', external: true },
  { to: '/secteurs', label: "Secteurs d'intervention" },
  { to: '/demarche', label: 'Démarche' },
  { to: '/contact', label: 'Contact' },
]

export default function Nav() {
  return (
    <header style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '4.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'var(--color-ink)' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 700 }}>LYZa</span>
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.04em' }}>
            Environnement &amp; hydrogéologie
          </span>
        </NavLink>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
          {links.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                style={{ textDecoration: 'none', fontSize: '0.92rem', fontWeight: 500, color: 'var(--color-ink)' }}
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
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--color-accent)' : 'var(--color-ink)',
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
