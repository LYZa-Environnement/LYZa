import { niveauAspitet, situerDansAspitet } from '../lib/aspitet'
import { cached, pointKey } from '../lib/cache'
import { formatDistance } from '../lib/geo'
import { fetchSsp, type CasiasItem, type SisItem } from '../lib/georisques'
import { surveyNearbyParcels } from '../lib/parcelles'
import { fetchFondGeochimique, fetchTypeDeSol } from '../lib/sols'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 1000
/** How many nearby sites are detailed individually before the list is capped. */
const MAX_SITES_DETAILLES = 12

const COULEURS = {
  casias: '#a3671a',
  sis: '#8c1d0f',
  sol: '#5f8c3a',
}

type SitePositionne<T> = T & { localisation: NonNullable<CasiasItem['localisation']> }

function positionnesTriesParDistance<T extends { localisation: CasiasItem['localisation'] }>(items: T[]): SitePositionne<T>[] {
  return items
    .filter((item): item is SitePositionne<T> => item.localisation !== null)
    .sort((a, b) => a.localisation.distanceM - b.localisation.distanceM)
}

export async function buildSol(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [ssp, typeSol, fond, parcelles] = await Promise.all([
    safe(fetchSsp(lat, lon, RAYON_M)),
    safe(fetchTypeDeSol(lat, lon)),
    safe(fetchFondGeochimique(lat, lon)),
    safe(cached(pointKey('parcelles', lat, lon), () => surveyNearbyParcels(lat, lon))),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  // ---- Nature du sol ------------------------------------------------------

  if (typeSol) {
    if (typeSol.geometrie) {
      features.push({
        kind: 'area',
        geometry: typeSol.geometrie,
        label: `Unité pédologique — ${typeSol.nomSolDominant ?? 'sol dominant'}`,
        color: COULEURS.sol,
        group: 'Unité pédologique',
      })
    }
    indicateurs.push({
      label: 'Type de sol dominant',
      value: typeSol.nomSolDominant ?? 'Non précisé',
      situation: typeSol.partSolDominant !== null ? `${typeSol.partSolDominant} % de l'unité cartographique` : undefined,
      detail: typeSol.nomUniteCartographique ?? undefined,
      level: 'favorable',
      href: 'https://www.gissol.fr/',
    })
    commentaire.push(
      `Le site repose sur une unité pédologique dont le sol dominant est un ${(typeSol.nomSolDominant ?? 'sol non précisé').toLowerCase()}` +
        `${typeSol.nomUniteCartographique ? ` — ${typeSol.nomUniteCartographique.toLowerCase()}` : ''}. ` +
        `Cette cartographie est établie au 1/250 000 : elle décrit le contexte pédologique local, pas la parcelle.`,
    )
  }

  // ---- Fond pédo-géochimique ---------------------------------------------

  if (fond) {
    const lectures = fond.elements.map((element) => ({ element, lecture: situerDansAspitet(element.symbole, element.valeur) }))
    const horsOrdinaire = lectures.filter(({ lecture }) => lecture.situation === 'anomalie-moderee' || lecture.situation === 'anomalie-forte' || lecture.situation === 'au-dela')

    indicateurs.push({
      label: 'Teneurs de fond en éléments traces dans les sols',
      value: pluriel(fond.elements.length, 'élément mesuré', 'éléments mesurés'),
      situation: `Horizon ${fond.profondeur}${fond.cellule !== null ? ` — maille n° ${fond.cellule}` : ''}`,
      detail:
        horsOrdinaire.length > 0
          ? `${horsOrdinaire.map(({ element }) => element.nom.toLowerCase()).join(', ')} se situe${horsOrdinaire.length > 1 ? 'nt' : ''} au-dessus des gammes couramment observées dans les sols « ordinaires » de France.`
          : 'Tous les éléments se situent dans les gammes couramment observées dans les sols « ordinaires » de France.',
      level: horsOrdinaire.length === 0 ? 'favorable' : 'attention',
    })

    for (const { element, lecture } of lectures) {
      indicateurs.push({
        pliable: 'Détail par élément trace',
        label: `${element.nom} (${element.symbole})`,
        value: `${element.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${element.unite}`,
        situation: lecture.gamme ? `Sols « ordinaires » de France : ${lecture.gamme.libelleOrdinaire} mg/kg` : undefined,
        detail: lecture.commentaire,
        level: niveauAspitet(lecture.situation),
      })
    }

    commentaire.push(
      `Les teneurs de fond de ${pluriel(fond.elements.length, 'élément trace', 'éléments traces')} ` +
        `(${fond.elements.map((e) => e.symbole).join(', ')}) sont issues du Réseau de Mesures de la Qualité des Sols, agrégées par maille` +
        `${fond.cellule !== null ? ` (maille n° ${fond.cellule})` : ''}. ` +
        `Chacune est comparée aux gammes de référence du programme ASPITET — « Apports d'une Stratification Pédologique pour ` +
        `l'Interprétation des Teneurs en Éléments Traces », mené par l'Institut national de la recherche agronomique — qui décrivent ` +
        `ce que l'on observe couramment dans les sols français, puis ce que l'on observe là où la roche mère est naturellement enrichie. Une teneur sortant de la gamme ordinaire oriente donc d'abord vers ` +
        `la géologie locale, pas vers une contamination.`,
    )
    commentaire.push(
      `Ce sont des valeurs à grande échelle, établies sur des sols agricoles : au droit d'une parcelle, des écarts importants sont très probables, ` +
        `qu'ils soient naturels — nature de la roche mère, position topographique — ou anthropiques — remblais, retombées, anciens usages. ` +
        `Elles servent de repère pour interpréter une analyse de sol, jamais de substitut à celle-ci.`,
    )
  }

  // ---- Anciens sites industriels et secteurs d'information sur les sols ---

  if (ssp) {
    const casias = positionnesTriesParDistance<CasiasItem>(ssp.casias.items)
    const sis = positionnesTriesParDistance<SisItem>(ssp.sis.items)

    for (const item of casias.slice(0, 80)) {
      features.push({
        kind: 'point',
        lat: item.localisation.lat,
        lon: item.localisation.lon,
        label: `Ancien site industriel — ${item.nom}${item.activite ? ` (${item.activite})` : ''}`,
        color: COULEURS.casias,
        group: 'Ancien site industriel (CASIAS)',
      })
    }
    for (const item of sis.slice(0, 40)) {
      features.push({
        kind: 'point',
        lat: item.localisation.lat,
        lon: item.localisation.lon,
        label: `Secteur d'information sur les sols — ${item.nom}`,
        color: COULEURS.sis,
        group: "Secteur d'information sur les sols (SIS)",
      })
    }

    indicateurs.push({
      label: 'Anciens sites industriels et activités de service (inventaire CASIAS)',
      value: ssp.casias.total === 0 ? 'Aucun' : pluriel(ssp.casias.total, 'site'),
      situation: `Dans un rayon de ${formatDistance(RAYON_M)}`,
      detail:
        ssp.casias.total === 0
          ? "L'inventaire CASIAS recense les activités industrielles passées à partir d'archives : son silence ne vaut pas absence d'activité."
          : "Chaque site est détaillé ci-dessous. Un site CASIAS atteste d'une activité passée, pas d'une pollution.",
      level: ssp.casias.total === 0 ? 'favorable' : casias[0] && casias[0].localisation.distanceM < 200 ? 'defavorable' : 'attention',
    })

    // Every nearby CASIAS site as its own line: the activity and the distance
    // are what tell a reader whether it matters, and a single "nearest" line
    // hides the dozen behind it.
    for (const item of casias.slice(0, MAX_SITES_DETAILLES)) {
      indicateurs.push({
        pliable: 'Détail des anciens sites industriels',
        label: item.nom,
        value: item.activite ?? item.statut ?? 'Ancien site industriel',
        situation: situation(item.localisation.distanceM, item.localisation.direction),
        detail: [
          item.adresse && item.adresse !== item.nom ? item.adresse : null,
          item.commune,
          item.statut && item.activite ? `État : ${item.statut}` : null,
          item.identifiant ? `réf. ${item.identifiant}` : null,
          item.dateMaj ? `fiche mise à jour le ${item.dateMaj}` : null,
        ]
          .filter(Boolean)
          .join(' — '),
        level: item.localisation.distanceM < 200 ? 'defavorable' : item.localisation.distanceM < 500 ? 'attention' : 'favorable',
        href: item.ficheUrl ?? undefined,
      })
    }

    indicateurs.push({
      label: "Secteurs d'information sur les sols",
      value: ssp.sis.total === 0 ? 'Aucun' : pluriel(ssp.sis.total, 'secteur'),
      situation: `Dans un rayon de ${formatDistance(RAYON_M)}`,
      detail:
        "Un secteur d'information sur les sols traduit une pollution constatée et conservée dans le sol ; il s'impose à l'information des acquéreurs et des locataires.",
      level: ssp.sis.total === 0 ? 'favorable' : 'defavorable',
    })

    for (const item of sis.slice(0, MAX_SITES_DETAILLES)) {
      indicateurs.push({
        pliable: "Détail des secteurs d'information sur les sols",
        label: item.nom,
        value: item.superficieM2 !== null ? `${Math.round(item.superficieM2).toLocaleString('fr-FR')} m²` : 'Secteur d’information sur les sols',
        situation: situation(item.localisation.distanceM, item.localisation.direction),
        detail: [item.commune, item.identifiant ? `réf. ${item.identifiant}` : null].filter(Boolean).join(' — '),
        level: 'defavorable',
        href: item.ficheUrl ?? undefined,
      })
    }

    if (ssp.casias.total > 0 || ssp.sis.total > 0) {
      const plusProche = casias[0] ?? sis[0]
      commentaire.push(
        `${ssp.casias.total > 0 ? `${pluriel(ssp.casias.total, 'ancien site industriel', 'anciens sites industriels')} (inventaire CASIAS)` : ''}` +
          `${ssp.casias.total > 0 && ssp.sis.total > 0 ? ' et ' : ''}` +
          `${ssp.sis.total > 0 ? pluriel(ssp.sis.total, "secteur d'information sur les sols", "secteurs d'information sur les sols") : ''}` +
          ` ${ssp.casias.total + ssp.sis.total > 1 ? 'sont recensés' : 'est recensé'} dans un rayon de ${formatDistance(RAYON_M)}` +
          `${plusProche ? `, le plus proche ${situation(plusProche.localisation.distanceM, plusProche.localisation.direction)}` : ''}. ` +
          `Un site CASIAS atteste d'une activité industrielle passée, pas d'une pollution : il appelle une vérification, pas une conclusion. ` +
          `Un secteur d'information sur les sols, lui, traduit une pollution constatée.` +
          (casias.length > MAX_SITES_DETAILLES ? ` Les ${MAX_SITES_DETAILLES} sites les plus proches sont détaillés ci-dessous.` : ''),
      )
    } else {
      commentaire.push(
        `Aucun ancien site industriel ni secteur d'information sur les sols n'est recensé dans un rayon de ${formatDistance(RAYON_M)}. ` +
          `L'inventaire CASIAS reste issu d'un travail d'archives : une activité ancienne non archivée peut ne pas y figurer.`,
      )
    }
  }

  if (parcelles?.nearestTreated) {
    const treated = parcelles.nearestTreated
    indicateurs.push({
      label: 'Usage agricole des sols voisins',
      value: treated.inside ? 'Site sur parcelle cultivée' : treated.cropLabel,
      situation: treated.inside ? 'Le site est situé sur la parcelle' : situation(treated.distanceM, treated.direction),
      detail: 'Culture déclarée au registre parcellaire graphique — un usage cultivé implique des apports (phytosanitaires, amendements) dans le sol.',
      level: treated.inside ? 'attention' : 'favorable',
    })
  }

  lacunes.push(
    "Les teneurs de fond sont des valeurs de maille, à grande échelle : l'hétérogénéité réelle des sols, naturelle ou anthropique, peut être considérable au sein d'une même maille. Seules des analyses au droit du site permettent de conclure.",
    "Aucune donnée PFAS sur les sols : il n'existe pas à ce jour de base nationale ouverte et interrogeable par adresse pour les substances perfluorées dans les sols. Les campagnes existantes portent principalement sur les eaux.",
    "Les mesures ponctuelles du Réseau de Mesures de la Qualité des Sols ne sont pas localisables : le réseau publie ses sites sans coordonnées, pour protéger les propriétaires. Seules les valeurs agrégées par maille sont exploitables.",
    "L'inventaire CASIAS est incomplet par construction et ne dit rien de l'état réel des sols. Seule une étude historique et documentaire (norme NF X31-620) puis des sondages permettent de conclure.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Géorisques — sites et sols pollués (inventaire CASIAS, secteurs d’information sur les sols)', href: 'https://www.georisques.gouv.fr/' },
      { label: 'Groupement d’intérêt scientifique Sol / INRAE (Institut national de recherche pour l’agriculture, l’alimentation et l’environnement) — carte des sols dominants', href: 'https://www.gissol.fr/', note: 'unités cartographiques au 1/250 000' },
      {
        label: 'ASPITET (INRA, D. Baize) — teneurs en éléments traces des sols français',
        href: 'https://www.gissol.fr/',
        note: 'gammes de valeurs ordinaires et d’anomalies naturelles servant de comparaison',
      },
      { label: 'Groupement d’intérêt scientifique Sol — Réseau de Mesures de la Qualité des Sols (RMQS), fonds pédo-géochimiques', href: 'https://www.gissol.fr/le-gis/programmes/rmqs-3', note: 'Réseau de Mesures de la Qualité des Sols — teneurs de fond, par maille' },
      { label: 'IGN — photographies aériennes historiques', href: 'https://remonterletemps.ign.fr/', note: 'frise ci-dessous' },
      { label: 'IGN — registre parcellaire graphique (déclarations agricoles)', href: 'https://geoservices.ign.fr/rpg' },
    ],
  }
}
