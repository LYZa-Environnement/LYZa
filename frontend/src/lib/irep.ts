// IREP — Registre français des émissions polluantes (BRGM/Géorisques).
// The only *documented*, intended way to get this data is a yearly bulk ZIP
// export (files.georisques.fr/irep/<année>.zip) — not usable for a live
// per-address lookup on a static site. Géorisques's own website has a
// per-établissement "Registre des émissions polluantes" page, though, and
// it's backed by a real (if undocumented) JSON API — found by loading that
// page and inspecting its own network calls, then verified directly:
//   - search: .../etablissement/search?nomEtablissement=<nom>&annee=<year>
//   - detail: .../etablissement/<idEtab>
//   - emissions: .../etablissement/<idEtab>/emission
//   - prélèvements d'eau: .../etablissement/<idEtab>/prelevement
//   - déchets produits/traités: .../etablissement/<idEtab>/prodtrait
// (Géorisques's own frontend JS has a bug — it calls "<idEtab>data/emission"
// with a missing slash, which 400s — the working path has no "data" segment
// at all. Confirmed by testing both against the live service.)
//
// The search endpoint also *accepts* a `siret` parameter, but — verified
// live — it's silently ignored: passing a garbage SIRET returns the exact
// same unfiltered 13k+ row count as passing a real one. There is no working
// SIRET-based lookup here. Matching an ICPE (from Géorisques) to its IREP
// record instead goes by établissement name (the search does a real
// substring match — confirmed with "LUBRIZOL" matching "LUBRIZOL FRANCE"),
// disambiguated by commune, since a name alone can match a same-named site
// in a different town (IREP had 3 "LUBRIZOL FRANCE" entries, one per town).
const IREP_BASE = 'https://www.georisques.gouv.fr/webappReport/ws/irep'

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface IrepSearchResult {
  idEtab: number
  nom: string
  nomCommune: string
  cp: string
  codeAPE: string
  designationAPE: string | null
}

export interface IrepYearlyValue {
  annee: number
  quantite: string | null
}

export interface IrepPolluant {
  codePolluant: string
  description: string
  datas: IrepYearlyValue[]
}

export interface IrepEmissionGroup {
  codeRejet: string
  libelleRejet: string
  rejets: IrepPolluant[]
}

export interface IrepEmissions {
  annees: number[]
  groupes: IrepEmissionGroup[]
}

export interface IrepPrelevement {
  libelle: string
  datas: IrepYearlyValue[]
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function toResult(raw: Record<string, unknown>): IrepSearchResult {
  return {
    idEtab: Number(raw.idEtab),
    nom: String(raw.nom ?? ''),
    nomCommune: String(raw.nomCommune ?? ''),
    cp: String(raw.cp ?? ''),
    codeAPE: String(raw.codeAPE ?? ''),
    designationAPE: (raw.designationAPE as string) ?? null,
  }
}

async function searchByName(nom: string, annee: number): Promise<Record<string, unknown>[]> {
  const url = `${IREP_BASE}/etablissement/search?${new URLSearchParams({ nomEtablissement: nom, annee: String(annee), start: '0', size: '15' })}`
  const data = await getJson<{ datas?: Record<string, unknown>[] }>(url)
  return data?.datas ?? []
}

/** Finds this établissement's IREP record by name + commune, if it has
 * one — most ICPE don't declare to IREP (only sites above certain
 * pollution thresholds are required to), so a null return is an expected,
 * honest result, not a failure. Tries the full name first, then just its
 * first word (IREP's own naming can be more/less complete than
 * Géorisques's `raisonSociale`), keeping only a candidate whose commune
 * matches — a name match in the wrong town is a false positive, not a
 * useful result. */
export async function findByNameAndCommune(nom: string, commune: string): Promise<IrepSearchResult | null> {
  if (!nom || !commune) return null
  const year = new Date().getFullYear() - 1
  const targetCommune = normalize(commune)
  const tryQuery = async (query: string): Promise<IrepSearchResult | null> => {
    if (!query.trim()) return null
    const candidates = await searchByName(query, year)
    const match = candidates.find((c) => normalize(String(c.nomCommune ?? '')) === targetCommune)
    return match ? toResult(match) : null
  }
  return (await tryQuery(nom)) ?? (await tryQuery(nom.split(/\s+/)[0]))
}

export async function fetchEmissions(idEtab: number): Promise<IrepEmissions | null> {
  const raw = await getJson<{ annees?: number[]; datas?: { codeRejet: string; libelleRejet: string; rejets: IrepPolluant[] }[] }>(
    `${IREP_BASE}/etablissement/${idEtab}/emission`,
  )
  if (raw === null) return null
  return {
    annees: raw.annees ?? [],
    groupes: (raw.datas ?? []).map((g) => ({ codeRejet: g.codeRejet, libelleRejet: g.libelleRejet, rejets: g.rejets })),
  }
}

export async function fetchPrelevements(idEtab: number): Promise<IrepPrelevement[] | null> {
  const raw = await getJson<{ datas?: IrepPrelevement[] }>(`${IREP_BASE}/etablissement/${idEtab}/prelevement`)
  return raw?.datas ?? null
}

/** Only the most recent year with a non-null, non-zero value — the yearly
 * series is mostly empty cells (a site doesn't necessarily report every
 * pollutant every year), so showing every year would bury the signal. */
export function latestReportedValue(datas: IrepYearlyValue[]): IrepYearlyValue | null {
  const withValue = datas.filter((d) => d.quantite !== null && d.quantite !== '' && d.quantite !== '0')
  if (withValue.length === 0) return null
  return [...withValue].sort((a, b) => b.annee - a.annee)[0]
}
