import { type CSSProperties, type FormEvent, useState } from 'react'

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const subject = encodeURIComponent(`Contact site LYZa — ${name || 'sans nom'}`)
    const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`)
    window.location.href = `mailto:loyec@protonmail.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Contact</p>
        <h1>Décrire votre situation</h1>
        <p className="lede">
          Chaque mission est construite sur mesure : le plus simple est d'échanger directement sur votre
          contexte et vos objectifs.
        </p>

        <div className="grid grid--2" style={{ marginTop: '2rem', alignItems: 'start' }}>
          <div className="card">
            <h3>Coordonnées</h3>
            <p>
              Téléphone : <a href="tel:+33673918843">06 73 91 88 43</a>
              <br />
              E-mail : <a href="mailto:loyec@protonmail.com">loyec@protonmail.com</a>
            </p>
          </div>

          <form className="card" onSubmit={handleSubmit}>
            <h3>Formulaire de contact</h3>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <label>
                Nom
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label>
                E-mail
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>
              <button type="submit" className="btn" style={{ justifySelf: 'start' }}>
                Envoyer par e-mail
              </button>
            </div>
          </form>
        </div>

        <details style={{ marginTop: '3rem', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Mentions légales</summary>
          <div style={{ marginTop: '1rem' }}>
            <p>Nom commercial : LYZa</p>
            <p>Nom complet : Léo Yecora-Zorzano</p>
            <p>Forme juridique : entrepreneur individuel</p>
            <p>
              Contact : <a href="mailto:loyec@protonmail.com">loyec@protonmail.com</a> — 06 73 91 88 43
            </p>
            <p>Directeur de la publication : Léo Yecora</p>
          </div>
        </details>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.35rem',
  padding: '0.55rem 0.7rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  fontSize: '0.95rem',
}
