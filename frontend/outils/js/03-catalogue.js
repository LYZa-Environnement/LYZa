/*
 * Outils internes LYZa — catalogue des prestations.
 *
 * Prix HT (franchise de TVA). Ceux des forages reprennent le business plan
 * « LYZa – Business plan forages agricoles » (novembre 2026) ; ceux des
 * prélèvements de sol et des avis d'urgence reprennent les devis et factures
 * déjà émis. Le catalogue se modifie dans l'onglet Catalogue : ces valeurs ne
 * sont que le point de départ.
 *
 * Pour chaque prestation, « prestations », « hypotheses » et « delai »
 * alimentent les sections du devis du même nom. Une ligne commençant par deux
 * espaces est une sous-puce.
 */
;(() => {
  const L = window.LYZA

  const CATEGORIES = {
    forages: "Forages d'eau",
    avis: 'Avis hydrogéologiques',
    sols: 'Sols et analyses',
    autre: 'Autres',
  }

  const CATALOGUE = [
    {
      code: 'FOR-COUPE',
      categorie: 'forages',
      designation: 'Coupe géologique prévisionnelle',
      unite: 'Forage',
      prix: 150,
      nature: 'Documents réglementaires de forage',
      objet: 'la réalisation de la coupe géologique prévisionnelle du forage projeté',
      prestations: [
        'Recueil des données disponibles : carte géologique, forages voisins de la Banque du sous-sol (BSS), données piézométriques publiques ;',
        "Analyse du contexte du site : captages d'eau potable et périmètres de protection, zonages environnementaux, sources de pollution potentielles à proximité ;",
        'Établissement de la coupe géologique prévisionnelle : formations et aquifères attendus, profondeur prévisionnelle, venues d’eau probables ;',
        "Fourniture de la coupe au format PDF, prête à être jointe au dossier de l'ouvrage.",
      ],
      hypotheses: [
        'La coupe est établie à partir des données publiques disponibles et des informations transmises par le client ; elle ne remplace pas les observations réalisées pendant la foration ;',
        "Aucune visite de terrain n'est incluse, sauf mention contraire ;",
        "La position de l'ouvrage (coordonnées ou plan de situation) est communiquée par le client.",
      ],
      delai:
        "La coupe est remise sous 48 heures ouvrées à compter de la réception de la commande et de la position de l'ouvrage.",
    },
    {
      code: 'FOR-RFT',
      categorie: 'forages',
      designation: 'Rapport de fin de travaux',
      unite: 'Forage',
      prix: 300,
      nature: 'Documents réglementaires de forage',
      objet: 'la rédaction du rapport de fin de travaux du forage, avec interprétation de l’essai de pompage',
      prestations: [
        "Mise en forme de la coupe géologique et technique de l'ouvrage à partir des relevés de l'entreprise de forage ;",
        "Interprétation de l'essai de pompage : transmissivité, débit critique et débit d'exploitation conseillé ;",
        "Rédaction du rapport de fin de travaux : localisation, caractéristiques de l'ouvrage, essai de pompage, conclusions ;",
        "Fourniture du rapport au format PDF, en vue de sa transmission au maître d'ouvrage et au préfet.",
      ],
      hypotheses: [
        "Les données de chantier (coupe, équipement, cimentation, essai de pompage) sont fournies par l'entreprise de forage ;",
        "L'interprétation porte sur les données transmises ; leur exactitude relève de l'entreprise qui les a relevées ;",
        "Les analyses d'eau ne sont pas comprises et peuvent faire l'objet d'une ligne distincte.",
      ],
      delai:
        'Le rapport est remis sous 10 jours ouvrés à compter de la réception des données complètes du chantier.',
    },
    {
      code: 'FOR-IOTA',
      categorie: 'forages',
      designation: "Dossier de déclaration au titre de la loi sur l'eau (IOTA)",
      unite: 'Dossier',
      prix: 600,
      nature: 'Documents réglementaires de forage',
      objet: "la constitution du dossier de déclaration du forage au titre de la loi sur l'eau",
      prestations: [
        'Identification des rubriques de la nomenclature applicables (1.1.1.0, et 1.1.2.0 si le prélèvement dépasse 10 000 m³/an) ;',
        "Rédaction du document d'incidence : contexte géologique et hydrogéologique, usages de l'eau, incidences du forage et du prélèvement, mesures prévues, compatibilité avec le SDAGE et le SAGE ;",
        "Constitution du dossier de déclaration et accompagnement du maître d'ouvrage pour son dépôt ;",
        "Réponse à une demande de compléments du service instructeur.",
      ],
      hypotheses: [
        "Le dossier est déposé par le maître d'ouvrage, qui reste le déclarant ;",
        "Les volumes et usages prévus sont communiqués par le maître d'ouvrage ;",
        'Les compléments nécessitant des études nouvelles (inventaires, mesures de terrain) ne sont pas compris ;',
        'Régime applicable aux forages réalisés jusqu’au 31 décembre 2027.',
      ],
      delai: 'Le dossier est remis sous 10 jours ouvrés à compter de la réception des informations nécessaires.',
    },
    {
      code: 'FOR-MINIER',
      categorie: 'forages',
      designation: 'Déclaration du forage au titre du code minier',
      unite: 'Forage',
      prix: 80,
      nature: 'Documents réglementaires de forage',
      objet: 'la préparation de la déclaration du forage au titre du code minier',
      prestations: [
        "Préparation de la déclaration de l'ouvrage au titre du code minier pour le compte du maître d'ouvrage ;",
        'Jonction de la coupe géologique et des informations techniques requises ;',
        "Transmission au maître d'ouvrage, ou dépôt pour son compte selon les modalités en vigueur.",
      ],
      hypotheses: [
        "Le maître d'ouvrage reste le déclarant ;",
        'La déclaration suit les modalités fixées par les textes en vigueur à la date de la mission.',
      ],
      delai: 'La déclaration est préparée sous 5 jours ouvrés.',
    },
    {
      code: 'FOR-CPC',
      categorie: 'forages',
      designation: "Demande d'examen au cas par cas (forage de 50 m et plus)",
      unite: 'Dossier',
      prix: 250,
      nature: 'Documents réglementaires de forage',
      objet: "le renseignement de la demande d'examen au cas par cas du forage projeté",
      prestations: [
        "Renseignement du formulaire de demande d'examen au cas par cas (Cerfa n° 14734) ;",
        'Description du projet et de sa localisation, sensibilité environnementale de la zone, incidences probables ;',
        'Constitution des annexes cartographiques requises.',
      ],
      hypotheses: [
        "La demande est déposée par le maître d'ouvrage auprès de l'autorité environnementale ;",
        "Une étude d'impact, si l'autorité environnementale l'exige, ferait l'objet d'un devis distinct.",
      ],
      delai: 'Le formulaire est remis sous 5 jours ouvrés.',
    },
    {
      code: 'FOR-DUPLOS',
      categorie: 'forages',
      designation: 'Déclaration DUPLOS (forage ou puits domestique)',
      unite: 'Ouvrage',
      prix: 40,
      nature: "Déclaration d'ouvrages domestiques",
      objet: 'la déclaration en ligne des ouvrages domestiques réalisés',
      prestations: [
        "Saisie de la déclaration de l'ouvrage domestique sur le téléservice DUPLOS, pour le compte de l'entreprise de forage ;",
        "Transmission de l'accusé de réception.",
      ],
      hypotheses: ["Les informations relatives à l'ouvrage et à son propriétaire sont fournies par l'entreprise de forage."],
      delai: 'Les déclarations sont traitées par lot, sous 5 jours ouvrés.',
    },
    {
      code: 'FOR-CERTIF',
      categorie: 'forages',
      designation: "Accompagnement à la certification de l'entreprise de forage",
      unite: 'Forfait',
      prix: 1010,
      nature: 'Accompagnement à la certification',
      objet: "l'accompagnement de l'entreprise dans la préparation de sa certification (arrêté du 18 mars 2026)",
      prestations: [
        'Modèles de coupe géologique prévisionnelle et de rapport de fin de travaux conformes à l’arrêté du 18 mars 2026 ;',
        'Organisation des données de chantier (coupes, essais de pompage, photographies) ;',
        "Préparation des références et des documents à présenter lors de l'audit de certification.",
      ],
      hypotheses: [
        "L'accompagnement ne garantit pas l'obtention de la certification, délivrée par un organisme accrédité ;",
        "Le référent technique reste un membre de l'entreprise de forage.",
      ],
      delai: "L'accompagnement représente 1,5 jour, réparti selon le calendrier de l'entreprise.",
    },
    {
      code: 'AVIS-URG',
      categorie: 'avis',
      designation: "Avis d'urgence sommaire hydrogéologique pour site d'enfouissement de cadavres d'animaux",
      unite: 'Site',
      prix: 76,
      nature: "Avis d'urgence sommaire hydrogéologique",
      objet: "l'émission d'avis d'urgence sommaires hydrogéologiques sur des sites d'enfouissement exceptionnel de cadavres d'animaux",
      prestations: [
        'Analyse documentaire du site proposé : topographie, géologie, hydrographie, zones humides et inondables, captages et usages de l’eau ;',
        'Appréciation des risques pour les eaux souterraines et superficielles ;',
        "Rédaction d'un avis sommaire assorti de prescriptions minimales, transmis dans un délai compatible avec l'urgence.",
      ],
      hypotheses: [
        'Avis établi en urgence, sur la base des informations disponibles au moment de la saisine, sans visite de terrain ;',
        "L'avis ne se substitue pas aux autorisations administratives, sanitaires ou environnementales requises.",
      ],
      delai: "L'avis est transmis en principe le jour même de la saisine.",
    },
    {
      code: 'SOL-PREL',
      categorie: 'sols',
      designation: "Réalisation du prélèvement, logistique et matériel, fourniture d'une synthèse de résultats",
      unite: 'Unité',
      prix: 50,
      nature: 'Prélèvement et analyses de sol',
      objet: "la réalisation du prélèvement et des analyses de sol ainsi que la fourniture des résultats commentés",
      prestations: [
        'Détermination du programme analytique adapté à la zone de prélèvement ;',
        "Contact avec un laboratoire d'analyses environnementales spécialisé ;",
        'Frais matériel (matériel de prélèvement) et logistique (transport des échantillons) ;',
        "Fourniture des résultats d'analyses accompagnés d'une note de synthèse.",
      ],
      hypotheses: [
        "Compte tenu de la surface de la parcelle et de la réalisation d'un seul échantillon, le prélèvement sera effectué dans l'horizon superficiel 0–30 cm par quartage, à partir de plusieurs points répartis sur la parcelle. L'échantillon analysé correspondra donc à un échantillon composite, représentatif du mélange de ces différents points de prélèvement ;",
        "Le programme analytique a été défini sur la base de l'emplacement du site d'étude et de son historique sommaire ;",
        "L'interprétation des résultats sera réalisée au regard des informations disponibles au moment de la mission et ne constitue pas un diagnostic réglementaire exhaustif de l'état des sols ;",
        'Les délais d’analyse sont dépendants des délais de traitement du laboratoire et peuvent être ajustés en fonction de ses contraintes opérationnelles ;',
        "La prestation n'inclut pas de prestation d'évaluation des risques sanitaires.",
      ],
      delai:
        "Le délai prévisionnel d'intervention est de 2 semaines à compter de la réception de la commande et de l'acceptation du devis. Le délai analytique est généralement de 10 jours ouvrés. La revue des résultats et la fourniture de la note de synthèse sont de 5 jours ouvrés après réception des résultats du laboratoire.",
    },
    {
      code: 'ANA-PACK',
      categorie: 'sols',
      designation: '**Réalisation d’analyses environnementales** – Pack analytique HCT + COHV + BTEX + 8 métaux',
      unite: 'Échantillon',
      prix: 67.6,
      nature: '',
      objet: '',
      prestations: [
        'Réalisation d’analyses environnementales :',
        '  - Hydrocarbures C10-C40 (HCT C10-C40) ;',
        '  - Composés organo-halogénés volatils (COHV) ;',
        '  - Benzène, toluène, éthylbenzène, xylènes (BTEX) ;',
        '  - 8 métaux lourds (arsenic, cadmium, chrome, cuivre, mercure, nickel, plomb, zinc) ;',
      ],
      hypotheses: [],
      delai: '',
    },
    {
      code: 'ANA-POP',
      categorie: 'sols',
      designation: '**Réalisation d’analyses environnementales** – 11 POP',
      unite: 'Échantillon',
      prix: 91,
      nature: '',
      objet: '',
      prestations: ['Réalisation d’analyses environnementales :', '  - 11 pesticides organophosphorés (POP) ;'],
      hypotheses: [
        "Bon nombre des composés analysés (notamment les pesticides) ne disposent pas de valeur de référence ou de valeur seuil applicable. Leur analyse permettra donc uniquement de constater leur présence ou leur absence ;",
      ],
      delai: '',
    },
    {
      code: 'ANA-POC',
      categorie: 'sols',
      designation: '**Réalisation d’analyses environnementales** – 26 POC',
      unite: 'Échantillon',
      prix: 91,
      nature: '',
      objet: '',
      prestations: ['Réalisation d’analyses environnementales :', '  - 26 pesticides organochlorés (POC).'],
      hypotheses: [
        "Bon nombre des composés analysés (notamment les pesticides) ne disposent pas de valeur de référence ou de valeur seuil applicable. Leur analyse permettra donc uniquement de constater leur présence ou leur absence ;",
      ],
      delai: '',
    },
  ]

  /**
   * Ensembles prêts à l'emploi : un clic ajoute toutes leurs lignes au devis.
   */
  const FORFAITS = [
    { libelle: 'Forage agricole (jusqu’à fin 2027)', codes: ['FOR-COUPE', 'FOR-RFT', 'FOR-IOTA'] },
    { libelle: 'Forage agricole (à partir de 2028)', codes: ['FOR-COUPE', 'FOR-RFT', 'FOR-MINIER'] },
    { libelle: 'Forage de 50 m et plus : + cas par cas', codes: ['FOR-CPC'] },
    { libelle: 'Prélèvement de sol + 3 analyses', codes: ['SOL-PREL', 'ANA-PACK', 'ANA-POP', 'ANA-POC'] },
  ]

  Object.assign(L, { CATEGORIES, CATALOGUE, FORFAITS })
})()
