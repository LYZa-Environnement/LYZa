import { fetchAirQualite, qualifieIndice } from '../lib/airQualite'
import { fetchSourcesBruit } from '../lib/bruit'
import { cached, pointKey } from '../lib/cache'
import { formatDistance } from '../lib/geo'
import { estSeveso, fetchIcpe } from '../lib/georisques'
import { surveyNearbyParcels } from '../lib/parcelles'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { pluriel, safe, situation } from './common'

const RAYON_M = 3000

const COULEURS = {
  icpe: '#c34a35',
  seveso: '#8c1d0f',
  bruit: '#a3671a',
  parcelle: '#5f8c3a',
}

export async function buildAir(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [air, icpe, bruit, parcelles] = await Promise.all([
    safe(fetchAirQualite(lat, lon)),
    safe(cached(pointKey('icpe', lat, lon, RAYON_M), () => fetchIcpe(lat, lon, RAYON_M))),
    safe(fetchSourcesBruit(lat, lon)),
    safe(cached(pointKey('parcelles', lat, lon), () => surveyNearbyParcels(lat, lon))),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  // ---- Qualité de l'air modélisée ----------------------------------------

  if (air) {
    const indice = air.indiceEuropeen
    indicateurs.push({
      label: 'Indice européen de qualité de l’air',
      value: indice !== null ? `${Math.round(indice)} — ${qualifieIndice(indice)}` : 'Non déterminé',
      situation: `Maille de calcul à ${formatDistance(air.distanceMailleM)} du site`,
      detail: air.heure ? `Modèle CAMS Europe, valeur du ${new Date(air.heure).toLocaleString('fr-FR')}.` : 'Modèle CAMS Europe.',
      level: indice === null ? 'inconnu' : indice < 40 ? 'favorable' : indice < 60 ? 'attention' : 'defavorable',
    })

    for (const polluant of air.polluants) {
      indicateurs.push({
        label: polluant.libelle,
        value: `${polluant.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${polluant.unite}`,
        detail: polluant.reference,
      })
    }

    const pollensActifs = air.pollens.filter((p) => p.valeur > 0)
    if (pollensActifs.length > 0) {
      indicateurs.push({
        label: 'Pollens en suspension',
        value: pollensActifs.map((p) => `${p.libelle.replace('Pollens de ', '').replace('Pollens d’', '')} ${p.valeur.toFixed(1)}`).join(' · '),
        detail: 'Concentrations en grains/m³ modélisées par CAMS.',
        level: 'attention',
      })
    }

    commentaire.push(
      `La qualité de l'air est décrite ici par le modèle européen CAMS, dont la maille la plus proche est située à ` +
        `${formatDistance(air.distanceMailleM)} du site. ` +
        (indice !== null ? `L'indice européen y ressort à ${Math.round(indice)} (${qualifieIndice(indice).toLowerCase()}). ` : '') +
        `Il s'agit d'une modélisation à environ 11 km de résolution, et non d'une mesure : elle décrit un fond régional et ne capte pas les ` +
        `variations locales liées au trafic ou à un émetteur voisin.`,
    )
  } else {
    indicateurs.push({ label: 'Qualité de l’air', value: 'Donnée indisponible', level: 'inconnu' })
  }

  // ---- ICPE et sites SEVESO ----------------------------------------------

  if (icpe) {
    const classees = icpe.items.filter((item) => item.classee && item.localisation)
    const seveso = classees.filter(estSeveso)
    for (const item of classees.slice(0, 80)) {
      const isSeveso = estSeveso(item)
      features.push({
        kind: 'point',
        lat: item.localisation!.lat,
        lon: item.localisation!.lon,
        label: `${item.nom} — ${item.regime}${isSeveso ? ` (${item.seveso})` : ''}`,
        color: isSeveso ? COULEURS.seveso : COULEURS.icpe,
        group: isSeveso ? 'Établissement SEVESO' : 'ICPE',
      })
    }

    const plusProche = [...classees].sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
    indicateurs.push({
      label: 'Installations classées (ICPE) recensées',
      value: classees.length === 0 ? 'Aucune' : pluriel(classees.length, 'installation'),
      situation: plusProche ? `La plus proche ${situation(plusProche.localisation!.distanceM, plusProche.localisation!.direction)}` : undefined,
      detail: plusProche
        ? `${plusProche.nom} — régime ${plusProche.regime}${plusProche.codeNaf ? `, NAF ${plusProche.codeNaf}` : ''}`
        : `Dans un rayon de ${formatDistance(RAYON_M)}.`,
      level: classees.length === 0 ? 'favorable' : plusProche && plusProche.localisation!.distanceM < 500 ? 'attention' : 'favorable',
      href: plusProche?.ficheUrl ?? undefined,
    })

    if (seveso.length > 0) {
      const sevesoProche = [...seveso].sort((a, b) => a.localisation!.distanceM - b.localisation!.distanceM)[0]
      indicateurs.push({
        label: 'Établissements SEVESO',
        value: pluriel(seveso.length, 'établissement'),
        situation: `Le plus proche ${situation(sevesoProche.localisation!.distanceM, sevesoProche.localisation!.direction)}`,
        detail: `${sevesoProche.nom} — statut ${sevesoProche.seveso}`,
        level: 'defavorable',
        href: sevesoProche.ficheUrl ?? undefined,
      })
    }

    if (classees.length > 0 && plusProche) {
      commentaire.push(
        `${pluriel(classees.length, 'installation classée', 'installations classées')} pour la protection de l'environnement ` +
          `${classees.length > 1 ? 'sont recensées' : 'est recensée'} dans un rayon de ${formatDistance(RAYON_M)}, ` +
          `la plus proche ${situation(plusProche.localisation!.distanceM, plusProche.localisation!.direction)}. ` +
          `${seveso.length > 0 ? `${pluriel(seveso.length, 'établissement')} relève${seveso.length > 1 ? 'nt' : ''} du régime SEVESO. ` : ''}` +
          `Leur position par rapport aux vents dominants — visible sur la rose des vents ci-dessous — détermine si le site se trouve sous leur panache habituel.`,
      )
    }
  }

  // ---- Bruit --------------------------------------------------------------

  if (bruit) {
    for (const source of [bruit.route, bruit.fer]) {
      if (!source) continue
      features.push({
        kind: 'point',
        lat: source.lat,
        lon: source.lon,
        label: source.type === 'route' ? `Route — ${source.nom ?? source.categorie ?? 'axe important'}` : `Voie ferrée — ${source.categorie ?? ''}`,
        color: COULEURS.bruit,
        group: 'Infrastructure bruyante',
      })
    }
    indicateurs.push({
      label: 'Axe routier important le plus proche',
      value: bruit.route ? (bruit.route.nom ?? bruit.route.categorie ?? 'Axe structurant') : 'Aucun à moins de 4 km',
      situation: bruit.route ? situation(bruit.route.distanceM, bruit.route.direction) : undefined,
      detail: bruit.route?.categorie ?? undefined,
      level: !bruit.route ? 'favorable' : bruit.route.distanceM < 200 ? 'defavorable' : bruit.route.distanceM < 600 ? 'attention' : 'favorable',
    })
    indicateurs.push({
      label: 'Voie ferrée la plus proche',
      value: bruit.fer ? (bruit.fer.categorie ?? 'Voie ferrée') : 'Aucune à moins de 4 km',
      situation: bruit.fer ? situation(bruit.fer.distanceM, bruit.fer.direction) : undefined,
      level: !bruit.fer ? 'favorable' : bruit.fer.distanceM < 200 ? 'defavorable' : bruit.fer.distanceM < 600 ? 'attention' : 'favorable',
    })
  }

  // ---- Exposition aux pesticides -----------------------------------------

  if (parcelles) {
    const treated = parcelles.nearestTreated
    indicateurs.push({
      label: 'Parcelle agricole potentiellement traitée',
      value: treated ? (treated.inside ? 'Site sur une parcelle cultivée' : treated.cropLabel) : parcelles.anyParcelFound ? 'Uniquement des prairies à proximité' : 'Aucune parcelle agricole à proximité',
      situation: treated && !treated.inside ? situation(treated.distanceM, treated.direction) : undefined,
      detail: treated
        ? `Culture déclarée au registre parcellaire graphique : ${treated.cropLabel} (code ${treated.codeCultu}). Le statut biologique de la parcelle n'est pas vérifiable en données ouvertes.`
        : undefined,
      level: !treated ? 'favorable' : treated.inside || treated.distanceM < 100 ? 'defavorable' : treated.distanceM < 500 ? 'attention' : 'favorable',
    })
    if (treated && !treated.inside && treated.distanceM < 500) {
      commentaire.push(
        `Une parcelle cultivée (${treated.cropLabel}) est déclarée ${situation(treated.distanceM, treated.direction)}. ` +
          `Les cultures hors prairies font généralement l'objet de traitements phytosanitaires, ce qui constitue une source d'exposition par dérive — ` +
          `d'autant plus lorsqu'elle se trouve dans l'axe des vents dominants.`,
      )
    }
  }

  lacunes.push(
    "Aucune mesure de terrain : les concentrations affichées proviennent du modèle CAMS (maille ~11 km), pas d'une station de mesure. Les données de référence françaises (Géod'Air, réseau des AASQA) ne sont pas accessibles par une API ouverte sans compte.",
    "Les niveaux sonores ne sont pas modélisés : les cartes de bruit stratégiques et le classement sonore des infrastructures sont publiés département par département, sans service national interrogeable. Seule la distance aux infrastructures bruyantes est donnée ici.",
    "L'exposition aux pesticides est approchée par la proximité de parcelles cultivées (RPG) : ni les produits épandus, ni les dates de traitement, ni la certification biologique ne sont accessibles en données ouvertes.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      { label: 'Open-Meteo / CAMS Europe — qualité de l’air', href: 'https://open-meteo.com/en/docs/air-quality-api', note: 'modèle européen, maille ~11 km' },
      { label: 'Géorisques — installations classées', href: 'https://www.georisques.gouv.fr/risques/installations', note: 'ICPE et statut SEVESO' },
      { label: 'IGN BD TOPO® — routes et voies ferrées', href: 'https://geoservices.ign.fr/bdtopo', note: 'proximité des infrastructures bruyantes' },
      { label: 'IGN RPG — registre parcellaire graphique', href: 'https://geoservices.ign.fr/rpg', note: 'cultures déclarées à la PAC' },
      { label: 'Open-Meteo — archive ERA5 (rose des vents)', href: 'https://open-meteo.com/en/docs/historical-weather-api' },
    ],
  }
}
