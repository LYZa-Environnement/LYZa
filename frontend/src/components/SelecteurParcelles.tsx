import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import {
  centreEmprise,
  diagonaleM,
  emprisesBounds,
  fetchParcelleAt,
  formatSurface,
  fusionner,
  libelleParcelle,
  surfaceTotale,
  type ParcelleCadastrale,
} from '../lib/cadastre'
import { geopfUrl, IGN_ATTRIBUTION, ORTHO_URL } from '../lib/basemap'
import type { Site } from '../types/site'

const CADASTRE_URL = geopfUrl('CADASTRALPARCELS.PARCELLAIRE_EXPRESS')
const CONTOUR = '#c34a35'

/** Frames the map on the selection, or on the address while nothing is
 * selected. In an effect rather than the render body: re-framing on every
 * render would fight the reader's own panning while they pick parcels. */
function Cadrage({ parcelles, lat, lon }: { parcelles: ParcelleCadastrale[]; lat: number; lon: number }) {
  const map = useMap()
  const cle = parcelles.map((parcelle) => parcelle.idu).join(',')
  const premierCadrage = useRef(true)

  useEffect(() => {
    if (parcelles.length === 0) {
      if (premierCadrage.current) map.setView([lat, lon], 18)
      premierCadrage.current = false
      return
    }
    // Only widen the view when the selection no longer fits: zooming back to
    // the selection after every click would undo a reader who zoomed out to
    // reach the next parcel.
    const fusion = fusionner(parcelles)
    const bounds = fusion ? emprisesBounds(fusion) : null
    if (!bounds) return
    if (premierCadrage.current || !map.getBounds().contains(bounds)) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 })
    premierCadrage.current = false
    // `map` is stable; `cle` stands for the selection's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, map, lat, lon])

  return null
}

function Clics({ onPoint }: { onPoint: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onPoint(event.latlng.lat, event.latlng.lng) })
  return null
}

interface Props {
  /** The geocoded address the reader just picked. */
  site: Site
  /** Called with the site once the selection is validated. */
  onValider: (site: Site) => void
  /** Called when the reader would rather go back to the address field. */
  onAnnuler: () => void
}

