import { RUBRIQUES } from '../themes'

const PRINCIPES = [
  {
    titre: 'Tout est interrogé en direct',
    texte:
      "Aucune donnée n'est stockée ni mise en cache par la plateforme. Chaque rubrique appelle les API publiques au moment où vous la consultez, depuis votre navigateur : ce que vous lisez est l'état des bases à cet instant.",
  },
  {
    titre: 'Une distance et une direction, jamais l’une sans l’autre',
    texte:
      "Tout élément signalé est situé par rapport au point géocodé de l'adresse. Lorsque le sens d'écoulement du cours d'eau est renseigné dans la BD TOPO® de l'IGN, la position amont ou aval est précisée — sinon elle est omise plutôt que devinée.",
  },
  {
    titre: 'Les manques sont affichés',
    texte:
      "Chaque rubrique se termine par ce qu'elle ne couvre pas, et pourquoi. Une donnée absente des bases publiques n'est pas une donnée rassurante : c'est une question ouverte, et elle est présentée comme telle.",
  },
  {
    titre: 'Une échelle est annoncée',
    texte:
      "Une donnée communale ne décrit pas une parcelle, un modèle à 11 km de maille ne décrit pas une rue, et une carte pédologique au 1/250 000 ne décrit pas un terrain. Chaque lecture indique l'échelle à laquelle elle vaut.",
  },
]

export default function Sources() {
  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Méthode</p>
        <h1>D'où viennent ces données</h1>
        <p className="lede">
          LYZa ne produit aucune donnée : la plateforme interroge des bases publiques françaises et européennes, les situe par
          rapport à l'adresse demandée, et les restitue avec leurs limites.
        </p>

        <div className="grid grid--2" style={{ marginTop: '2rem' }}>
          {PRINCIPES.map((principe) => (
            <div key={principe.titre} className="card">
              <h3 style={{ fontSize: '1.1rem' }}>{principe.titre}</h3>
              <p style={{ margin: 0, fontSize: '0.92rem' }}>{principe.texte}</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: '3rem' }}>Les six rubriques</h2>
        <div className="grid grid--2">
          {RUBRIQUES.map((rubrique, index) => (
            <div key={rubrique.id} className="card">
              <p className="eyebrow">Rubrique {index + 1}</p>
              <h3 style={{ fontSize: '1.1rem' }}>{rubrique.titre}</h3>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--color-muted)' }}>{rubrique.sousTitre}</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: '3rem' }}>Portée et limites</h2>
        <p style={{ maxWidth: '46rem' }}>
          Cette plateforme donne une lecture documentaire à distance. Elle ne constitue ni un diagnostic, ni une étude
          réglementaire, ni un avis d'expert : elle rassemble ce que les bases publiques disent d'un lieu, pour permettre de
          poser les bonnes questions. Un enjeu identifié ici appelle une vérification de terrain ; une absence de signal
          n'en dispense pas.
        </p>
      </div>
    </div>
  )
}
