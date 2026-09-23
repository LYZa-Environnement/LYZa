import { Link } from 'react-router-dom'

const SOURCES = [
  { label: 'Géorisques — Bureau de recherches géologiques et minières', href: 'https://www.georisques.gouv.fr/' },
  { label: "Hub'Eau", href: 'https://hubeau.eaufrance.fr/' },
  { label: 'Géoplateforme de l’Institut national de l’information géographique et forestière', href: 'https://geoservices.ign.fr/' },
  { label: 'Inventaire national du patrimoine naturel — Muséum national d’histoire naturelle', href: 'https://inpn.mnhn.fr/' },
  { label: 'VigiEau', href: 'https://vigieau.gouv.fr/' },
  { label: 'Copernicus / CAMS', href: 'https://atmosphere.copernicus.eu/' },
]

export default function Footer() {
  return (
    <footer style={{ borderTop: 'var(--border-w) solid var(--color-border)', marginTop: '3rem', background: 'var(--color-accent-deep)', color: 'var(--color-accent-ink)' }}>
      <div className="container grid grid--3" style={{ padding: '2.5rem 1.5rem', gap: '2rem' }}>
        <div>
          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>LYZa</strong>
          <p style={{ color: '#cfe0d8', marginTop: '0.5rem' }}>
            Plateforme de consultation des données environnementales publiques, à l'échelle d'une adresse.
          </p>
        </div>
        <div>
          <strong>Principales sources</strong>
          <p style={{ color: '#cfe0d8', marginTop: '0.5rem', fontSize: '0.88rem' }}>
            {SOURCES.map((source, index) => (
              <span key={source.href}>
                <a href={source.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-ink)' }}>
                  {source.label}
                </a>
                {index < SOURCES.length - 1 && ' · '}
              </span>
            ))}
          </p>
        </div>
        <div>
          <strong>Navigation</strong>
          <p style={{ marginTop: '0.5rem' }}>
            <Link to="/" style={{ color: 'var(--color-accent-ink)' }}>
              Consulter une adresse
            </Link>
            <br />
            <a href={`${import.meta.env.BASE_URL}lyza-cartes.html`} style={{ color: 'var(--color-accent-ink)' }}>
              LYZa Cartes
            </a>
            <br />
            <Link to="/sources" style={{ color: 'var(--color-accent-ink)' }}>
              Méthode &amp; sources
            </Link>
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingBottom: '1.5rem', fontSize: '0.8rem', color: '#a9c2b6' }}>
        © {new Date().getFullYear()} LYZa. Les données restituées appartiennent à leurs producteurs respectifs. Cette
        plateforme fournit une lecture documentaire et ne remplace ni une étude réglementaire, ni un avis d'expert.
      </div>
    </footer>
  )
}
