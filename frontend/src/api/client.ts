import type { AddressResult, SensitivityReport } from '../types/sensitivity'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<AddressResult[]> {
  if (query.trim().length < 3) return []
  const url = `${API_BASE}/geocode?q=${encodeURIComponent(query)}`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Géocodage indisponible (${response.status})`)
  return response.json()
}

export async function fetchSensitivity(address: AddressResult, rayon = 500): Promise<SensitivityReport> {
  const params = new URLSearchParams({
    lat: String(address.lat),
    lon: String(address.lon),
    label: address.label,
    citycode: address.citycode,
    postcode: address.postcode,
    city: address.city,
    rayon: String(rayon),
  })
  const response = await fetch(`${API_BASE}/sensitivity?${params.toString()}`)
  if (!response.ok) throw new Error(`Synthèse indisponible (${response.status})`)
  return response.json()
}
