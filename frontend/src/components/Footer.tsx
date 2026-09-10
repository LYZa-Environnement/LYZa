import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--color-border)', marginTop: '3rem' }}>
      <div className="container" style={{ padding: '2.5rem 1.5rem', display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div>
          <strong style={{ fontFamily: 'var(--font-heading)' }}>LYZa</strong>
          <p style={{ color: 'var(--color-muted)', marginTop: '0.5rem' }}>
            Conseil stratégique en environnement, hydrogéologie et maîtrise des risques environnementaux.
          </p>
        </div>
        <div>
          <strong>Contact</strong>
          <p style={{ color: 'var(--color-muted)', marginTop: '0.5rem' }}>
            06 73 91 88 43
            <br />
            <a href="mailto:loyec@protonmail.com">loyec@protonmail.com</a>
          </p>
        </div>
        <div>
          <strong>Navigation</strong>
          <p style={{ marginTop: '0.5rem' }}>
            <Link to="/prestations">Prestations</Link>
            <br />
            <Link to="/carte">Évaluer un site</Link>
            <br />
            <Link to="/contact">Contact</Link>
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
        © {new Date().getFullYear()} LYZa — Léo Yecora-Zorzano, entrepreneur individuel.
      </div>
    </footer>
  )
}