export default function SelecteurParcelles({ site, onValider, onAnnuler }: Props) {
  const adresseLat = site.adresseLat ?? site.lat
  const adresseLon = site.adresseLon ?? site.lon
  const [parcelles, setParcelles] = useState<ParcelleCadastrale[]>(site.parcelles ?? [])
  const [chargement, setChargement] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // The parcel under the address is pre-selected, so validating without
  // touching anything is the common, correct case: the reader only intervenes
  // when the site spans several parcels or the geocoder landed next door.
  useEffect(() => {
    if ((site.parcelles?.length ?? 0) > 0) return
    let annule = false
    setChargement(true)
    fetchParcelleAt(adresseLat, adresseLon)
      .then((parcelle) => {
        if (annule) return
        if (parcelle) setParcelles([parcelle])
        else setMessage("Aucune parcelle cadastrale à l'adresse — cliquez sur la carte pour en désigner une, ou continuez avec le point d'adresse.")
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [adresseLat, adresseLon, site.parcelles])

  const basculer = useCallback(async (lat: number, lon: number) => {
    setMessage(null)
    setChargement(true)
    const parcelle = await fetchParcelleAt(lat, lon)
    setChargement(false)
    if (!parcelle) {
      setMessage('Pas de parcelle cadastrale à cet endroit (voirie, domaine public ou commune non couverte par le plan cadastral informatisé).')
      return
    }
    // A second click on a parcel removes it: selecting and deselecting with
    // the same gesture is what a reader expects from a map they draw on.
    setParcelles((precedentes) =>
      precedentes.some((p) => p.idu === parcelle.idu) ? precedentes.filter((p) => p.idu !== parcelle.idu) : [...precedentes, parcelle],
    )
  }, [])

  const fusion = useMemo(() => fusionner(parcelles), [parcelles])
  const surface = surfaceTotale(parcelles)

  const valider = () => {
    if (parcelles.length === 0 || !fusion) {
      onValider({ ...site, parcelles: undefined, emprise: undefined, surfaceM2: undefined, lat: adresseLat, lon: adresseLon, adresseLat, adresseLon })
      return
    }
    const centre = centreEmprise(fusion)
    onValider({
      ...site,
      parcelles,
      emprise: fusion,
      surfaceM2: surface,
      adresseLat,
      adresseLon,
      // Everything downstream reads lat/lon: pointing them at the footprint's
      // centre is what makes the rest of the platform describe the parcels
      // rather than the address point.
      lat: centre ? centre[1] : adresseLat,
      lon: centre ? centre[0] : adresseLon,
    })
  }

  return (
    <section className="section" style={{ borderTop: 'var(--border-w) solid var(--color-border)' }}>
      <div className="container">
        <p className="eyebrow">Emprise du site</p>
        <h2 style={{ marginBottom: '0.3rem' }}>Délimitez le terrain étudié</h2>
        <p className="lede" style={{ marginBottom: '1.5rem' }}>
          La parcelle de l'adresse est présélectionnée. Cliquez sur la carte pour en ajouter d'autres, cliquez à nouveau sur une parcelle
          pour la retirer, puis validez. C'est cette emprise fusionnée qui sera portée sur toutes les cartes et sur les photographies
          aériennes historiques.
        </p>

        <div className="grid grid--2" style={{ alignItems: 'start' }}>
          <div>
            <div style={{ height: '30rem', border: 'var(--border-w) solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <MapContainer center={[adresseLat, adresseLon]} zoom={18} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer url={ORTHO_URL} attribution={IGN_ATTRIBUTION} maxNativeZoom={19} maxZoom={20} />
                <TileLayer url={CADASTRE_URL} attribution={`${IGN_ATTRIBUTION} — PCI Express`} maxNativeZoom={19} maxZoom={20} opacity={0.85} />

                {parcelles.map((parcelle) => (
                  <GeoJSON
                    key={parcelle.idu}
                    data={{ type: 'Feature', geometry: parcelle.geometry, properties: {} } as never}
                    style={{ color: CONTOUR, weight: 2.5, fillColor: CONTOUR, fillOpacity: 0.22 }}
                    interactive={false}
                  />
                ))}

                <Clics onPoint={basculer} />
                <Cadrage parcelles={parcelles} lat={adresseLat} lon={adresseLon} />
              </MapContainer>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.6rem' }}>
              Fond : photographie aérienne et plan cadastral informatisé (PCI Express), Institut national de l'information géographique et
              forestière. {chargement && <strong>Interrogation du cadastre…</strong>}
            </p>
          </div>

          <div>
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Parcelles retenues</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: 0 }}>{site.label}</p>

              {parcelles.length === 0 ? (
                <p style={{ fontSize: '0.9rem', margin: '0.8rem 0 0' }}>
                  Aucune parcelle retenue. Vous pouvez en désigner une sur la carte, ou continuer : l'étude portera alors sur le point
                  d'adresse seul.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.8rem 0 0' }}>
                  {parcelles.map((parcelle) => (
                    <li
                      key={parcelle.idu}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.6rem',
                        padding: '0.45rem 0',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <strong style={{ fontSize: '0.92rem' }}>{libelleParcelle(parcelle)}</strong>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', flex: 1 }}>
                        {parcelle.commune ?? ''}
                        {parcelle.contenanceM2 != null ? ` — ${formatSurface(parcelle.contenanceM2)}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setParcelles((precedentes) => precedentes.filter((p) => p.idu !== parcelle.idu))}
                        aria-label={`Retirer la parcelle ${libelleParcelle(parcelle)}`}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-accent-red)', fontSize: '0.95rem' }}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {parcelles.length > 0 && (
                <p style={{ fontSize: '0.9rem', marginTop: '0.8rem', marginBottom: 0 }}>
                  <strong>{formatSurface(surface)}</strong> au total
                  {parcelles.length > 1 ? ` sur ${parcelles.length} parcelles` : ''}
                  {fusion ? ` — emprise de ${Math.round(diagonaleM(fusion))} m dans sa plus grande dimension` : ''}.
                </p>
              )}

              {message && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-accent-red)', marginBottom: 0 }}>{message}</p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.2rem' }}>
                <button type="button" className="btn" onClick={valider}>
                  {parcelles.length > 0 ? 'Valider cette emprise' : "Continuer sans parcelle"}
                </button>
                <button type="button" className="btn btn--ghost" onClick={onAnnuler}>
                  Changer d'adresse
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '1rem' }}>
              Les surfaces affichées sont les contenances cadastrales, telles qu'enregistrées au plan : elles diffèrent de quelques pour
              cent d'un relevé de géomètre. Le cadastre décrit la propriété foncière, pas l'occupation réelle du sol.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
