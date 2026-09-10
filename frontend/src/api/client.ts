import { geocodeAddress as geocodeAddressLocal } from '../lib/geocode'
import { buildSensitivityReport } from '../lib/synthesis'
import type { AddressResult, SensitivityReport } from '../types/sensitivity'

// Runs entirely in the browser — no backend. Geocoding (BAN) and the
// sensitivity synthesis (Géorisques) call the public APIs directly, the
// same way frontend/public/lyza-cartes.html does.

export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<AddressResult[]> {
  return geocodeAddressLocal(query, signal)
}

export async function fetchSensitivity(address: AddressResult, rayon = 1000): Promise<SensitivityReport> {
  return buildSensitivityReport(address, rayon)
}
