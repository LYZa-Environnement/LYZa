import { formatDistance } from './geo'
import { countPrelevements, findNearestPiezo, findNearestQualNappe, findNearestRiver } from './hubeau'

export interface HydroNote {
  paragraphs: string[]
}

const INTRO =
  "La vulnérabilité des eaux de surface et souterraines concerne la possibilité qu'une contamination potentielle rejoigne le milieu récepteur, et la sensibilité, le niveau d'importance de tout impact potentiel au droit du site sur le milieu récepteur. La classification (faible, moyenne, forte) ci-dessous provient d'une première appréciation construite à partir des données publiques disponibles pour l'emplacement du site étudié (Hub'Eau, BRGM) — elle ne remplace pas un avis hydrogéologique."

/** Builds a distance-grounded vulnérabilité/sensibilité narrative for the
 * water theme, in the style of a consultant's note: named receptors when
 * known, always with a distance, and an honest "non déterminé" instead of a
 * guessed classification when the underlying data isn't available. */
export async function buildHydroNote(lat: number, lon: number): Promise<HydroNote> {
  const [piezo, qualNappe, river, prelevCount] = await Promise.all([
    findNearestPiezo(lat, lon),
    findNearestQualNappe(lat, lon),
    findNearestRiver(lat, lon),
    countPrelevements(lat, lon, 1000),
  ])

  const paragraphs: string[] = [INTRO]

  const riverLabel = river ? (river.nom ? `la rivière ${river.nom}` : 'le cours d\'eau suivi le plus proche') : null
  const aquifereLabel = qualNappe?.aquifere ? `la nappe des ${qualNappe.aquifere}` : piezo || qualNappe ? 'la nappe souterraine la plus proche' : null
  const receptors = [riverLabel, aquifereLabel].filter((r): r is string => r !== null)
  if (receptors.length > 0) {
    const verb = receptors.length > 1 ? 'sont ici considérés comme les principaux récepteurs' : 'est ici considéré comme le principal récepteur'
    const sentence = `${receptors.join(' et ')} ${verb} d'une contamination potentielle pouvant provenir du site.`
    paragraphs.push(sentence.charAt(0).toUpperCase() + sentence.slice(1))
  }

  // Vulnérabilité hydrologique — distance au cours d'eau suivi le plus proche.
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

  // Vulnérabilité hydrogéologique — profondeur de la nappe au piézomètre le plus proche.
  if (piezo?.profondeurNappeM != null) {
    const depth = piezo.profondeurNappeM
    const niveau = depth < 5 ? 'forte' : depth < 20 ? 'moyenne' : 'faible'
    paragraphs.push(
      `La vulnérabilité hydrogéologique est considérée comme ${niveau}, compte tenu de la profondeur de nappe mesurée au piézomètre le plus proche` +
        ` (à ${formatDistance(piezo.distanceM)} du site) : environ ${depth.toFixed(1)} m.`,
    )
  } else if (piezo) {
    paragraphs.push(
      `Un piézomètre est recensé à ${formatDistance(piezo.distanceM)} du site, mais aucune mesure récente de profondeur de nappe n'y est disponible : la vulnérabilité hydrogéologique n'a pas pu être évaluée.`,
    )
  } else {
    paragraphs.push(
      "La vulnérabilité hydrogéologique n'a pas pu être évaluée : aucun piézomètre n'est recensé dans les bases publiques consultées à proximité du site.",
    )
  }

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
