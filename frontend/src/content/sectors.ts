export interface Sector {
  titre: string
  description: string
}

export const sectors: Sector[] = [
  {
    titre: 'Entreprises et industriels',
    description:
      "PME, ETI et sites industriels confrontés à des obligations réglementaires, une problématique de sols ou d'eaux souterraines, ou un projet d'acquisition ou de cession.",
  },
  {
    titre: 'Collectivités territoriales',
    description:
      'Communes, intercommunalités, syndicats et établissements publics : gestion foncière, protection de la ressource en eau, adaptation au changement climatique, accompagnement de projets sensibles.',
  },
  {
    titre: 'Administrations',
    description:
      "Services de l'État et établissements publics ayant besoin d'un avis technique indépendant sur un dossier environnemental ou hydrogéologique.",
  },
  {
    titre: 'Professions du droit et du conseil',
    description:
      'Avocats, experts judiciaires ou amiables, assureurs et experts fonciers ayant besoin de traduire une composante technique en éléments exploitables pour un dossier.',
  },
]
