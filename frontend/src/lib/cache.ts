/**
 * Per-session memo for upstream lookups shared between rubriques.
 *
 * Several sources answer more than one rubrique for the same site — the ICPE
 * list feeds both "qualité de l'air" and "risques", the watercourse network
 * feeds both "eau" and "changements climatiques", the commune's GASPAR risks
 * feed both "changements climatiques" and "risques". Without this, each is
 * fetched twice from the same endpoint within seconds, which is slower for
 * the reader and needlessly heavy on services that rate-limit.
 *
 * The promise is cached, not just the value, so two rubriques loading at once
 * share the one in-flight request. A rejected lookup is evicted so a later
 * rubrique can retry rather than inherit the failure.
 */

const entries = new Map<string, Promise<unknown>>()

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = entries.get(key)
  if (existing) return existing as Promise<T>
  const promise = load().catch((error) => {
    entries.delete(key)
    throw error
  })
  entries.set(key, promise)
  return promise
}

/** Stable cache key for a lookup anchored on a point. Coordinates are rounded
 * to ~1 m so the same geocoded address always hits the same entry. */
export function pointKey(name: string, lat: number, lon: number, ...rest: (string | number)[]): string {
  return [name, lat.toFixed(5), lon.toFixed(5), ...rest].join(':')
}
