/**
 * Reference ranges for total trace-element contents in French soils, from the
 * ASPITET programme (INRA, D. Baize) — "Apports d'une Stratification Pédologique
 * pour l'Interprétation des Teneurs en Éléments Traces".
 *
 * These are observed ranges, not regulatory limits, and nothing here should be
 * read as a threshold: ASPITET describes what is commonly found in French
 * soils of all textures, what is found where the parent rock is naturally
 * enriched, and what is found in the strongest natural anomalies (metal-rich
 * zones, ferralitic palaeosols, "argiles à chailles", amphibolite weathering…).
 * A content sitting in the second or third range therefore points first to
 * geology, not to contamination.
 *
 * Values in mg/kg of fine earth (< 2 mm), covering several soil horizons and
 * not only ploughed topsoil.
 */

export interface GammeAspitet {
  /** Upper bound of the range commonly observed in "ordinary" soils. */
  ordinaireMax: number
  /** Bounds of the moderate natural anomaly range. The ranges published by
   * ASPITET do not join up — arsenic runs to 25 then restarts at 30 — so the
   * lower bounds are kept too, and a value falling in a gap is reported as
   * sitting between two ranges rather than being pushed into the upper one. */
  anomalieModereeMin?: number
  anomalieModereeMax?: number
  /** Bounds of the strong natural anomaly range. */
  anomalieForteMin?: number
  anomalieForteMax?: number
  /** The range as written in the source, for display. */
  libelleOrdinaire: string
  libelleModeree?: string
  libelleForte?: string
}

export const ASPITET: Record<string, GammeAspitet> = {
  As: { anomalieModereeMin: 30, anomalieForteMin: 60, ordinaireMax: 25, anomalieModereeMax: 60, anomalieForteMax: 284, libelleOrdinaire: '1,0 à 25', libelleModeree: '30 à 60', libelleForte: '60 à 284' },
  Cd: { anomalieModereeMin: 0.7, anomalieForteMin: 2.0, ordinaireMax: 0.45, anomalieModereeMax: 2, anomalieForteMax: 16, libelleOrdinaire: '0,05 à 0,45', libelleModeree: '0,70 à 2,0', libelleForte: '2,0 à 16,0' },
  Cr: { anomalieModereeMin: 90, anomalieForteMin: 150, ordinaireMax: 90, anomalieModereeMax: 150, anomalieForteMax: 3180, libelleOrdinaire: '10 à 90', libelleModeree: '90 à 150', libelleForte: '150 à 3 180' },
  Co: { anomalieModereeMin: 23, anomalieForteMin: 105, ordinaireMax: 23, anomalieModereeMax: 90, anomalieForteMax: 148, libelleOrdinaire: '2 à 23', libelleModeree: '23 à 90', libelleForte: '105 à 148' },
  Cu: { anomalieModereeMin: 20, anomalieForteMin: 65, ordinaireMax: 20, anomalieModereeMax: 62, anomalieForteMax: 102, libelleOrdinaire: '2 à 20', libelleModeree: '20 à 62', libelleForte: '65 à 102' },
  Hg: { ordinaireMax: 0.1, libelleOrdinaire: '0,02 à 0,10' },
  Ni: { anomalieModereeMin: 60, anomalieForteMin: 130, ordinaireMax: 60, anomalieModereeMax: 130, anomalieForteMax: 2076, libelleOrdinaire: '2 à 60', libelleModeree: '60 à 130', libelleForte: '130 à 2 076' },
  Pb: { anomalieModereeMin: 60, anomalieForteMin: 100, ordinaireMax: 50, anomalieModereeMax: 90, anomalieForteMax: 3000, libelleOrdinaire: '9 à 50', libelleModeree: '60 à 90', libelleForte: '100 à 3 000' },
  Se: { anomalieModereeMin: 0.8, anomalieForteMin: 2.0, ordinaireMax: 0.7, anomalieModereeMax: 2, anomalieForteMax: 4.5, libelleOrdinaire: '0,10 à 0,70', libelleModeree: '0,8 à 2,0', libelleForte: '2,0 à 4,5' },
  Tl: { anomalieModereeMin: 2.5, anomalieForteMin: 7.0, ordinaireMax: 1.7, anomalieModereeMax: 4.4, anomalieForteMax: 55, libelleOrdinaire: '0,10 à 1,7', libelleModeree: '2,5 à 4,4', libelleForte: '7,0 à 55,0' },
  Zn: { anomalieModereeMin: 100, anomalieForteMin: 250, ordinaireMax: 100, anomalieModereeMax: 250, anomalieForteMax: 3800, libelleOrdinaire: '10 à 100', libelleModeree: '100 à 250', libelleForte: '250 à 3 800' },
}

