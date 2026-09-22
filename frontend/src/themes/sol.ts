import { cached, pointKey } from '../lib/cache'
import { formatDistance } from '../lib/geo'
import { fetchSsp } from '../lib/georisques'
import { surveyNearbyParcels } from '../lib/parcelles'
import { fetchFondGeochimique, fetchTypeDeSol } from '../lib/sols'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 1000

const COULEURS = {
  casias: '#a3671a',
  sis: '#8c1d0f',
  sol: '#5f8c3a',
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

  if (fond) {
    indicateurs.push({
      label: `Fond pédo-géochimique — ${fond.element}`,
      value: `${fond.valeur} ${fond.unite}`,
      situation: `Horizon ${fond.profondeur}`,
      detail:
        "Teneur naturelle/diffuse de référence dans les sols agricoles de la maille (RMQS). Une analyse de sol au-dessus de cette valeur traduit un enrichissement local, pas nécessairement une pollution.",
      level: 'favorable',
      href: 'https://www.gissol.fr/le-gis/programmes/rmqs-3',
    })
  }

  // ---- Anciens sites industriels et secteurs d'information sur les sols ---

  if (ssp) {
    for (const item of ssp.casias.items.filter((i) => i.localisation).slice(0, 80)) {
      features.push({
        kind: 'point',
        lat: item.localisation!.lat,
        lon: item.localisation!.lon,
        label: `CASIAS — ${item.nom}${item.activite ? ` (${item.activite})` : ''}`,
        color: COULEURS.casias,
        group: 'Ancien site industriel (CASIAS)',
      })
    }
    for (const item of ssp.sis.items.filter((i) => i.localisation).slice(0, 40)) {
      features.push({
        kind: 'point',
        lat: item.localisation!.lat,
        lon: item.localisation!.lon,
        label: `SIS — ${item.nom}`,
        color: COULEURS.sis,
        group: "Secteur d'information sur les sols (SIS)",
      })
    }

    const casiasProche = [...ssp.casias.items].filter((i) => i.localisation).sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
    indicateurs.push({
      label: 'Anciens sites industriels (CASIAS)',
      value: ssp.casias.total === 0 ? 'Aucun' : pluriel(ssp.casias.total, 'site'),
      situation: casiasProche ? `Le plus proche ${situation(casiasProche.localisation!.distanceM, casiasProche.localisation!.direction)}` : undefined,
      detail: casiasProche
        ? `${casiasProche.nom}${casiasProche.activite ? ` — ${casiasProche.activite}` : ''}`
        : `Aucun site recensé dans un rayon de ${formatDistance(RAYON_M)}.`,
      level: ssp.casias.total === 0 ? 'favorable' : casiasProche && casiasProche.localisation!.distanceM < 200 ? 'defavorable' : 'attention',
      href: casiasProche?.ficheUrl ?? undefined,
    })

    const sisProche = [...ssp.sis.items].filter((i) => i.localisation).sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
    indicateurs.push({
      label: "Secteurs d'information sur les sols (SIS)",
      value: ssp.sis.total === 0 ? 'Aucun' : pluriel(ssp.sis.total, 'secteur'),
      situation: sisProche ? `Le plus proche ${situation(sisProche.localisation!.distanceM, sisProche.localisation!.direction)}` : undefined,
      detail:
        ssp.sis.total === 0
          ? "Aucun SIS ne grève les terrains dans ce rayon. Un SIS signale une pollution avérée et s'impose à l'information des acquéreurs."
          : `${sisProche?.nom ?? ''} — un SIS signale une pollution avérée et doit être porté à la connaissance des acquéreurs et locataires.`,
      level: ssp.sis.total === 0 ? 'favorable' : 'defavorable',
      href: sisProche?.ficheUrl ?? undefined,
    })

    if (ssp.casias.total > 0 || ssp.sis.total > 0) {
      commentaire.push(
        `${ssp.casias.total > 0 ? `${pluriel(ssp.casias.total, 'ancien site industriel', 'anciens sites industriels')} (inventaire CASIAS)` : ''}` +
          `${ssp.casias.total > 0 && ssp.sis.total > 0 ? ' et ' : ''}` +
          `${ssp.sis.total > 0 ? `${pluriel(ssp.sis.total, "secteur d'information sur les sols", "secteurs d'information sur les sols")}` : ''}` +
          ` ${ssp.casias.total + ssp.sis.total > 1 ? 'sont recensés' : 'est recensé'} dans un rayon de ${formatDistance(RAYON_M)}. ` +
          `Un site CASIAS atteste d'une activité industrielle passée, pas d'une pollution : il appelle une vérification, pas une conclusion. ` +
          `Un SIS, lui, traduit une pollution constatée et conservée dans le sol.`,
      )
    } else {
      commentaire.push(
        `Aucun ancien site industriel ni secteur d'information sur les sols n'est recensé dans un rayon de ${formatDistance(RAYON_M)}. ` +
          `L'inventaire CASIAS reste toutefois issu d'un travail d'archives : une activité ancienne non archivée peut ne pas y figurer.`,
      )
    }
  }

  if (parcelles?.nearestTreated) {
    const treated = parcelles.nearestTreated
    indicateurs.push({
      label: 'Usage agricole des sols voisins',
      value: treated.inside ? 'Site sur parcelle cultivée' : treated.cropLabel,
      situation: treated.inside ? undefined : situation(treated.distanceM, treated.direction),
      detail: 'Culture déclarée au registre parcellaire graphique — un usage cultivé implique des apports (phytosanitaires, amendements) dans le sol.',
      level: treated.inside ? 'attention' : 'favorable',
    })
  }

  lacunes.push(
    "Aucune donnée PFAS sur les sols : il n'existe pas à ce jour de base nationale ouverte et interrogeable par adresse pour les substances perfluorées dans les sols. Les campagnes existantes portent principalement sur les eaux et sont publiées par arrêté préfectoral ou par bassin.",
    "Les mesures ponctuelles du RMQS (Réseau de Mesures de la Qualité des Sols) ne sont pas localisables : le réseau publie ses 2 200 sites sans coordonnées, pour protéger les propriétaires. Seules les valeurs de fond agrégées par maille sont exploitables, et pour le seul cadmium sur ce service.",
    "L'inventaire CASIAS recense des activités passées à partir d'archives : il est incomplet par construction et ne dit rien de l'état réel des sols. Seule une étude historique et documentaire (norme NF X31-620) puis des sondages permettent de conclure.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Géorisques — sites et sols pollués (CASIAS, SIS)', href: 'https://www.georisques.gouv.fr/risques/sites-et-sols-pollues' },
      { label: 'GIS Sol / INRAE — carte des sols dominants', href: 'https://www.gissol.fr/', note: 'unités cartographiques au 1/250 000' },
      { label: 'GIS Sol — RMQS, fonds pédo-géochimiques', href: 'https://www.gissol.fr/le-gis/programmes/rmqs-3', note: 'teneurs de fond par maille' },
      { label: 'IGN — photographies aériennes historiques', href: 'https://remonterletemps.ign.fr/', note: 'frise ci-dessous' },
      { label: 'IGN RPG — registre parcellaire graphique', href: 'https://geoservices.ign.fr/rpg' },
    ],
  }
}
