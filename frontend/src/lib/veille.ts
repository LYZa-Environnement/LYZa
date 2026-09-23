/**
 * Environmental news shown on the home page.
 *
 * The feeds behind it are fetched at build time by `scripts/veille.mjs` and
 * published as a static JSON: none of the sources sends CORS headers, so the
 * browser cannot read them directly. The collection timestamp travels with the
 * articles so the page can say how fresh the list is instead of implying it is
 * live.
 */

/** The four reading angles the watch is sorted into. The build writes the
 * labels alongside the articles so the page never has to hardcode a list that
 * could drift from the one the collector actually used. */
export type CategorieVeille = 'science' | 'politique' | 'international' | 'innovation'

export interface ArticleVeille {
  titre: string
  lien: string
  date: string | null
  resume: string | null
  source: string
  siteSource: string | null
  categorie: CategorieVeille
  /** 'en' for a source published in English, so the page can warn the reader
   * before they follow the link. */
  langue: string
}

export interface Veille {
  collecteLe: string | null
  categories: Record<string, string>
  articles: ArticleVeille[]
}

let chargement: Promise<Veille | null> | null = null

export function fetchVeille(): Promise<Veille | null> {
  if (!chargement) {
    chargement = fetch(`${import.meta.env.BASE_URL}data/veille.json`)
      .then((response) => (response.ok ? (response.json() as Promise<Veille>) : null))
      .catch(() => null)
  }
  return chargement
}
