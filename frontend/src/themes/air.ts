import { fetchAirQualite, niveauIndice, qualifieIndice } from '../lib/airQualite'
import { fetchSourcesBruit } from '../lib/bruit'
import { cached, pointKey } from '../lib/cache'
import { cardinalLabelFr, formatDistance } from '../lib/geo'
import { surveyNearbyParcels } from '../lib/parcelles'
import { dominantDirections, fetchWindRose } from '../lib/wind'
import type { Indicator, MapFeature, Site, ThemeReport } from '../types/site'
import { safe, situation } from './common'

const RAYON_M = 3000

const COULEURS = {
  bruit: '#a3671a',
  aerodrome: '#8c1d0f',
  parcelle: '#5f8c3a',
}

/** Whether a compass point falls in the half-circle the wind blows from — the
 * test for "is this source upwind of the site". 8-point sectors are 45° wide,
 * so anything within 67° of a dominant sector is treated as in its axis. */
function dansAxeDesVents(directionSource: string, directionsDominantes: string[]): boolean {
  const ANGLES: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 }
  const ANGLES_16: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSO: 202.5, SO: 225, OSO: 247.5, O: 270, ONO: 292.5, NO: 315, NNO: 337.5,
  }
  const source = ANGLES[directionSource]
  if (source === undefined) return false
  return directionsDominantes.some((dominante) => {
    const vent = ANGLES_16[dominante]
    if (vent === undefined) return false
    const ecart = Math.abs(((source - vent + 540) % 360) - 180)
    return 180 - ecart <= 67
  })
}

