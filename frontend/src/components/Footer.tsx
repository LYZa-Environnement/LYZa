import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{ borderTop: 'var(--border-w) solid var(--color-border)', marginTop: '3rem', background: 'var(--color-accent-deep)', color: 'var(--color-accent-ink)' }}>
      <div className="container grid grid--3" style={{ padding: '2.5rem 1.5rem', gap: '2rem' }}>
        <div>
          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>LYZa</strong>
          <p style={{ color: '#cfe0d8', marginTop: '0.5rem' }}>
            Conseil stratégique en environnement, hydrogéologie et maîtrise des risques environnementaux.
          </p>
        </div>
        <div>
          <strong>Contact</strong>
          <p style={{ color: '#cfe0d8', marginTop: '0.5rem' }}>
            06 73 91 88 43
            <br />
            <a href="mailto:loyec@protonmail.com" style={{ color: 'var(--color-accent-ink)' }}>
              loyec@protonmail.com
            </a>
          </p>
        </div>
        <div>
          <strong>Navigation</strong>
          <p style={{ marginTop: '0.5rem' }}>
            <Link to="/prestations" style={{ color: 'var(--color-accent-ink)' }}>
              Prestations
            </Link>
            <br />
            <Link to="/carte" style={{ color: 'var(--color-accent-ink)' }}>
              Évaluer un site
            </Link>
            <br />
            <Link to="/contact" style={{ color: 'var(--color-accent-ink)' }}>
              Contact
            </Link>
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingBottom: '1.5rem', fontSize: '0.8rem', color: '#a9c2b6' }}>
        © {new Date().getFullYear()} LYZa — Léo Yecora-Zorzano, entrepreneur individuel.
      </div>
    </footer>
  )
}
