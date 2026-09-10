import { useEffect, useRef, useState } from 'react'
import { geocodeAddress } from '../api/client'
import type { AddressResult } from '../types/sensitivity'

interface Props {
  onSelect: (address: AddressResult) => void
}

export default function AddressSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AddressResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const selectedLabelRef = useRef<string | null>(null)

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    if (query === selectedLabelRef.current) {
      return
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setError(null)
      try {
        const found = await geocodeAddress(query, controller.signal)
        setResults(found)
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError("La recherche d'adresse est momentanément indisponible.")
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div style={{ position: 'relative' }}>
      <label htmlFor="address-search" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
        Adresse du site
      </label>
      <input
        id="address-search"
        type="text"
        autoComplete="off"
        placeholder="Ex : 12 rue des Fossés, Nantes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        style={{
          width: '100%',
          padding: '0.75rem 0.9rem',
          fontSize: '1rem',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
        }}
      />
      {loading && <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0.4rem 0 0' }}>Recherche…</p>}
      {error && <p style={{ fontSize: '0.85rem', color: 'var(--level-elevee)', margin: '0.4rem 0 0' }}>{error}</p>}

      {open && results.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '0.4rem 0 0',
            padding: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            background: 'var(--color-surface)',
            position: 'absolute',
            width: '100%',
            zIndex: 10,
            maxHeight: '16rem',
            overflowY: 'auto',
          }}
        >
          {results.map((result) => (
            <li key={`${result.label}-${result.lat}-${result.lon}`}>
              <button
                type="button"
                onClick={() => {
                  selectedLabelRef.current = result.label
                  onSelect(result)
                  setQuery(result.label)
                  setOpen(false)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.6rem 0.9rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.92rem',
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