export async function buildAir(site: Site): Promise<ThemeReport> {
  const { lat, lon } = site
  const [air, bruit, parcelles, rose] = await Promise.all([
    safe(fetchAirQualite(lat, lon)),
    safe(fetchSourcesBruit(lat, lon)),
    safe(cached(pointKey('parcelles', lat, lon), () => surveyNearbyParcels(lat, lon))),
    safe(cached(pointKey('vents', lat, lon), () => fetchWindRose(lat, lon))),
  ])

  const commentaire: string[] = []
  const indicateurs: Indicator[] = []
  const features: MapFeature[] = []
  const lacunes: string[] = []

  const ventsDominants = rose ? dominantDirections(rose, 3) : []
  const directionsDominantes = ventsDominants.map((v) => v.direction)

  // ---- Qualité de l'air : moyennes annuelles ------------------------------

  if (air) {
    indicateurs.push({
      label: 'Indice européen de qualité de l’air',
      value: air.indiceActuel !== null ? `${Math.round(air.indiceActuel)} — ${qualifieIndice(air.indiceActuel)}` : 'Non déterminé',
      situation: 'Mesure instantanée (heure en cours)',
      detail: air.heureActuelle
        ? `Valeur modélisée du ${new Date(air.heureActuelle).toLocaleString('fr-FR')}. À la différence des moyennes ci-dessous, elle varie d'heure en heure et ne caractérise pas le site.`
        : undefined,
      level: air.indiceActuel === null ? 'inconnu' : niveauIndice(air.indiceActuel),
    })

    for (const polluant of air.polluants) {
      indicateurs.push({
        label: polluant.libelle,
        value: `${polluant.moyenneAnnuelle.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${polluant.unite}`,
        situation: `Moyenne annuelle ${air.annee} — maximum horaire ${polluant.maxHoraire.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${polluant.unite}`,
        detail: polluant.note,
        level: polluant.niveau,
      })
    }

    const depassements = air.polluants.filter((p) => p.niveau === 'defavorable')
    const auDessusOms = air.polluants.filter((p) => p.niveau === 'attention')
    commentaire.push(
      `Les concentrations ci-dessous sont des moyennes sur l'année ${air.annee} entière, calculées à partir des 8 760 valeurs horaires du modèle ` +
        `européen CAMS, dont la maille la plus proche est à ${formatDistance(air.distanceMailleM)} du site. Une moyenne annuelle est ce à quoi ` +
        `les valeurs limites réglementaires se rapportent, et elle caractérise un lieu — contrairement à une valeur instantanée, qui dépend surtout du temps qu'il fait.`,
    )
    commentaire.push(
      depassements.length > 0
        ? `${depassements.map((p) => p.libelle).join(', ')} dépasse${depassements.length > 1 ? 'nt' : ''} la valeur limite annuelle européenne.`
        : auDessusOms.length > 0
          ? `Aucune valeur limite européenne n'est dépassée. ${auDessusOms.map((p) => p.libelle).join(', ')} ${auDessusOms.length > 1 ? 'dépassent' : 'dépasse'} en revanche la ligne directrice de l'OMS, plus stricte et non contraignante.`
          : `Aucune valeur limite européenne ni ligne directrice de l'OMS n'est dépassée en moyenne annuelle.`,
    )
    commentaire.push(
      `Il s'agit d'une modélisation à environ 11 km de résolution, et non d'une mesure : elle décrit un fond régional et ne capte ni le surcroît lié ` +
        `à un axe routier proche, ni le panache d'un émetteur voisin.`,
    )
  } else {
    indicateurs.push({ label: 'Qualité de l’air', value: 'Donnée indisponible', level: 'inconnu' })
  }

  // ---- Bruit --------------------------------------------------------------

  if (bruit) {
    if (bruit.aerodrome) {
      features.push({
        kind: 'point',
        lat: bruit.aerodrome.lat,
        lon: bruit.aerodrome.lon,
        label: `Aérodrome — ${bruit.aerodrome.nom}`,
        color: COULEURS.aerodrome,
        group: 'Aérodrome avec PEB',
      })
      const proche = bruit.aerodrome.distanceM < 10000
      indicateurs.push({
        label: "Plan d'exposition au bruit (aérodrome)",
        value: proche ? bruit.aerodrome.nom : 'Aucun aérodrome à moins de 10 km',
        situation: situation(bruit.aerodrome.distanceM, bruit.aerodrome.direction),
        detail: proche
          ? "Un PEB est opposable : il restreint la constructibilité dans ses zones. Vérifier si la parcelle tombe dans l'une d'elles sur l'arrêté."
          : `L'aérodrome doté d'un PEB le plus proche est ${bruit.aerodrome.nom}.`,
        level: bruit.aerodrome.distanceM < 3000 ? 'defavorable' : proche ? 'attention' : 'favorable',
        href: bruit.aerodrome.arreteUrl ?? undefined,
      })
    }

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
      detail: bruit.route ? `${bruit.route.categorie ?? ''} — distance, pas niveau sonore.` : undefined,
      level: !bruit.route ? 'favorable' : bruit.route.distanceM < 200 ? 'defavorable' : bruit.route.distanceM < 600 ? 'attention' : 'favorable',
    })
    indicateurs.push({
      label: 'Voie ferrée la plus proche',
      value: bruit.fer ? (bruit.fer.categorie ?? 'Voie ferrée') : 'Aucune à moins de 4 km',
      situation: bruit.fer ? situation(bruit.fer.distanceM, bruit.fer.direction) : undefined,
      level: !bruit.fer ? 'favorable' : bruit.fer.distanceM < 200 ? 'defavorable' : bruit.fer.distanceM < 600 ? 'attention' : 'favorable',
    })
  }

  // ---- Exposition aux pesticides par dérive -------------------------------

  if (parcelles) {
    const treated = parcelles.nearestTreated
    if (treated) {
      const dansAxe = treated.direction !== null && dansAxeDesVents(treated.direction, directionsDominantes)
      indicateurs.push({
        label: 'Parcelle agricole potentiellement traitée',
        value: treated.inside ? 'Site sur une parcelle cultivée' : treated.cropLabel,
        situation: treated.inside ? 'Le site est situé sur la parcelle' : situation(treated.distanceM, treated.direction),
        detail:
          `Culture déclarée au registre parcellaire graphique : ${treated.cropLabel} (code ${treated.codeCultu}). ` +
          (treated.inside
            ? ''
            : dansAxe
              ? `Elle se trouve dans l'axe des vents dominants (${directionsDominantes.map(cardinalLabelFr).join(', ')}) : le site est sous le vent de cette parcelle une bonne partie de l'année, ce qui accroît l'exposition par dérive. `
              : directionsDominantes.length > 0
                ? `Elle n'est pas dans l'axe des vents dominants (${directionsDominantes.map(cardinalLabelFr).join(', ')}) : le site est moins souvent sous le vent de cette parcelle. `
                : '') +
          "Le statut biologique de la parcelle n'est pas vérifiable en données ouvertes.",
        level: treated.inside || treated.distanceM < 100 ? 'defavorable' : dansAxe && treated.distanceM < 500 ? 'defavorable' : treated.distanceM < 500 ? 'attention' : 'favorable',
      })
      if (!treated.inside && treated.distanceM < 1000) {
        commentaire.push(
          `Une parcelle cultivée (${treated.cropLabel}) est déclarée ${situation(treated.distanceM, treated.direction)}. ` +
            `Les cultures hors prairies font généralement l'objet de traitements phytosanitaires, dont une fraction dérive hors de la parcelle. ` +
            (dansAxe
              ? `Cette parcelle est dans l'axe des vents dominants : la dérive porte vers le site plus souvent que sa seule distance ne le suggère.`
              : directionsDominantes.length > 0
                ? `Cette parcelle n'est pas dans l'axe des vents dominants, ce qui réduit la fréquence des épisodes de dérive vers le site.`
                : ''),
        )
      }
    } else {
      indicateurs.push({
        label: 'Parcelle agricole potentiellement traitée',
        value: parcelles.anyParcelFound ? 'Uniquement des prairies à proximité' : 'Aucune parcelle agricole à proximité',
        detail: 'Les prairies permanentes et temporaires reçoivent rarement des traitements phytosanitaires.',
        level: 'favorable',
      })
    }
  }

  lacunes.push(
    "Aucune mesure de terrain : les concentrations proviennent du modèle CAMS (maille ~11 km), pas d'une station de mesure. Les données de référence françaises (Géod'Air, réseau des AASQA) ne sont pas accessibles par une API ouverte sans compte.",
    "Les niveaux sonores routiers et ferroviaires ne sont pas modélisés : les cartes de bruit stratégiques et le classement sonore des infrastructures sont publiés département par département, sans service national interrogeable. Seuls le PEB des aérodromes — qui est national et opposable — et la distance aux infrastructures sont donnés ici.",
    "L'exposition aux pesticides est approchée par la proximité de parcelles cultivées (RPG) croisée avec les vents dominants : ni les produits épandus, ni les dates de traitement, ni la certification biologique ne sont accessibles en données ouvertes.",
  )

  return {
    commentaire,
    indicateurs,
    features,
    lacunes,
    rayonM: RAYON_M,
    sources: [
      {
        label: 'Open-Meteo / CAMS Europe — qualité de l’air',
        href: 'https://open-meteo.com/en/docs/air-quality-api',
        note: 'modèle européen, maille ~11 km, moyennes annuelles recalculées ici',
      },
      { label: 'Directive 2008/50/CE — valeurs limites', href: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32008L0050', note: 'seuils réglementaires annuels' },
      { label: 'OMS — lignes directrices qualité de l’air 2021', href: 'https://www.who.int/publications/i/item/9789240034228' },
      { label: 'DGAC — plans d’exposition au bruit des aérodromes', href: 'https://www.geoportail.gouv.fr/donnees/plan-dexposition-au-bruit-peb', note: 'couche nationale, arrêtés en ligne' },
      { label: 'IGN BD TOPO® — routes et voies ferrées', href: 'https://geoservices.ign.fr/bdtopo' },
      { label: 'IGN RPG — registre parcellaire graphique', href: 'https://geoservices.ign.fr/rpg', note: 'cultures déclarées à la PAC' },
      { label: 'Open-Meteo — archive ERA5 (rose des vents)', href: 'https://open-meteo.com/en/docs/historical-weather-api' },
    ],
  }
}
