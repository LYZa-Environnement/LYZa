import { useState } from 'react'
import AddressSearch from '../components/AddressSearch'
import WindRoseChart from '../components/WindRoseChart'
import { fetchIcpe, type IcpeItem } from '../lib/georisques'
import { fetchEmissions, fetchPrelevements, findByNameAndCommune, latestReportedValue, type IrepEmissions, type IrepPrelevement, type IrepSearchResult } from '../lib/irep'
import { dominantDirections, fetchWindRose, type WindRose } from '../lib/wind'
import type { AddressResult } from '../types/sensitivity'

const RADIUS_OPTIONS = [500, 1000, 2000, 5000]
const MAX_IREP_LOOKUPS = 20

interface IcpeWithEmissions {
  icpe: IcpeItem
  irep: IrepSearchResult | null
  emissions: IrepEmissions | null
  prelevements: IrepPrelevement[] | null
}

async function enrichWithIrep(icpe: IcpeItem): Promise<IcpeWithEmissions> {
  const irep = await findByNameAndCommune(icpe.nom, icpe.commune)
  if (!irep) return { icpe, irep: null, emissions: null, prelevements: null }
  const [emissions, prelevements] = await Promise.all([fetchEmissions(irep.idEtab), fetchPrelevements(irep.idEtab)])
  return { icpe, irep, emissions, prelevements }
}