export type SituationAspitet =
  | 'ordinaire'
  /** Above the ordinary range but below the moderate-anomaly range — ASPITET
   * describes nothing in that interval. */
  | 'entre-gammes'
  | 'anomalie-moderee'
  | 'anomalie-forte'
  | 'au-dela'
  | 'sans-reference'

export interface LectureAspitet {
  situation: SituationAspitet
  /** One sentence placing the value against the ASPITET ranges. */
  commentaire: string
  gamme?: GammeAspitet
}

export function situerDansAspitet(symbole: string, valeur: number): LectureAspitet {
  const gamme = ASPITET[symbole]
  if (!gamme) {
    return {
      situation: 'sans-reference',
      commentaire: "Cet élément ne figure pas dans les gammes de référence ASPITET : aucune comparaison n'est proposée.",
    }
  }

  const reference = `Gamme couramment observée dans les sols « ordinaires » de France : ${gamme.libelleOrdinaire} mg/kg.`

  if (valeur <= gamme.ordinaireMax) {
    return { situation: 'ordinaire', gamme, commentaire: `Valeur comprise dans la gamme couramment observée dans les sols « ordinaires » de France (${gamme.libelleOrdinaire} mg/kg).` }
  }
  // No anomaly ranges published for this element (mercury): say only what is
  // known — that the value is above the ordinary range.
  if (gamme.anomalieModereeMax === undefined) {
    return {
      situation: 'au-dela',
      gamme,
      commentaire: `Valeur au-dessus de la gamme couramment observée dans les sols « ordinaires » de France (${gamme.libelleOrdinaire} mg/kg). ASPITET ne publie pas de gamme d'anomalie naturelle pour cet élément.`,
    }
  }
  if (gamme.anomalieModereeMin !== undefined && valeur < gamme.anomalieModereeMin) {
    return {
      situation: 'entre-gammes',
      gamme,
      commentaire: `Valeur légèrement au-dessus de la gamme couramment observée dans les sols « ordinaires » de France (${gamme.libelleOrdinaire} mg/kg), sans atteindre celle des anomalies naturelles modérées (${gamme.libelleModeree} mg/kg).`,
    }
  }
  if (gamme.anomalieForteMin !== undefined && gamme.anomalieModereeMax !== undefined && valeur > gamme.anomalieModereeMax && valeur < gamme.anomalieForteMin) {
    return {
      situation: 'anomalie-moderee',
      gamme,
      commentaire: `Valeur entre la gamme des anomalies naturelles modérées (${gamme.libelleModeree} mg/kg) et celle des fortes anomalies (${gamme.libelleForte} mg/kg). ${reference}`,
    }
  }
  if (gamme.anomalieModereeMax !== undefined && valeur <= gamme.anomalieModereeMax) {
    return {
      situation: 'anomalie-moderee',
      gamme,
      commentaire: `Valeur au-dessus de la gamme ordinaire, dans celle observée en cas d'anomalie naturelle modérée (${gamme.libelleModeree} mg/kg). ${reference}`,
    }
  }
  if (gamme.anomalieForteMax !== undefined && valeur <= gamme.anomalieForteMax) {
    return {
      situation: 'anomalie-forte',
      gamme,
      commentaire: `Valeur dans la gamme observée en cas de forte anomalie naturelle (${gamme.libelleForte} mg/kg), typiquement liée à la nature de la roche mère. ${reference}`,
    }
  }
  return {
    situation: 'au-dela',
    gamme,
    commentaire: `Valeur au-delà des gammes décrites par ASPITET, y compris celles des fortes anomalies naturelles. ${reference}`,
  }
}

/** Colour a reading takes from where it sits in the ASPITET ranges. A content
 * in the ordinary range reads as unremarkable; the anomaly ranges are flagged
 * because they warrant an explanation, geological or otherwise — not because a
 * limit has been crossed. */
export function niveauAspitet(situation: SituationAspitet): 'favorable' | 'attention' | 'defavorable' | undefined {
  if (situation === 'ordinaire') return 'favorable'
  if (situation === 'entre-gammes' || situation === 'anomalie-moderee') return 'attention'
  if (situation === 'anomalie-forte' || situation === 'au-dela') return 'defavorable'
  return undefined
}
