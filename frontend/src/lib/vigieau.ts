// VigiEau — ministère de la Transition écologique — niveau de restriction
// d'eau en vigueur à une adresse. Vérifié en direct : GET /api/zones?lat&lon
// renvoie un tableau de zones d'alerte (une par type d'eau concerné), pas
// une seule valeur — un site peut par exemple être en "alerte renforcée"
// pour les eaux superficielles et seulement en "vigilance" pour l'eau
// potable, d'où le tableau plutôt qu'un objet unique.
const VIGIEAU_BASE = 'https://api.vigieau.beta.gouv.fr'

export type NiveauGravite = 'vigilance' | 'alerte' | 'alerte_renforcee' | 'crise'
export type ZoneType = 'AEP' | 'SOU' | 'SUP'

export interface VigieauUsage {
  id: number
  thematique: string
  nom: string
  description: string
  concerneParticulier: boolean
  concerneEntreprise: boolean
  concerneCollectivite: boolean
  concerneExploitation: boolean
}

export interface VigieauArrete {
  id: number
  dateDebutValidite: string
  dateFinValidite: string
  cheminFichier: string
  cheminFichierArreteCadre: string
}

export interface VigieauZone {
  id: number
  nom: string
  code: string
  type: ZoneType
  niveauGravite: NiveauGravite
  departement: string
  arrete: VigieauArrete
  usages: VigieauUsage[]
}

const GRAVITE_ORDER: Record<NiveauGravite, number> = {
  vigilance: 0,
  alerte: 1,
  alerte_renforcee: 2,
  crise: 3,
}

export const GRAVITE_LABEL: Record<NiveauGravite, string> = {
  vigilance: 'Vigilance',
  alerte: 'Alerte',
  alerte_renforcee: 'Alerte renforcée',
  crise: 'Crise',
}

export const TYPE_LABEL: Record<ZoneType, string> = {
  SUP: 'Eaux superficielles',
  SOU: 'Eaux souterraines',
  AEP: 'Eau potable',
}

/** Returns null on any failure (network, non-2xx, unexpected shape) — the
 * caller shows an honest "indisponible" message rather than a fabricated
 * absence of restrictions. An empty array is a real, meaningful result
 * (no zone d'alerte active here), distinct from null. */
export async function fetchRestrictions(lat: number, lon: number): Promise<VigieauZone[] | null> {
  try {
    const url = `${VIGIEAU_BASE}/api/zones?${new URLSearchParams({ lat: String(lat), lon: String(lon) })}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data)) return null
    return data as VigieauZone[]
  } catch {
    return null
  }
}

export function sortBySeverityDesc(zones: VigieauZone[]): VigieauZone[] {
  return [...zones].sort((a, b) => GRAVITE_ORDER[b.niveauGravite] - GRAVITE_ORDER[a.niveauGravite])
}

export function worstGravite(zones: VigieauZone[]): NiveauGravite | null {
  if (zones.length === 0) return null
  return sortBySeverityDesc(zones)[0].niveauGravite
}
