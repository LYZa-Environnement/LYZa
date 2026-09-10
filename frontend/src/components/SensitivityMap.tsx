import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import type { AddressResult } from '../types/sensitivity'

interface Props {
  address: AddressResult
  radiusMeters: number
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  map.setView([lat, lon], map.getZoom() < 14 ? 15 : map.getZoom())
  return null
}

export default function SensitivityMap({ address, radiusMeters }: Props) {
  const position: [number, number] = [address.lat, address.lon]

  return (
    <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%', borderRadius: 'var(--radius)' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position} />
      <Circle center={position} radius={radiusMeters} pathOptions={{ color: '#2f5d50', fillOpacity: 0.08 }} />
      <Recenter lat={address.lat} lon={address.lon} />
    </MapContainer>
  )
}
