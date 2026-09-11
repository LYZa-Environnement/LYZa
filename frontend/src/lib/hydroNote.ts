import { findNearestBathingSite } from './baignade'
import { formatDistance } from './geo'
import { countPrelevements, findNearestAdesPoint } from './hubeau'
import { findNearestRiverSegment } from './hydrography'
import { findNearestPpe } from './ppe'

export interface HydroParagraph {
  text: string
  linkLabel?: string
  linkHref?: string
}

export interface HydroNote {
  paragraphs: HydroParagraph[]
}

const INTRO =
  "La vulnérabilité des eaux de surface et souterraines concerne la possibilité qu'une contamination potentielle rejoigne le milieu récepteur, et la sensibilité, le niveau d'importance de tout impact potentiel au droit du site sur le milieu récepteur. La classification (faible, moyenne, forte) ci-dessous provient d'une première appréciation construite à partir des données publiques disponibles pour l'emplacement du site étudié (IGN, Hub'Eau, BRGM) — elle ne remplace pas un avis hydrogéologique."

// A water-table depth read at a point beyond this distance says very little
// about the depth at the site itself (local topography/geology can vary a
// lot over a few km) — past it we say so instead of guessing.
const ADES_USABLE_M = 5000
// Below this, the reading is used without caveat; between this and
// ADES_USABLE_M it's used but flagged as a bit distant.
const ADES_RELIABLE_M = 2000

function adesReference(codeBss: string): string {
  return `réf. BSS/ADES ${codeBss}`
}

function adesUrl(codeBss: string): string {
  // Same URL pattern as frontend/public/lyza-cartes.html's adesUrl().
  return `https://ades.eaufrance.fr/Fiche/PtEau?Code=${encodeURIComponent(codeBss.split('/')[0])}#mesures_graphiques`
}

/** Builds a distance-grounded vulnérabilité/sensibilité narrative for the
 * water theme, in the style of a consultant's note: named receptors when
 * known, always with a distance, and an honest "non déterminé" instead of a
 * guessed classification when the underlying data isn't available or the
 * reference point is too far to be representative. */