function EmissionsDetail({ emissions, prelevements }: { emissions: IrepEmissions | null; prelevements: IrepPrelevement[] | null }) {
  const hasEmissions = emissions && emissions.groupes.some((g) => g.rejets.length > 0)
  const prelevementsWithValues = (prelevements ?? []).filter((p) => latestReportedValue(p.datas) !== null)

  if (!hasEmissions && prelevementsWithValues.length === 0) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem' }}>Aucune quantité de rejet ou de prélèvement déclarée récemment.</p>
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {emissions?.groupes.map((groupe) => {
        const rows = groupe.rejets
          .map((r) => ({ ...r, latest: latestReportedValue(r.datas) }))
          .filter((r) => r.latest !== null)
        if (rows.length === 0) return null
        return (
          <div key={groupe.codeRejet}>
            <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>Rejets — {groupe.libelleRejet}</p>
            <ul style={{ marginTop: 0, marginBottom: 0 }}>
              {rows.map((r) => (
                <li key={r.codePolluant} style={{ fontSize: '0.88rem' }}>
                  {r.description} : <strong>{r.latest!.quantite}</strong> ({r.latest!.annee})
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {prelevementsWithValues.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>Prélèvements d'eau</p>
          <ul style={{ marginTop: 0, marginBottom: 0 }}>
            {prelevementsWithValues.map((p) => {
              const latest = latestReportedValue(p.datas)!
              return (
                <li key={p.libelle} style={{ fontSize: '0.88rem' }}>
                  {p.libelle.replace(/_/g, ' ')} : <strong>{latest.quantite} m³</strong> ({latest.annee})
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function IcpeCard({ entry }: { entry: IcpeWithEmissions }) {
  const { icpe, irep, emissions, prelevements } = entry
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        {icpe.seveso && (
          <span className="badge badge--elevee" style={{ fontSize: '0.7rem' }}>
            {icpe.seveso}
          </span>
        )}
        <span className="badge badge--indeterminee" style={{ fontSize: '0.7rem' }}>
          {icpe.regime}
        </span>
        {irep && (
          <span className="badge badge--moderee" style={{ fontSize: '0.7rem' }}>
            Déclare au registre des émissions
          </span>
        )}
      </div>
      <h3 style={{ marginBottom: '0.2rem' }}>{icpe.nom}</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
        {icpe.commune}
        {icpe.localisation && ` — ${Math.round(icpe.localisation.distanceM)} m ${icpe.localisation.direction}`}
      </p>

      {irep ? (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}>Émissions et rejets déclarés</summary>
          <div style={{ marginTop: '0.8rem' }}>
            <EmissionsDetail emissions={emissions} prelevements={prelevements} />
          </div>
        </details>
      ) : (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', marginBottom: 0 }}>
          Ne déclare pas au registre des émissions polluantes (IREP) — seuls les sites dépassant certains seuils y sont
          tenus.
        </p>
      )}

      {icpe.ficheUrl && (
        <p style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          <a href={icpe.ficheUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.88rem' }}>
            Fiche installation (Géorisques) →
          </a>
        </p>
      )}
    </div>
  )
}

export default function IcpeEmissions() {
  const [address, setAddress] = useState<AddressResult | null>(null)
  const [rayon, setRayon] = useState(2000)
  const [entries, setEntries] = useState<IcpeWithEmissions[] | null>(null)
  const [windRose, setWindRose] = useState<WindRose | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(selected: AddressResult) {
    setAddress(selected)
    setEntries(null)
    setWindRose(null)
    setError(null)
    setLoading(true)
    try {
      const [icpeResult, rose] = await Promise.all([fetchIcpe(selected.lat, selected.lon, rayon), fetchWindRose(selected.lat, selected.lon)])
      setWindRose(rose)
      if (icpeResult === null) {
        setError("Les installations classées n'ont pas pu être récupérées pour cette adresse. Vous pouvez réessayer.")
        return
      }
      const sorted = [...icpeResult.items].sort((a, b) => (a.localisation?.distanceM ?? Infinity) - (b.localisation?.distanceM ?? Infinity))
      const toEnrich = sorted.slice(0, MAX_IREP_LOOKUPS)
      const enriched = await Promise.all(toEnrich.map(enrichWithIrep))
      const rest = sorted.slice(MAX_IREP_LOOKUPS).map((icpe) => ({ icpe, irep: null, emissions: null, prelevements: null }))
      setEntries([...enriched, ...rest])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Outil gratuit</p>
        <h1>ICPE, rose des vents et émissions déclarées</h1>
        <p className="lede">
          Renseignez une adresse : les installations classées à proximité, celles qui déclarent des rejets au registre
          des émissions polluantes (IREP) — avec leurs quantités les plus récentes — et la rose des vents du secteur,
          pour situer d'où vient (et où va) l'air qui les traverse.
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap', marginTop: '2rem' }}>
          <div style={{ flex: '1 1 20rem' }}>
            <AddressSearch onSelect={handleSelect} />
          </div>
          <label style={{ fontSize: '0.9rem' }}>
            Rayon de recherche
            <select
              value={rayon}
              onChange={(e) => setRayon(Number(e.target.value))}
              style={{
                display: 'block',
                marginTop: '0.35rem',
                padding: '0.55rem 0.7rem',
                border: 'var(--border-w) solid var(--color-border)',
                borderRadius: 'var(--radius)',
              }}
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p style={{ color: 'var(--color-muted)', marginTop: '1.5rem' }}>Recherche en cours…</p>}
        {error && <p style={{ color: 'var(--level-elevee)', marginTop: '1.5rem' }}>{error}</p>}

        {address && !loading && (
          <div className="grid grid--2" style={{ marginTop: '2rem', alignItems: 'start' }}>
            <div className="card">
              <h3 style={{ textAlign: 'center' }}>Rose des vents</h3>
              {windRose ? (
                <>
                  <WindRoseChart rose={windRose} />
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem' }}>
                    Vents dominants ({windRose.year}) :{' '}
                    {dominantDirections(windRose)
                      .map((d) => `${d.direction} (${Math.round(d.share * 100)} %)`)
                      .join(', ')}
                  </p>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                    Réanalyse météorologique (Open-Meteo / ERA5), pas une mesure de station officielle — indicatif.
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--color-muted)', textAlign: 'center' }}>Données de vent indisponibles pour cette zone.</p>
              )}
            </div>

            <div>
              {entries === null ? null : entries.length === 0 ? (
                <p style={{ color: 'var(--color-muted)' }}>Aucune installation classée recensée dans ce rayon.</p>
              ) : (
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                  {entries.map((entry, i) => (
                    <IcpeCard key={`${entry.icpe.nom}-${i}`} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {address && (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '2.5rem' }}>
            Sources : Géorisques (installations classées), registre des émissions polluantes IREP (BRGM/Géorisques),
            Open-Meteo (vent). Les émissions affichées sont les dernières valeurs déclarées par l'exploitant, pas une
            mesure indépendante.
          </p>
        )}
      </div>
    </div>
  )
}
