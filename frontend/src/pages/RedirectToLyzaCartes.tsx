import { useEffect } from 'react'

// ICPE et émissions (registre IREP) sont désormais intégrés directement aux
// cartouches ICPE de LYZa Cartes plutôt que présentés sur une page dédiée —
// cette page ne fait que rediriger les anciens liens/signets vers l'outil.
export default function RedirectToLyzaCartes() {
  const url = `${import.meta.env.BASE_URL}lyza-cartes.html`

  useEffect(() => {
    window.location.replace(url)
  }, [url])

  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Redirection</p>
        <h1>Cet outil fait maintenant partie de LYZa Cartes</h1>
        <p className="lede">
          Les installations classées (ICPE) et leurs émissions déclarées (registre IREP) s'affichent directement
          dans les cartouches de la carte, au clic sur une installation.
        </p>
        <a href={url} className="btn">
          Ouvrir LYZa Cartes →
        </a>
      </div>
    </div>
  )
}
