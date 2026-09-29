/**
 * Progress while a rubrique queries the public services.
 *
 * It reports how many sources have actually answered, not a decorative
 * animation: a rubrique fans out to as many as ten services, some of them
 * slow, and the honest thing to show is the real count. A bar that merely
 * moved would be this platform inventing reassurance in its own interface,
 * which is exactly what it refuses to do with the data.
 */
export default function BarreProgression({ faits, attendus, enAttente }: { faits: number; attendus: number; enAttente: boolean }) {
  // Before the first source has been registered the total is unknown — that
  // lasts a single tick, and the bar shows an indeterminate sliver rather
  // than jumping from an invented percentage.
  const connu = !enAttente && attendus > 0
  const part = connu ? Math.min(1, faits / attendus) : 0

  return (
    <div style={{ maxWidth: '32rem' }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={connu ? attendus : undefined}
        aria-valuenow={connu ? faits : undefined}
        aria-label="Interrogation des bases publiques"
        style={{
          height: '0.55rem',
          borderRadius: '999px',
          background: 'var(--level-indeterminee-bg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: connu ? `${Math.max(part * 100, 3)}%` : '30%',
            background: 'var(--color-accent)',
            borderRadius: '999px',
            transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
            position: 'relative',
            overflow: 'hidden',
            animation: connu ? undefined : 'lyza-indetermine 1.4s ease-in-out infinite',
          }}
        >
          {/* A sheen travelling along the filled part, so a bar that is waiting
              on one slow service still reads as alive rather than stuck. */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)',
              animation: 'lyza-reflet 1.8s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
        {/* Only two rubriques query at a time (see lib/queue.ts), so a
            section further down the page is genuinely waiting its turn rather
            than querying anything — saying otherwise would be a small lie in
            the one place this platform can least afford one. */}
        {enAttente ? (
          "En attente d'un créneau — deux rubriques interrogent les services à la fois."
        ) : (
          <>
            Interrogation des bases publiques…{' '}
            {connu && (
              <strong style={{ color: 'var(--color-ink)', fontWeight: 700 }}>
                {faits} source{faits > 1 ? 's' : ''} sur {attendus}
              </strong>
            )}
          </>
        )}
      </p>
    </div>
  )
}
