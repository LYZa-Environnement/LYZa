export interface ApproachStep {
  numero: number
  titre: string
  texte: string[]
}

export const approachSteps: ApproachStep[] = [
  {
    numero: 1,
    titre: 'Écouter et comprendre le contexte',
    texte: [
      "Avant de parler technique, je cherche à comprendre les objectifs du client. Selon les situations, les enjeux peuvent être très différents : sécuriser un investissement, réduire un risque, répondre à une obligation réglementaire, préparer un projet d'aménagement, protéger une ressource en eau, anticiper une difficulté future, défendre un dossier auprès d'une administration.",
      "La même problématique environnementale peut nécessiter des réponses très différentes selon le contexte. Cette phase d'échange est essentielle pour identifier les véritables besoins et éviter les démarches inutiles.",
    ],
  },
  {
    numero: 2,
    titre: 'Analyser les informations disponibles',
    texte: [
      "Dans de nombreux dossiers, les informations existent déjà : rapports d'études, analyses de laboratoire, documents réglementaires, études historiques, avis administratifs, données environnementales. Mon premier réflexe est toujours d'exploiter et de valoriser ce qui est déjà disponible.",
      "L'objectif n'est pas de produire davantage de données mais de donner du sens aux données existantes.",
    ],
  },
  {
    numero: 3,
    titre: 'Identifier les enjeux et les risques réels',
    texte: [
      "Toutes les anomalies ou toutes les non-conformités n'ont pas le même niveau d'importance. Une partie importante de mon travail consiste à distinguer les risques avérés, les incertitudes, les hypothèses, les points qui nécessitent une vigilance particulière et les éléments ayant peu d'impact sur la décision finale.",
      "Cette étape permet de hiérarchiser les enjeux et de concentrer les efforts là où ils sont réellement utiles.",
    ],
  },
  {
    numero: 4,
    titre: 'Construire une stratégie adaptée',
    texte: [
      "Chaque dossier est unique. Il n'existe pas de solution universelle applicable à toutes les situations. En fonction des enjeux identifiés, j'accompagne mes clients dans la définition d'une stratégie adaptée à leurs objectifs et à leurs contraintes — jusqu'à, parfois, ne rien faire lorsque les risques identifiés ne le justifient pas.",
      "La meilleure décision n'est pas toujours celle qui conduit à réaliser davantage d'études. Elle est celle qui répond le plus justement au besoin du client.",
    ],
  },
  {
    numero: 5,
    titre: 'Accompagner la prise de décision',
    texte: [
      "Les décisions environnementales engagent souvent des budgets importants et peuvent avoir des conséquences à long terme. Mon rôle n'est pas de décider à la place du client, mais de lui fournir une analyse claire, indépendante et argumentée lui permettant de décider en connaissance de cause.",
      "L'objectif final est que le client comprenne précisément quels sont les risques, quelles sont les incertitudes, quelles sont les options possibles et quelles sont les conséquences de chaque décision.",
    ],
  },
]

export interface Principle {
  titre: string
  texte: string
}

export const principles: Principle[] = [
  { titre: 'Indépendance', texte: "Je porte un regard objectif sur chaque situation. Mes recommandations sont guidées par l'analyse des faits et des enjeux du dossier, et non par la vente de prestations complémentaires." },
  { titre: 'Rigueur', texte: 'Chaque avis repose sur une analyse technique documentée et sur une compréhension approfondie du contexte réglementaire et environnemental.' },
  { titre: 'Pragmatisme', texte: 'Les problématiques environnementales doivent être traitées avec sérieux, mais sans complexification inutile. Je recherche des solutions réalistes, proportionnées et adaptées au contexte.' },
  { titre: 'Pédagogie', texte: "J'accorde une importance particulière à la clarté des échanges et à la vulgarisation des enjeux afin que chaque décision puisse être prise sur la base d'une compréhension partagée de la situation." },
]
