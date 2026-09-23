/**
 * Whether the commune is on the national list of those that must adapt to
 * coastal erosion.
 *
 * Source: Cerema / Géolittoral, layer "Communes devant s'adapter à l'érosion
 * du littoral (liste fixée par décret)". The service is an ArcGIS REST
 * endpoint that sends no CORS headers (verified), so it cannot be queried from
 * the browser; the list is small and fixed by decree, so it is shipped as a
 * static file generated from that service — the same approach already used for
 * the drinking-water protection perimeters.
 *
 * The list changes only when the decree is revised, at which point the file
 * needs regenerating.
 */

export interface CommuneErosion {
  nom: string | null
  statut: string | null
  /** Légifrance permalink to the decree fixing the list. */
  decret: string | null
}

interface Fichier {
  decret?: string
  communes?: Record<string, { nom?: string; statut?: string }>
}

let chargement: Promise<Fichier | null> | null = null

function charger(): Promise<Fichier | null> {
  if (!chargement) {
    chargement = fetch(`${import.meta.env.BASE_URL}data/erosion-littoral.json`)
      .then((response) => (response.ok ? (response.json() as Promise<Fichier>) : null))
      .catch(() => null)
  }
  return chargement
}

/** Returns null when the commune is not on the list, and undefined-like
 * behaviour is avoided: a failed load throws so `safe()` reports it as
 * unavailable rather than as "not concerned". */
export async function fetchCommuneErosion(codeInsee: string): Promise<CommuneErosion | null> {
  const fichier = await charger()
  if (!fichier) throw new Error('liste érosion indisponible')
  const entree = fichier.communes?.[codeInsee]
  if (!entree) return null
  return { nom: entree.nom ?? null, statut: entree.statut ?? null, decret: fichier.decret ?? null }
}
