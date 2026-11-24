/*
 * Outils internes LYZa — paramètres par défaut et textes types.
 *
 * Les coordonnées bancaires et la signature ne sont PAS dans le dépôt : elles
 * se saisissent dans l'onglet Paramètres (conservées dans le navigateur), ou
 * sont injectées au build depuis les secrets GitHub, dans la page chiffrée.
 */
;(() => {
  const L = window.LYZA
  const build = window.LYZA_BUILD || {}

  const PARAMETRES = {
    identite: {
      nom: 'Léo Yecora-Zorzano',
      signataire: 'Léo Yecora',
      marque: 'LYZa',
      forme: 'Entrepreneur individuel',
      siret: '106 806 250 00010',
      adresse: '2 route de la Forge',
      codePostal: '50590',
      ville: 'Regnéville-sur-Mer',
      telephone: '06 73 91 88 43',
      courriel: 'loyec@protonmail.com',
      site: 'https://lyza-environnement.github.io/LYZa/',
    },
    banque: {
      titulaire: build.banque?.titulaire || 'Léo YECORA-ZORZANO',
      banque: build.banque?.banque || '',
      iban: build.banque?.iban || '',
      bic: build.banque?.bic || '',
    },
    signature: null, // { src, w, h } — image importée dans Paramètres
    documents: {
      logo: true,
      couleur: '#00BF8E',
      lieu: 'Regnéville-sur-Mer',
      validiteDevis: 90,
      delaiPaiement: 30,
      tva: 'TVA non applicable, article 293 B du Code général des impôts',
    },
  }

  const TYPES_CLIENT = {
    professionnel: 'Professionnel (entreprise, exploitation agricole, foreur)',
    particulier: 'Particulier',
    administration: 'Administration ou collectivité',
  }

  /** Conditions de paiement de la facture selon le type de client. */
  function conditionsFacture(type, echeanceFr) {
    const date = echeanceFr ? `, au plus tard le ${echeanceFr}` : ''
    if (type === 'administration') {
      return [
        `Paiement par mandat administratif, par virement, dans le délai global de paiement de 30 jours (art. R. 2192-10 du code de la commande publique)${date}.`,
        'Escompte pour paiement anticipé : néant.',
        "Tout retard de paiement fait courir de plein droit des intérêts moratoires et l'indemnité forfaitaire de 40 € pour frais de recouvrement (art. L. 2192-13 et D. 2192-35 du code de la commande publique).",
      ].join(' ')
    }
    if (type === 'particulier') {
      return [
        `Paiement à réception de facture, par virement bancaire${date}.`,
        'Escompte pour paiement anticipé : néant.',
      ].join(' ')
    }
    return [
      `Paiement à réception de facture, par virement bancaire${date}.`,
      'Escompte pour paiement anticipé : néant.',
      "En cas de retard de paiement, des pénalités au taux de trois fois le taux d'intérêt légal sont exigibles sans rappel (art. L. 441-10 du code de commerce), ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. D. 441-5 du code de commerce).",
    ].join(' ')
  }

  const DEVIS_DEFAUT = {
    conditionsPaiement: 'Paiement à réception de facture finale.',
    mentions: [
      'Le devis constitue une proposition contractuelle. Il engage le prestataire sur les prix et conditions indiqués pendant sa durée de validité ;',
      "L'acceptation du devis vaut commande de la prestation ;",
      "Les livrables produits dans le cadre de la mission sont destinés à l'usage du client, sauf accord écrit contraire.",
    ].join('\n'),
  }

  // ---------- Avis sommaires : modèles ----------

  const SOURCES_AVIS = [
    { label: 'Localisation cartographique et cadastrale du site proposé', url: 'https://www.geoportail.gouv.fr/carte', coche: true },
    { label: 'Carte géologique et données hydrogéologiques disponibles', url: 'https://infoterre.brgm.fr/', coche: true },
    { label: 'Topographie, hydrographie, zones humides et zones inondables connues', url: 'https://www.geoportail.gouv.fr/carte', coche: true },
    { label: "Inventaire des captages, puits, sources et usages de l'eau à proximité", url: 'https://carto.atlasante.fr/', coche: true },
    { label: 'Volumes ou tonnages à enfouir et modalités techniques envisagées', url: '', coche: true },
    { label: 'Qualité rivière', url: 'https://qualite-riviere.lesagencesdeleau.fr/', coche: true },
    { label: 'Synthèse environnementale à l’adresse (LYZa)', url: 'https://lyza-environnement.github.io/LYZa/', coche: false },
    { label: 'Risques naturels et technologiques', url: 'https://www.georisques.gouv.fr/', coche: false },
  ]

  const LIMITES_SANS_VISITE = [
    'Les observations relatives à la topographie, à l’occupation du sol, aux écoulements de surface, aux fossés, drains, zones humides, affleurements et éventuels indices d’eau n’ont pas pu être vérifiées directement.',
    'La présence éventuelle de puits privés, sources, captages non recensés, drains agricoles, réseaux enterrés ou écoulements temporaires peut ne pas être exhaustive.',
    'La profondeur réelle de la nappe, la nature exacte des terrains au droit de la fosse et l’éventuelle présence d’eau en fond de fouille devront être confirmées préalablement aux travaux par une fouille de reconnaissance.',
    'Les distances aux enjeux hydrauliques et sanitaires sont appréciées à partir des données cartographiques et documentaires disponibles, sous réserve de leur exactitude et de leur actualisation.',
    'Toute discordance constatée sur le terrain ou toute apparition d’eau lors du terrassement devra conduire à suspendre l’opération et à réévaluer l’avis.',
  ].join('\n')

  const MODELES_AVIS = {
    enfouissement: {
      libelle: "Enfouissement d'urgence de cadavres d'animaux",
      titre: "Avis sommaire d'urgence hydrogéologique",
      objet:
        "Avis sommaire d'urgence relatif à la faisabilité hydrogéologique d'un enfouissement exceptionnel de cadavres d'animaux, dans un contexte de crise, de surmortalité ou d'impossibilité temporaire de recours à la filière d'équarrissage.",
      objetCourt: "un enfouissement exceptionnel de cadavres d'animaux",
      demande: [
        { label: 'Demandeur', valeur: '' },
        { label: 'Autorité saisissante', valeur: 'Direction Départementale de la Protection des Populations' },
        { label: 'Date et heure de la demande', valeur: '' },
        { label: 'Exploitation ou site', valeur: '' },
        { label: 'Commune et lieu-dit', valeur: '' },
        { label: 'Type et quantité estimée de cadavres', valeur: '' },
        { label: "Contexte de l'urgence", valeur: '' },
      ],
      cadre:
        "Le présent avis est établi en urgence sur la base des informations disponibles au moment de la saisine et d'une analyse documentaire rapide. **Aucune visite de terrain n'a été réalisée dans le cadre du présent avis.** Il vise uniquement à apprécier les risques hydrogéologiques immédiats associés au choix d'un site d'enfouissement exceptionnel. Il ne se substitue pas aux autorisations administratives, sanitaires ou environnementales requises, ni aux prescriptions des services compétents.",
      cadreVisite:
        "Le présent avis est établi en urgence sur la base des informations disponibles au moment de la saisine, d'une analyse documentaire rapide et d'une visite du site. Il vise uniquement à apprécier les risques hydrogéologiques immédiats associés au choix d'un site d'enfouissement exceptionnel. Il ne se substitue pas aux autorisations administratives, sanitaires ou environnementales requises, ni aux prescriptions des services compétents.",
      analyse: [
        { point: 'Topographie', constat: '', risque: '', precision: '' },
        { point: 'Sol et sous-sol', constat: '', risque: '', precision: '' },
        { point: 'Hydrographie', constat: '', risque: '', precision: '' },
        { point: 'Captages et usages', constat: '', risque: '', precision: '' },
      ],
      prescriptions: [
        'Implanter la fosse à plus de 100 m de : zones inondables, zones humides, sources, puits, talwegs, drains agricoles ;',
        "Implanter la fosse à plus de 50 m des zones d'habitation et d'usages sensibles ;",
        "Réaliser, si possible, un sondage préalable à la pelle mécanique afin de vérifier l'absence d'eau, la nature du terrain et la profondeur maximale admissible ;",
        'La profondeur sera d’au moins 2 mètres ; en général, une profondeur de 4 mètres sera suffisante. Le fond de la fosse d’enfouissement doit impérativement se situer au moins 2 m au-dessus du niveau de la nappe phréatique ;',
        'Prévoir un recouvrement final suffisant, un modelé bombé et une gestion des eaux de surface évitant toute stagnation ou infiltration préférentielle ;',
        'Matérialiser le site, conserver un plan de récolement et assurer une surveillance visuelle après enfouissement.',
      ].join('\n'),
      conclusion:
        "Sous réserve du strict respect des prescriptions ci-dessus et de l'accord des autorités compétentes, l'enfouissement exceptionnel peut être envisagé sur le site retenu si aucune solution prioritaire de collecte, traitement ou équarrissage n'est disponible dans les délais compatibles avec la situation d'urgence. En cas de doute sur la présence d'eau souterraine, de drains, de captages non recensés ou de terrains très perméables, l'avis doit être considéré comme défavorable dans l'attente d'investigations complémentaires.",
      catalogue: 'AVIS-URG',
    },
    libre: {
      libelle: 'Avis hydrogéologique sommaire (modèle libre)',
      titre: 'Avis hydrogéologique sommaire',
      objet: 'Avis hydrogéologique sommaire relatif à …',
      objetCourt: 'le projet',
      demande: [
        { label: 'Demandeur', valeur: '' },
        { label: 'Date de la demande', valeur: '' },
        { label: 'Exploitation ou site', valeur: '' },
        { label: 'Commune et lieu-dit', valeur: '' },
        { label: 'Nature du projet', valeur: '' },
      ],
      cadre:
        "Le présent avis est établi sur la base des informations disponibles à la date de la demande et d'une analyse documentaire. **Aucune visite de terrain n'a été réalisée dans le cadre du présent avis.** Il ne se substitue pas aux autorisations administratives, sanitaires ou environnementales requises.",
      cadreVisite:
        "Le présent avis est établi sur la base des informations disponibles à la date de la demande, d'une analyse documentaire et d'une visite du site. Il ne se substitue pas aux autorisations administratives, sanitaires ou environnementales requises.",
      analyse: [
        { point: 'Topographie', constat: '', risque: '', precision: '' },
        { point: 'Sol et sous-sol', constat: '', risque: '', precision: '' },
        { point: 'Hydrogéologie', constat: '', risque: '', precision: '' },
        { point: 'Hydrographie', constat: '', risque: '', precision: '' },
        { point: 'Captages et usages', constat: '', risque: '', precision: '' },
      ],
      prescriptions: '',
      conclusion: '',
      catalogue: '',
    },
  }

  const RISQUES = ['', 'Faible', 'Modéré', 'Fort', 'Non évalué']

  const SENS_AVIS = {
    favorable: { libelle: 'Favorable', phrase: 'est jugé **favorable**' },
    reserves: { libelle: 'Favorable sous réserves', phrase: 'est jugé **favorable sous réserve** du respect des conditions ci-dessous' },
    defavorable: { libelle: 'Défavorable', phrase: 'est jugé **défavorable**' },
  }

  Object.assign(L, {
    PARAMETRES,
    TYPES_CLIENT,
    conditionsFacture,
    DEVIS_DEFAUT,
    SOURCES_AVIS,
    LIMITES_SANS_VISITE,
    MODELES_AVIS,
    RISQUES,
    SENS_AVIS,
  })
})()
