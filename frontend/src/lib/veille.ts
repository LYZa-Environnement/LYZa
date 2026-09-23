/**
 * Environmental news shown on the home page.
 *
 * The feeds behind it are fetched at build time by `scripts/veille.mjs` and
 * published as a static JSON: none of the sources sends CORS headers, so the
 * browser cannot read them directly. The collection timestamp travels with the
 * articles so the page can say how fresh the list is instead of implying it is
 * live.
 */

export interface ArticleVeille {
  titre: string
  lien: string
  date: string | null
  resume: string | null
  source: string
  siteSource: string | null
}

export interface Veille {
  collecteLe: string | null
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