export async function buildHydroNote(lat: number, lon: number): Promise<HydroNote> {
  const [ades, river, prelevCount, ppe, bathing] = await Promise.all([
    findNearestAdesPoint(lat, lon),
    findNearestRiverSegment(lat, lon),
    countPrelevements(lat, lon, 1000),
    findNearestPpe(lat, lon),
    findNearestBathingSite(lat, lon),
  ])

  const paragraphs: HydroParagraph[] = [{ text: INTRO }]

  const riverLabel = river ? (river.nom ? `la rivière ${river.nom}` : "le cours d'eau le plus proche") : null
  const aquifereLabel = ades?.aquifere ? `la nappe des ${ades.aquifere}` : ades ? 'la nappe souterraine la plus proche (entité non précisée par le point ADES)' : null
  const receptors = [riverLabel, aquifereLabel].filter((r): r is string => r !== null)
  if (receptors.length > 0) {
    const verb = receptors.length > 1 ? 'sont ici considérés comme les principaux récepteurs' : 'est ici considéré comme le principal récepteur'
    const sentence = `${receptors.join(' et ')} ${verb} d'une contamination potentielle pouvant provenir du site.`
    paragraphs.push({ text: sentence.charAt(0).toUpperCase() + sentence.slice(1) })
  }

  // Vulnérabilité hydrologique — distance réelle au cours d'eau (tracé BD TOPO),
  // pas à une station de suivi qui peut se trouver à des kilomètres du cours d'eau réel.
  if (river) {
    const niveau = river.distanceM > 250 ? 'faible' : river.distanceM > 150 ? 'moyenne' : 'forte'
    paragraphs.push({
      text:
        `La vulnérabilité hydrologique est considérée comme ${niveau} en raison de la distance du site au cours d'eau le plus proche` +
        `${river.nom ? ` (${river.nom})` : ''} : environ ${formatDistance(river.distanceM)}.`,
    })
  } else {
    paragraphs.push({
      text: "La vulnérabilité hydrologique n'a pas pu être évaluée : aucun cours d'eau n'est recensé dans les bases publiques consultées à proximité du site.",
    })
  }

  // Sensibilité hydrologique — seul signal national fiable trouvé : les sites de baignade
  // officiels (base Ministère de la Santé). Aucune base nationale ouverte n'existe pour la
  // pêche de loisir ou les bases nautiques (voir baignade.ts) : Hub'Eau "État piscicole" est
  // un suivi scientifique par pêche électrique, pas un inventaire des usages récréatifs.
  if (bathing) {
    const niveau = bathing.distanceM <= 1000 ? 'forte' : bathing.distanceM <= 3000 ? 'moyenne' : 'faible'
    paragraphs.push({
      text:
        `La sensibilité hydrologique est considérée comme ${niveau} : le site de baignade officiel le plus proche` +
        `${bathing.nom ? ` (${bathing.nom}${bathing.commune ? `, ${bathing.commune}` : ''})` : ''} se trouve à environ ${formatDistance(bathing.distanceM)}` +
        `${bathing.typeEau ? ` (${bathing.typeEau})` : ''}. Aucune base de données nationale ouverte n'a en revanche été identifiée pour les activités de pêche de` +
        ' loisir ou les bases nautiques : ces usages doivent être vérifiés sur le terrain ou auprès de la fédération de pêche locale.',
    })
  } else {
    paragraphs.push({
      text:
        "Aucun site de baignade officiel recensé (base du Ministère de la Santé) n'a été trouvé à proximité du site, ce qui ne permet cependant pas d'exclure" +
        " d'autres usages sensibles du cours d'eau (pêche, activités nautiques) : aucune base de données nationale ouverte n'existe pour ces usages, une" +
        ' vérification de terrain reste nécessaire pour établir la sensibilité hydrologique.',
    })
  }

  // Vulnérabilité hydrogéologique — profondeur de nappe au point ADES le plus proche,
  // avec un seuil de distance au-delà duquel la mesure n'est plus jugée représentative.
  if (!ades) {
    paragraphs.push({
      text: "La vulnérabilité hydrogéologique n'a pas pu être évaluée : aucun point ADES (qualité des nappes) n'est recensé dans les bases publiques consultées à proximité du site.",
    })
  } else if (ades.distanceM > ADES_USABLE_M) {
    paragraphs.push({
      text:
        `La vulnérabilité hydrogéologique n'a pas pu être évaluée de façon fiable : le point ADES le plus proche` +
        `${ades.aquifere ? ` (${ades.aquifere})` : ''}, ${adesReference(ades.codeBss)}, est situé à ${formatDistance(ades.distanceM)} du site — une` +
        ` distance trop importante pour que sa profondeur de nappe soit représentative de l'hydrogéologie locale.`,
      linkLabel: 'Voir ce point sur ADES',
      linkHref: adesUrl(ades.codeBss),
    })
  } else if (ades.profondeurNappeM == null && ades.profondeurOuvrageM != null) {
    // Pas de mesure de niveau d'eau, mais la profondeur de l'ouvrage lui-même reste
    // une indication indirecte utile (le forage ne descend généralement pas beaucoup
    // plus bas que ce qu'il cherche à capter) — signalée comme telle, pas comme une
    // mesure de profondeur de nappe.
    const depth = ades.profondeurOuvrageM
    const caveat = ades.distanceM > ADES_RELIABLE_M ? ' — à confirmer, le point est relativement éloigné du site' : ''
    paragraphs.push({
      text:
        `Aucune mesure récente de profondeur de nappe n'est disponible au point ADES le plus proche` +
        `${ades.aquifere ? ` (${ades.aquifere})` : ''}, ${adesReference(ades.codeBss)}, à ${formatDistance(ades.distanceM)} du site ; à titre indicatif,` +
        ` l'ouvrage associé a une profondeur de ${depth.toFixed(1)} m${caveat}, ce qui ne renseigne qu'indirectement sur la profondeur de la nappe et ne` +
        ' permet pas de classification fiable de la vulnérabilité hydrogéologique sur cette seule base.',
      linkLabel: 'Voir ce point sur ADES',
      linkHref: adesUrl(ades.codeBss),
    })
  } else if (ades.profondeurNappeM == null) {
    paragraphs.push({
      text:
        `Un point ADES est recensé à ${formatDistance(ades.distanceM)} du site${ades.aquifere ? ` (${ades.aquifere})` : ''}, ${adesReference(ades.codeBss)},` +
        ` mais aucune mesure récente de profondeur de nappe n'y est disponible : la vulnérabilité hydrogéologique n'a pas pu être évaluée sur cette base.`,
      linkLabel: 'Voir ce point sur ADES',
      linkHref: adesUrl(ades.codeBss),
    })
  } else {
    const depth = ades.profondeurNappeM
    const niveau = depth < 5 ? 'forte' : depth < 15 ? 'moyenne' : 'faible'
    const caveat = ades.distanceM > ADES_RELIABLE_M ? ' — à confirmer, le point de mesure est relativement éloigné du site' : ''
    paragraphs.push({
      text:
        `La vulnérabilité hydrogéologique est considérée comme ${niveau}, compte tenu de la profondeur de nappe mesurée au point ADES le plus proche` +
        `${ades.aquifere ? ` (${ades.aquifere})` : ''}, ${adesReference(ades.codeBss)}, à ${formatDistance(ades.distanceM)} du site : environ` +
        ` ${depth.toFixed(1)} m${caveat}.`,
      linkLabel: 'Voir la chronique de ce point sur ADES',
      linkHref: adesUrl(ades.codeBss),
    })
  }

  // Ce que la profondeur de nappe seule ne dit pas : la nature des terrains traversés.
  paragraphs.push({
    text:
      'La perméabilité des couches géologiques traversées entre la surface et la nappe module directement cette lecture de vulnérabilité (des ' +
      'terrains peu perméables au droit du site réduisent la vulnérabilité même avec une nappe peu profonde, et inversement), mais elle ' +
      "n'a pas pu être déterminée ici : les données publiques mobilisées par cet outil ne donnent pas accès à une description exploitable de " +
      'la lithologie à cet endroit (un log géologique BSS existe parfois pour un forage proche et peut être consulté manuellement sur ' +
      'InfoTerre, BRGM). Cette dimension reste à traiter par un avis hydrogéologique.',
  })

  // Périmètre de protection éloignée le plus proche et captage associé.
  if (ppe) {
    const distanceLabel = ppe.inside
      ? "le site est situé à l'intérieur de ce périmètre"
      : `à environ ${formatDistance(ppe.distanceM)}${ppe.direction ? ` au ${ppe.direction === 'N' ? 'nord' : ppe.direction}` : ''} du site`
    const captagePart = ppe.captageRef ? ` Il est associé au captage ${ppe.captageRef}${ppe.etatProcedure ? ` (${ppe.etatProcedure})` : ''}.` : ''
    paragraphs.push({
      text: `Le périmètre de protection éloignée le plus proche${ppe.codePp ? ` (réf. ${ppe.codePp})` : ''} se trouve ${distanceLabel}.${captagePart}`,
      linkLabel: ppe.adesUrl ? 'Voir le captage sur ADES' : undefined,
      linkHref: ppe.adesUrl ?? undefined,
    })
  } else {
    paragraphs.push({
      text: "Aucun périmètre de protection éloignée n'a pu être identifié à proximité du site dans l'export public mobilisé ici.",
    })
  }

  // Sensibilité hydrogéologique — présence d'ouvrages de prélèvement à proximité.
  if (prelevCount !== null) {
    const niveau = prelevCount === 0 ? 'faible' : prelevCount <= 2 ? 'moyenne' : 'forte'
    paragraphs.push({
      text:
        prelevCount === 0
          ? "La sensibilité hydrogéologique est considérée comme faible, compte tenu de l'absence d'ouvrage de prélèvement recensé dans un rayon d'environ 1 km autour du site."
          : `La sensibilité hydrogéologique est considérée comme ${niveau}, compte tenu de ${prelevCount} ouvrage(s) de prélèvement recensé(s) dans un rayon d'environ 1 km autour du site.`,
    })
  } else {
    paragraphs.push({
      text: "La sensibilité hydrogéologique n'a pas pu être évaluée : les ouvrages de prélèvement à proximité n'ont pas pu être interrogés.",
    })
  }

  paragraphs.push({
    text: "Cette lecture reste indicative : elle s'appuie sur des données publiques disponibles à distance et ne remplace pas une évaluation réalisée sur site.",
  })

  return { paragraphs }
}
