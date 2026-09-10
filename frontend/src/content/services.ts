export interface Service {
  slug: string
  numero: number
  titre: string
  accroche: string
  intro: string
  points: { titre: string; items: string[] }[]
  public?: string[]
}

export const services: Service[] = [
  {
    slug: 'conseil-strategique',
    numero: 1,
    titre: 'Conseil stratégique en environnement',
    accroche: 'Prendre les bonnes décisions dans des situations complexes',
    intro:
      "Les enjeux environnementaux sont aujourd'hui présents dans la plupart des projets d'aménagement, de développement industriel, d'investissement immobilier ou de gestion foncière. Face à ces enjeux, les décideurs disposent souvent d'une quantité importante d'informations techniques mais manquent parfois d'un regard indépendant leur permettant de comprendre les risques réels et leurs conséquences potentielles. J'interviens comme conseiller indépendant afin d'apporter une analyse objective, hiérarchiser les enjeux et accompagner la prise de décision.",
    points: [
      {
        titre: "Exemples d'intervention",
        items: [
          "Analyse des risques liés à un projet industriel ou immobilier",
          "Identification des enjeux environnementaux avant une acquisition",
          'Accompagnement de collectivités confrontées à des problématiques environnementales sensibles',
          'Assistance auprès de dirigeants devant arbitrer entre plusieurs scénarios techniques',
          'Avis indépendant sur une situation présentant des enjeux réglementaires ou financiers',
        ],
      },
      {
        titre: 'Livrables possibles',
        items: ['Notes stratégiques', 'Avis techniques argumentés', "Réunions d'aide à la décision", 'Présentations aux élus, directions ou instances de pilotage'],
      },
    ],
  },
  {
    slug: 'referent-environnement-externalise',
    numero: 2,
    titre: 'Référent environnement externalisé',
    accroche: 'Une expertise environnementale disponible sans recruter',
    intro:
      "De nombreuses structures ne disposent pas de spécialiste environnement en interne alors même qu'elles sont confrontées à des obligations réglementaires, des projets d'aménagement ou des problématiques foncières nécessitant une expertise spécifique. J'assure un accompagnement régulier permettant d'intégrer la dimension environnementale dans les décisions de l'organisation.",
    points: [
      {
        titre: 'Cet accompagnement peut inclure',
        items: [
          'Participation aux réunions stratégiques',
          'Analyse des dossiers techniques',
          'Appui aux échanges avec les administrations',
          "Relecture de rapports d'études",
          'Accompagnement des projets sensibles',
          'Veille sur les risques environnementaux associés aux activités',
        ],
      },
    ],
    public: ['PME et ETI', 'Collectivités territoriales', 'Syndicats et établissements publics', 'Gestionnaires de patrimoine'],
  },
  {
    slug: 'amo',
    numero: 3,
    titre: "Assistance à maîtrise d'ouvrage (AMO)",
    accroche: "Défendre les intérêts du maître d'ouvrage",
    intro:
      "Les projets impliquant des enjeux environnementaux nécessitent souvent l'intervention de plusieurs acteurs : bureaux d'études, laboratoires, administrations, entreprises de travaux ou experts spécialisés. J'assiste les maîtres d'ouvrage tout au long de leurs projets afin de leur permettre de conserver une vision claire des enjeux techniques, réglementaires et financiers.",
    points: [
      {
        titre: 'Missions possibles',
        items: [
          'Définition des besoins',
          'Rédaction de cahiers des charges',
          'Analyse des offres reçues',
          'Sélection des prestataires',
          'Suivi des études réalisées',
          'Analyse critique des conclusions',
          'Assistance lors des réunions techniques',
        ],
      },
      {
        titre: 'Objectif',
        items: ['Garantir que les décisions prises reposent sur des éléments fiables, adaptés aux enjeux réels du projet'],
      },
    ],
  },
  {
    slug: 'analyse-critique-etudes',
    numero: 4,
    titre: "Analyse critique et revue indépendante d'études",
    accroche: "Comprendre ce que dit réellement un rapport",
    intro:
      "Les études environnementales peuvent parfois représenter plusieurs centaines de pages et mobiliser un vocabulaire très spécialisé. J'accompagne mes clients dans l'analyse de ces documents afin d'identifier les conclusions réellement démontrées, les incertitudes, les hypothèses retenues, les éventuelles limites méthodologiques et les investigations complémentaires éventuellement nécessaires.",
    points: [
      {
        titre: 'Types de documents analysés',
        items: [
          'Diagnostics environnementaux',
          'Rapports hydrogéologiques',
          'Études sites et sols pollués (SSP)',
          'Études de risques',
          'Dossiers réglementaires',
          'Rapports de surveillance environnementale',
        ],
      },
    ],
    public: ['Collectivités', 'Investisseurs', 'Industriels', 'Avocats souhaitant un second regard indépendant'],
  },
  {
    slug: 'hydrogeologie',
    numero: 5,
    titre: 'Hydrogéologie et protection de la ressource en eau',
    accroche: 'Comprendre le fonctionnement des eaux souterraines et évaluer les risques associés',
    intro:
      "La gestion de la ressource en eau constitue un enjeu majeur pour les territoires et les activités économiques. Grâce à ma formation et à mon expérience en hydrogéologie, j'interviens sur les problématiques liées à la compréhension du fonctionnement des aquifères, à la vulnérabilité des ressources et aux risques de contamination.",
    points: [
      {
        titre: 'Prestations proposées',
        items: [
          'Avis hydrogéologiques',
          'Analyse de risques liés aux eaux souterraines',
          'Protection de captages',
          'Accompagnement de collectivités',
          "Interprétation d'études hydrogéologiques",
          'Analyse critique de dossiers techniques',
        ],
      },
      {
        titre: 'Situations fréquemment rencontrées',
        items: [
          "Projet à proximité d'une ressource sensible",
          'Pollution susceptible d\'impacter les eaux souterraines',
          "Questions relatives à l'implantation d'un forage",
          "Besoin d'évaluer la vulnérabilité d'un secteur",
        ],
      },
    ],
  },
  {
    slug: 'changement-climatique',
    numero: 6,
    titre: 'Adaptation au changement climatique et résilience environnementale',
    accroche: 'Anticiper les effets du climat sur les projets, les ressources et les territoires',
    intro:
      "Le changement climatique modifie progressivement les conditions dans lesquelles les projets, les activités économiques et les territoires doivent être pensés : tensions sur la ressource en eau, épisodes de sécheresse, phénomènes extrêmes, vulnérabilité des infrastructures ou évolution des usages du sol. J'accompagne les collectivités, entreprises et porteurs de projets dans l'intégration de ces évolutions à leurs réflexions stratégiques, afin d'identifier les vulnérabilités, hiérarchiser les risques et définir des réponses réalistes et proportionnées.",
    points: [
      {
        titre: 'Prestations proposées',
        items: [
          "Analyse de vulnérabilité d'un site, d'un territoire ou d'un projet face aux effets du changement climatique",
          'Prise en compte des tensions futures sur la ressource en eau',
          "Appui à l'intégration des risques climatiques dans les décisions d'aménagement ou d'investissement",
          'Accompagnement des collectivités dans leurs démarches d\'adaptation et de résilience territoriale',
          "Lecture critique d'études ou de diagnostics intégrant des scénarios climatiques",
        ],
      },
    ],
  },
  {
    slug: 'due-diligence',
    numero: 7,
    titre: 'Due diligence environnementale et accompagnement des acquisitions',
    accroche: "Réduire l'incertitude avant un investissement",
    intro:
      "L'acquisition d'un terrain, d'un site industriel ou d'un actif immobilier peut exposer l'acquéreur à des risques environnementaux parfois mal identifiés. J'accompagne les investisseurs, entreprises et collectivités afin de sécuriser leurs décisions en identifiant les enjeux potentiels avant engagement.",
    points: [
      {
        titre: 'Analyse notamment',
        items: ['Historique des usages', 'Contexte environnemental', 'Activités passées', 'Risques liés aux sols ou aux eaux souterraines', 'Contraintes réglementaires potentielles', 'Investigations déjà réalisées'],
      },
      {
        titre: 'Objectif',
        items: ['Permettre au client de comprendre les risques avant de prendre une décision engageante'],
      },
    ],
  },
  {
    slug: 'appui-avocats-experts-assureurs',
    numero: 8,
    titre: 'Appui technique aux avocats, experts et assureurs',
    accroche: 'Traduire la technique en éléments exploitables',
    intro:
      "Lorsqu'un dossier comporte une composante environnementale ou hydrogéologique, il est souvent nécessaire de disposer d'une expertise indépendante permettant de comprendre les données techniques et leurs implications.",
    points: [
      {
        titre: "J'interviens en appui de",
        items: ["Cabinets d'avocats", 'Experts judiciaires ou amiables', 'Assureurs', 'Experts fonciers', 'Collectivités'],
      },
      {
        titre: 'Interventions possibles',
        items: ['Analyse de rapports techniques', 'Préparation de dossiers', 'Avis techniques indépendants', "Assistance lors d'expertises", "Évaluation de la robustesse d'études existantes"],
      },
    ],
  },
  {
    slug: 'investigations-ponctuelles',
    numero: 9,
    titre: 'Investigations et prélèvements ponctuels',
    accroche: 'Lorsque des mesures ciblées sont nécessaires',
    intro:
      "Bien que mon activité soit principalement orientée vers le conseil et l'accompagnement stratégique, certaines missions peuvent inclure des investigations de terrain limitées lorsque celles-ci apportent une réelle valeur ajoutée à la compréhension d'une situation.",
    points: [
      {
        titre: "Prélèvements d'eau",
        items: ['Eau du robinet', 'Eau de puits', 'Eau de forage', 'Eaux souterraines', 'Eaux superficielles'],
      },
      {
        titre: 'Prélèvements environnementaux',
        items: ['Sols', 'Sédiments', 'Boues', 'Échantillons destinés à une analyse en laboratoire'],
      },
      {
        titre: 'Accompagnement des campagnes de terrain',
        items: ['Définition des besoins', "Élaboration des programmes d'investigation", 'Interprétation des résultats', 'Relecture des rapports de laboratoire'],
      },
    ],
  },
]
