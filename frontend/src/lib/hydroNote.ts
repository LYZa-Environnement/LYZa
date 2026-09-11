import { formatDistance } from './geo'
import { countPrelevements, findNearestAdesPoint, findNearestRiver } from './hubeau'

export interface HydroNote {
  paragraphs: string[]
}

const INTRO =
  "La vulnérabilité des eaux de surface et souterraines concerne la possibilité qu'une contamination potentielle rejoigne le milieu récepteur, et la sensibilité, le niveau d'importance de tout impact potentiel au droit du site sur le milieu récepteur. La classification (faible, moyenne, forte) ci-dessous provient d'une première appréciation construite à partir des données publiques disponibles pour l'emplacement du site étudié (Hub'Eau, BRGM) — elle ne remplace pas un avis hydrogéologique."

// A water-table depth read at a point beyond this distance says very little
// about the depth at the site itself (local topography/geology can vary a
// lot over a few km) — past it we say so instead of guessing.
const ADES_USABLE_M = 5000
// Below this, the reading is used without caveat; between this and
// ADES_USABLE_M it's used but flagged as a bit distant.
const ADES_RELIABLE_M = 2000

/** Builds a distance-grounded vulnérabilité/sensibilité narrative for the
 * water theme, in the style of a consultant's note: named receptors when
 * known, always with a distance, and an honest "non déterminé" instead of a
 * guessed classification when the underlying data isn't available or the
 * reference point is too far to be representative. */
export async function buildHydroNote(lat: number, lon: number): Promise<HydroNote> {
  const [ades, river, prelevCount] = await Promise.all([findNearestAdesPoint(lat, lon), findNearestRiver(lat, lon), countPrelevements(lat, lon, 1000)])

  const paragraphs: string[] = [INTRO]

  const riverLabel = river ? (river.nom ? `la rivière ${river.nom}` : "le cours d'eau suivi le plus proche") : null
  const aquifereLabel = ades?.aquifere ? `la nappe des ${ades.aquifere}` : ades ? 'la nappe souterraine la plus proche (entité non précisée par le point ADES)' : null
  const receptors = [riverLabel, aquifereLabel].filter((r): r is string => r !== null)
  if (receptors.length > 0) {
    const verb = receptors.length > 1 ? 'sont ici considérés comme les principaux récepteurs' : 'est ici considéré comme le principal récepteur'
    const sentence = `${receptors.join(' et ')} ${verb} d'une contamination potentielle pouvant provenir du site.`
    paragraphs.push(sentence.charAt(0).toUpperCase() + sentence.slice(1))
  }

  // Vulnérabilité hydrologique — distance au cours d'eau suivi le plus proche.
  // (Contrairement à la profondeur de nappe, la distance EST directement la
  // donnée pertinente ici : plus le site en est loin, plus la vulnérabilité
  // est faible, quelle que soit cette distance — pas de seuil de fiabilité.)
  if (river) {
    const niveau = river.distanceM > 1000 ? 'faible' : river.distanceM > 300 ? 'moyenne' : 'forte'
    paragraphs.push(
      `La vulnérabilité hydrologique est considérée comme ${niveau} en raison de la distance du site au cours d'eau suivi le plus proche` +
        `${river.nom ? ` (${river.nom})` : ''} : environ ${formatDistance(river.distanceM)}.`,
    )
  } else {
    paragraphs.push(
      "La vulnérabilité hydrologique n'a pas pu être évaluée : aucune station de suivi de cours d'eau n'est recensée dans les bases publiques consultées à proximité du site.",
    )
  }

  // Sensibilité hydrologique — les usages (pêche, AEP, loisirs...) ne se lisent pas dans ces données.
  paragraphs.push(
    "La sensibilité hydrologique (usages du cours d'eau — pêche, alimentation en eau, loisirs...) ne peut pas être établie de façon fiable à partir des seules données publiques mobilisées ici ; elle nécessite une vérification de terrain ou un avis hydrogéologique.",
  )

  // Vulnérabilité hydrogéologique — profondeur de nappe au point ADES le plus proche,
  // avec un seuil de distance au-delà duquel la mesure n'est plus jugée représentative.
  if (!ades) {
    paragraphs.push(
      "La vulnérabilité hydrogéologique n'a pas pu être évaluée : aucun point ADES (qualité des nappes) n'est recensé dans les bases publiques consultées à proximité du site.",
    )
  } else if (ades.distanceM > ADES_USABLE_M) {
    paragraphs.push(
      `La vulnérabilité hydrogéologique n'a pas pu être évaluée de façon fiable : le point ADES le plus proche` +
        `${ades.aquifere ? ` (${ades.aquifere})` : ''} est situé à ${formatDistance(ades.distanceM)} du site — une distance trop importante pour que sa` +
        ` profondeur de nappe soit représentative de l'hydrogéologie locale.`,
    )
  } else if (ades.profondeurNappeM == null) {
    paragraphs.push(
      `Un point ADES est recensé à ${formatDistance(ades.distanceM)} du site${ades.aquifere ? ` (${ades.aquifere})` : ''}, mais aucune mesure récente de` +
        ` profondeur de nappe n'y est disponible : la vulnérabilité hydrogéologique n'a pas pu être évaluée sur cette base.`,
    )
  } else {
    const depth = ades.profondeurNappeM
    const niveau = depth < 5 ? 'forte' : depth < 20 ? 'moyenne' : 'faible'
    const caveat = ades.distanceM > ADES_RELIABLE_M ? ' — à confirmer, le point de mesure est relativement éloigné du site' : ''
    paragraphs.push(
      `La vulnérabilité hydrogéologique est considérée comme ${niveau}, compte tenu de la profondeur de nappe mesurée au point ADES le plus proche` +
        `${ades.aquifere ? ` (${ades.aquifere})` : ''}, à ${formatDistance(ades.distanceM)} du site : environ ${depth.toFixed(1)} m${caveat}.`,
    )
  }

  // Ce que la profondeur de nappe seule ne dit pas : la nature des terrains traversés.
  paragraphs.push(
    'La perméabilité des couches géologiques traversées entre la surface et la nappe affine directement cette lecture de vulnérabilité, mais ' +
      "elle n'a pas pu être déterminée ici : les données publiques mobilisées par cet outil ne donnent pas accès à une description exploitable " +
      "de la lithologie à cet endroit (un log géologique BSS existe parfois pour un forage proche et peut être consulté manuellement sur " +
      'InfoTerre, BRGM). Cette dimension reste à traiter par un avis hydrogéologique.',
  )

  // Sensibilité hydrogéologique — présence d'ouvrages de prélèvement à proximité.
  if (prelevCount !== null) {
    const niveau = prelevCount === 0 ? 'faible' : prelevCount <= 2 ? 'moyenne' : 'forte'
    paragraphs.push(
      prelevCount === 0
        ? "La sensibilité hydrogéologique est considérée comme faible, compte tenu de l'absence d'ouvrage de prélèvement recensé dans un rayon d'environ 1 km autour du site."
        : `La sensibilité hydrogéologique est considérée comme ${niveau}, compte tenu de ${prelevCount} ouvrage(s) de prélèvement recensé(s) dans un rayon d'environ 1 km autour du site.`,
    )
  } else {
    paragraphs.push(
      "La sensibilité hydrogéologique n'a pas pu être évaluée : les ouvrages de prélèvement à proximité n'ont pas pu être interrogés.",
    )
  }

  paragraphs.push(
    "Cette lecture reste indicative : elle s'appuie sur des données publiques disponibles à distance et ne remplace pas une évaluation réalisée sur site.",
  )

  return { paragraphs }
}
