import { useState } from 'react'
import AddressSearch from '../components/AddressSearch'
import SensitivityMap from '../components/SensitivityMap'
import { findNearestAdesPoint, type AdesReferencePoint } from '../lib/hubeau'
import { dischargeTrend, fetchRecentDischarge, findNearestHydrometryStation, type DischargePoint, type HydrometryStation } from '../lib/hydrometrie'
import { GRAVITE_LABEL, TYPE_LABEL, fetchRestrictions, sortBySeverityDesc, type NiveauGravite, type VigieauZone } from '../lib/vigieau'
import type { AddressResult } from '../types/sensitivity'

const RADIUS_M = 1500

function adesFicheUrl(codeBss: string): string {
  return `https://ades.eaufrance.fr/Fiche/PtEau?Code=${encodeURIComponent(codeBss.split('/')[0])}#mesures_graphiques`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const EXEMPLES = [
  {
    titre: 'Réduire les pertes du réseau d’eau potable',
    texte:
      "Le Plan Eau national vise un rendement moyen de 85 % (90 % en zone de répartition des eaux). Sectorisation, télérelève et recherche de fuites ciblée permettent de localiser les secteurs qui en perdent le plus et de prioriser les travaux.",
    href: 'https://www.info.gouv.fr/grand-dossier/preservons-notre-ressource-en-eau/les-53-mesures-du-plan-eau',
    source: 'Plan Eau — 53 mesures, info.gouv.fr',
  },
  {
    titre: 'Engager le patrimoine et les services publics',
    texte:
      "Le « Défi Sobriété -10 % d’Eau » (ministère de la Transition écologique et AMORCE) accompagne les collectivités dans un état des lieux de leur consommation, puis un plan d’actions sur leur patrimoine et leurs services, avec un objectif national de -10 % des prélèvements d’ici 2030.",
    href: 'https://www.ecologie.gouv.fr/presse/sarah-el-hairy-lassociation-amorce-lancent-defi-sobriete-10-deau-destination-collectivites',
    source: 'Ministère de la Transition écologique',
  },
  {
    titre: 'Gérer différemment les espaces verts',
    texte:
      "Arrosage raisonné (heures fraîches, paillage), choix d’essences adaptées au climat local et abandon du fleurissement le plus consommateur en eau — plusieurs collectivités engagées dans le Défi Sobriété ont commencé par leurs espaces publics avant d’élargir.",
    href: 'https://agirpourlatransition.ademe.fr/collectivites/conseils/elus/sobriete',
    source: 'ADEME — Agir pour la transition',
  },
  {
    titre: 'Récupérer et réutiliser l’eau',
    texte:
      "Récupération des eaux pluviales sur les bâtiments et équipements municipaux (arrosage, lavage de voirie) et, sous conditions réglementaires, réutilisation des eaux usées traitées (REUT) pour des usages non domestiques.",
    href: 'https://www.info.gouv.fr/grand-dossier/preservons-notre-ressource-en-eau/les-53-mesures-du-plan-eau',
    source: 'Plan Eau — 53 mesures, info.gouv.fr',
  },
  {
    titre: 'Désimperméabiliser et infiltrer',
    texte:
      "Limiter le ruissellement direct vers les réseaux (parkings, cours d’école, voiries) au profit d’une infiltration sur place favorise la recharge des nappes superficielles et réduit les pointes de rejet lors des épisodes pluvieux.",
    href: null,
    source: null,
  },
  {
    titre: 'Sensibiliser et tarifer',
    texte:
      "Communication ciblée auprès des usagers (particuliers, entreprises, exploitations agricoles) et tarification progressive incitant aux économies, en complément — pas à la place — des actions sur le patrimoine public.",
    href: 'https://amorce.asso.fr/defi-sobriete-eau-10-des-collectivites',
    source: 'AMORCE',
  },
]

const GRAVITE_STYLE: Record<NiveauGravite, { color: string; bg: string }> = {
  vigilance: { color: '#a3671a', bg: '#f6ecd9' },
  alerte: { color: '#c9711f', bg: '#faead9' },
  alerte_renforcee: { color: '#c34a35', bg: '#f7e3dd' },
  crise: { color: '#7a1f1f', bg: '#f0d9d9' },
}

function GraviteBadge({ niveau }: { niveau: NiveauGravite }) {
  const style = GRAVITE_STYLE[niveau]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.3em 0.8em',
        borderRadius: 999,
        border: '1.5px solid currentColor',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: style.color,
        background: style.bg,
      }}
    >
      {GRAVITE_LABEL[niveau]}
    </span>
  )
}

