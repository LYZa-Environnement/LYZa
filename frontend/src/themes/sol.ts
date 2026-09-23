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
    for (const element of fond.elements) {
      indicateurs.push({
        label: `Fond géochimique — ${element.nom} (${element.symbole})`,
        value: `${element.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${element.unite}`,
        situation: `Horizon ${fond.profondeur}`,
        detail: 'Teneur de référence dans les sols agricoles de la maille (RMQS). Une analyse au-dessus de cette valeur traduit un enrichissement local.',
      })
    }
    commentaire.push(
      `Les teneurs de fond de ${pluriel(fond.elements.length, 'élément trace', 'éléments traces')} ` +
        `(${fond.elements.map((e) => e.symbole).join(', ')}) sont issues du Réseau de Mesures de la Qualité des Sols, agrégées par maille` +
        `${fond.cellule !== null ? ` (maille n° ${fond.cellule})` : ''}. ` +
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
        label: `CASIAS — ${item.nom}${item.activite ? ` (${item.activite})` : ''}`,
        color: COULEURS.casias,
        group: 'Ancien site industriel (CASIAS)',
      })
    }
    for (const item of sis.slice(0, 40)) {
      features.push({
        kind: 'point',
        lat: item.localisation.lat,
        lon: item.localisation.lon,
        label: `SIS — ${item.nom}`,
        color: COULEURS.sis,
        group: "Secteur d'information sur les sols (SIS)",
      })
    }

    indicateurs.push({
      label: 'Anciens sites industriels (CASIAS)',
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
        label: `↳ ${item.nom}`,
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
      label: "Secteurs d'information sur les sols (SIS)",
      value: ssp.sis.total === 0 ? 'Aucun' : pluriel(ssp.sis.total, 'secteur'),
      situation: `Dans un rayon de ${formatDistance(RAYON_M)}`,
      detail:
        "Un SIS traduit une pollution constatée et conservée dans le sol ; il s'impose à l'information des acquéreurs et des locataires.",
      level: ssp.sis.total === 0 ? 'favorable' : 'defavorable',
    })

    for (const item of sis.slice(0, MAX_SITES_DETAILLES)) {
      indicateurs.push({
        label: `↳ ${item.nom}`,
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
          `Un SIS, lui, traduit une pollution constatée.` +
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
    "Les mesures ponctuelles du RMQS ne sont pas localisables : le réseau publie ses sites sans coordonnées, pour protéger les propriétaires. Seules les valeurs agrégées par maille sont exploitables.",
    "L'inventaire CASIAS est incomplet par construction et ne dit rien de l'état réel des sols. Seule une étude historique et documentaire (norme NF X31-620) puis des sondages permettent de conclure.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Géorisques — sites et sols pollués (CASIAS, SIS)', href: 'https://www.georisques.gouv.fr/' },
      { label: 'GIS Sol / INRAE — carte des sols dominants', href: 'https://www.gissol.fr/', note: 'unités cartographiques au 1/250 000' },
      { label: 'GIS Sol — RMQS, fonds pédo-géochimiques', href: 'https://www.gissol.fr/le-gis/programmes/rmqs-3', note: 'teneurs de fond de dix éléments traces, par maille' },
      { label: 'IGN — photographies aériennes historiques', href: 'https://remonterletemps.ign.fr/', note: 'frise ci-dessous' },
      { label: 'IGN RPG — registre parcellaire graphique', href: 'https://geoservices.ign.fr/rpg' },
    ],
  }
}
