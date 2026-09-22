/**
 * Communal drinking-water quality, from Hub'Eau's "Qualité de l'eau potable"
 * API (résultats du contrôle sanitaire — ARS). Field names verified live
 * against commune 44109: `v1/qualite_eau_potable/resultats_dis?code_commune=`
 * returns one row per parameter, newest first with `sort=desc`, carrying
 * `code_prelevement`, `libelle_parametre`, `resultat_alphanumerique`,
 * `libelle_unite`, `reference_qualite_parametre`, `nom_uge`, and the
 * sampling's verdicts.
 *
 * Conformity is recorded per *sampling*, not per parameter — there is no
 * per-row conformity flag — and it is split two ways, which this keeps
 * separate because they do not mean the same thing: `limites de qualité` are
 * the health-binding thresholds, `références de qualité` are indicative ones
 * whose breach is not in itself a health non-compliance.
 *
 * The API is national but organised by commune, not by address: a large
 * commune can be served by several networks, so the UI labels the reading
 * "commune" and names the network the sampling came from.
 */

const BASE = 'https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis'

export interface ParametreDis {
  libelle: string
  valeur: string | null
  unite: string | null
  reference: string | null
}

export interface EauPotableReport {
  datePrelevement: string | null
  nomUdi: string | null
  nomCommune: string | null
  /** Verdict recorded for the sampling, verbatim from the ARS. */
  conclusion: string | null
  conformiteLimitesBact: boolean | null
  conformiteLimitesChimie: boolean | null
  conformiteReferencesBact: boolean | null
  conformiteReferencesChimie: boolean | null
  parametres: ParametreDis[]
  nombreParametres: number
}

function str(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

function conformity(value: unknown): boolean | null {
  const s = str(value)
  if (s === null) return null
  const normalized = s.trim().toUpperCase()
  if (normalized === 'C') return true
  if (normalized === 'N' || normalized === 'S') return false
  return null
}

/** True when every binding (limite de qualité) verdict that was recorded came
 * back conforme — null when none was recorded at all. */
export function limitesRespectees(report: EauPotableReport): boolean | null {
  const flags = [report.conformiteLimitesBact, report.conformiteLimitesChimie].filter((f): f is boolean => f !== null)
  return flags.length === 0 ? null : flags.every(Boolean)
}

export async function fetchEauPotable(codeCommune: string): Promise<EauPotableReport | null> {
  if (!codeCommune) return null
  try {
    const url = new URL(BASE)
    url.searchParams.set('code_commune', codeCommune)
    url.searchParams.set('sort', 'desc')
    url.searchParams.set('size', '200')
    const response = await fetch(url.toString())
    if (!response.ok && response.status !== 206) return null
    const json = (await response.json()) as { data?: Record<string, unknown>[] }
    const rows = Array.isArray(json.data) ? json.data : []
    if (rows.length === 0) return null

    // Rows come back newest-first; keep only the most recent sampling so the
    // parameter list describes one coherent analysis rather than a mixture of
    // readings taken months apart.
    const latest = str(rows[0].code_prelevement)
    const sampling = rows.filter((row) => str(row.code_prelevement) === latest)
    const head = sampling[0]

    const parametres: ParametreDis[] = sampling.map((row) => ({
      libelle: str(row.libelle_parametre) ?? 'Paramètre',
      valeur: str(row.resultat_alphanumerique) ?? str(row.resultat_numerique),
      unite: str(row.libelle_unite),
      reference: str(row.reference_qualite_parametre) ?? str(row.limite_qualite_parametre),
    }))

    return {
      datePrelevement: str(head.date_prelevement),
      nomUdi: str(head.nom_uge) ?? str(head.nom_distributeur),
      nomCommune: str(head.nom_commune),
      conclusion: str(head.conclusion_conformite_prelevement),
      conformiteLimitesBact: conformity(head.conformite_limites_bact_prelevement),
      conformiteLimitesChimie: conformity(head.conformite_limites_pc_prelevement),
      conformiteReferencesBact: conformity(head.conformite_references_bact_prelevement),
      conformiteReferencesChimie: conformity(head.conformite_references_pc_prelevement),
      parametres,
      nombreParametres: new Set(parametres.map((p) => p.libelle)).size,
    }
  } catch {
    return null
  }
}