function ZoneCard({ zone }: { zone: VigieauZone }) {
  const thematiques = Array.from(new Set(zone.usages.map((u) => u.thematique)))
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <GraviteBadge niveau={zone.niveauGravite} />
        <span className="badge badge--indeterminee">{TYPE_LABEL[zone.type]}</span>
      </div>
      <h3 style={{ marginBottom: '0.3rem' }}>{zone.nom}</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
        Arrêté en vigueur du {formatDate(zone.arrete.dateDebutValidite)} au {formatDate(zone.arrete.dateFinValidite)} — département{' '}
        {zone.departement}.
      </p>
      {zone.usages.length > 0 && (
        <details style={{ marginTop: '0.8rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}>Usages concernés ({zone.usages.length})</summary>
          <div style={{ marginTop: '0.8rem', display: 'grid', gap: '1rem' }}>
            {thematiques.map((thematique) => (
              <div key={thematique}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>{thematique}</p>
                <ul style={{ marginTop: 0, marginBottom: 0 }}>
                  {zone.usages
                    .filter((u) => u.thematique === thematique)
                    .map((u) => (
                      <li key={u.id} style={{ fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                        <strong>{u.nom}</strong> — {u.description}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
      <p style={{ marginTop: '0.8rem', marginBottom: 0 }}>
        <a href={zone.arrete.cheminFichier} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>
          Voir l'arrêté (PDF) →
        </a>
      </p>
    </div>
  )
}

function DischargeSparkline({ points }: { points: DischargePoint[] }) {
  const W = 280
  const H = 70
  const PAD = 6
  if (points.length < 2) return null
  const values = points.map((p) => p.debitLs)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - 2 * PAD)
    const y = PAD + (1 - (p.debitLs - min) / span) * (H - 2 * PAD)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', marginTop: '0.6rem' }} role="img" aria-label="Débit moyen journalier récent">
      <polyline points={coords.join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth={1.8} />
    </svg>
  )
}

function GroundwaterCard({ ades }: { ades: AdesReferencePoint | null }) {
  if (!ades) {
    return (
      <div className="card">
        <p className="eyebrow">Eaux souterraines</p>
        <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>Aucun point de suivi ADES exploitable n'a été trouvé à proximité.</p>
      </div>
    )
  }
  return (
    <div className="card">
      <p className="eyebrow">Eaux souterraines</p>
      <h3 style={{ marginBottom: '0.3rem' }}>{ades.aquifere ?? 'Entité hydrogéologique non précisée'}</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
        Point de suivi le plus proche — {Math.round(ades.distanceM)} m {ades.direction}
        {ades.nature ? `, ${ades.nature.toLowerCase()}` : ''}.
      </p>
      {ades.profondeurNappeM !== null ? (
        <p style={{ marginBottom: '0.4rem' }}>
          Dernier niveau mesuré : <strong>{ades.profondeurNappeM} m</strong>
          {ades.dateMesure ? ` (${formatDate(ades.dateMesure)})` : ''}
        </p>
      ) : ades.profondeurOuvrageM !== null ? (
        <p style={{ color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
          Profondeur de l'ouvrage (indicatif, pas une mesure de niveau) : {ades.profondeurOuvrageM} m
        </p>
      ) : (
        <p style={{ color: 'var(--color-muted)', marginBottom: '0.4rem' }}>Aucune mesure de niveau disponible pour ce point.</p>
      )}
      <p style={{ marginTop: '0.6rem', marginBottom: 0 }}>
        <a href={adesFicheUrl(ades.codeBss)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.88rem' }}>
          Chronique complète sur ADES →
        </a>
      </p>
    </div>
  )
}

function SurfaceWaterCard({ station, points }: { station: HydrometryStation | null; points: DischargePoint[] | null }) {
  if (!station) {
    return (
      <div className="card">
        <p className="eyebrow">Eaux superficielles</p>
        <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>Aucune station hydrométrique en service n'a été trouvée à proximité.</p>
      </div>
    )
  }
  const trend = points ? dischargeTrend(points) : null
  const latest = points && points.length > 0 ? points[points.length - 1] : null
  return (
    <div className="card">
      <p className="eyebrow">Eaux superficielles</p>
      <h3 style={{ marginBottom: '0.3rem' }}>{station.coursEau ?? station.libelle}</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
        Station {station.libelle} — {Math.round(station.distanceM)} m {station.direction}
      </p>
      {latest ? (
        <>
          <p style={{ marginBottom: '0.2rem' }}>
            Débit moyen journalier le plus récent : <strong>{(latest.debitLs / 1000).toFixed(2)} m³/s</strong> ({formatDate(latest.date)})
          </p>
          {trend && (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', marginBottom: 0 }}>
              Tendance sur 30 jours : {trend.trend === 'baisse' ? 'en baisse' : trend.trend === 'hausse' ? 'en hausse' : 'stable'} (
              {trend.changePct > 0 ? '+' : ''}
              {trend.changePct.toFixed(0)} %)
            </p>
          )}
          {points && <DischargeSparkline points={points} />}
        </>
      ) : (
        <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>Débit récent indisponible pour cette station.</p>
      )}
    </div>
  )
}

export default function EauQuantitative() {
  const [address, setAddress] = useState<AddressResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [ades, setAdes] = useState<AdesReferencePoint | null>(null)
  const [station, setStation] = useState<HydrometryStation | null>(null)
  const [discharge, setDischarge] = useState<DischargePoint[] | null>(null)
  const [zones, setZones] = useState<VigieauZone[] | null>(null)
  const [restrictionsError, setRestrictionsError] = useState(false)

  async function handleSelect(selected: AddressResult) {
    setAddress(selected)
    setAdes(null)
    setStation(null)
    setDischarge(null)
    setZones(null)
    setRestrictionsError(false)
    setLoading(true)
    try {
      const [adesPoint, nearestStation, restrictions] = await Promise.all([
        findNearestAdesPoint(selected.lat, selected.lon),
        findNearestHydrometryStation(selected.lat, selected.lon),
        fetchRestrictions(selected.lat, selected.lon),
      ])
      setAdes(adesPoint)
      setStation(nearestStation)
      if (restrictions === null) {
        setRestrictionsError(true)
      } else {
        setZones(sortBySeverityDesc(restrictions))
      }
      if (nearestStation) {
        const series = await fetchRecentDischarge(nearestStation.codeStation)
        setDischarge(series)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div className="container">
        <p className="eyebrow">Pour les collectivités</p>
        <h1>Eau quantitative — ressource et sobriété</h1>
        <p className="lede">
          Un état de la ressource en eau (souterraine et superficielle), les arrêtés de restriction en vigueur, et des
          exemples concrets pour réduire les consommations sur un territoire — construit à partir des bases de
          données publiques (Hub'Eau, VigiEau).
        </p>

        <section style={{ marginTop: '2.5rem' }}>
          <p className="eyebrow">Exemples pour réduire les consommations</p>
          <h2>Des leviers déjà mobilisés par des collectivités</h2>
          <div className="grid grid--3" style={{ marginTop: '1.5rem' }}>
            {EXEMPLES.map((ex) => (
              <div className="card" key={ex.titre}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>{ex.titre}</h3>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>{ex.texte}</p>
                {ex.href && (
                  <a href={ex.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>
                    {ex.source} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: '3rem' }}>
          <p className="eyebrow">Diagnostiquer un territoire</p>
          <h2>État des ressources et arrêtés en vigueur</h2>
          <p style={{ color: 'var(--color-muted)', maxWidth: '46rem' }}>
            Renseignez une adresse (mairie, siège de la collectivité) pour situer le territoire et afficher la
            ressource la plus proche, en eau souterraine comme en eau superficielle.
          </p>
          <div style={{ maxWidth: '34rem', margin: '1.5rem 0 2rem' }}>
            <AddressSearch onSelect={handleSelect} />
          </div>

          {!address && <p style={{ color: 'var(--color-muted)' }}>Commencez par saisir une adresse ci-dessus.</p>}
          {loading && <p>Analyse en cours…</p>}

          {address && !loading && (
            <>
              <div className="grid grid--2" style={{ alignItems: 'start', marginBottom: '2rem' }}>
                <div style={{ height: '20rem' }}>
                  <SensitivityMap address={address} radiusMeters={RADIUS_M} />
                </div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <GroundwaterCard ades={ades} />
                  <SurfaceWaterCard station={station} points={discharge} />
                </div>
              </div>

              <h3 style={{ marginBottom: '0.6rem' }}>Arrêtés de restriction en vigueur</h3>
              {restrictionsError && (
                <p style={{ color: 'var(--level-elevee)' }}>
                  Les restrictions n'ont pas pu être récupérées pour cette adresse. Vous pouvez réessayer dans un instant.
                </p>
              )}
              {zones !== null &&
                (zones.length === 0 ? (
                  <p style={{ color: 'var(--color-muted)' }}>Aucune zone de restriction n'est actuellement en vigueur à cette adresse d'après VigiEau.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {zones.map((zone) => (
                      <ZoneCard key={`${zone.id}-${zone.type}`} zone={zone} />
                    ))}
                  </div>
                ))}

              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                Sources : Hub'Eau (ADES, hydrométrie), VigiEau (ministère de la Transition écologique). Cette lecture
                ne remplace pas l'arrêté préfectoral, seul document opposable, ni un diagnostic technique du
                territoire.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
