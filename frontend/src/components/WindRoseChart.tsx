import { DIRECTIONS_16, SPEED_BANDS, type WindRose } from '../lib/wind'

const BAND_COLORS = ['#cfe3f5', '#8fbde0', '#4f8fc4', '#1f5f96']

function polarToXY(cx: number, cy: number, r: number, bearingDeg: number) {
  const rad = (bearingDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

function wedgePath(cx: number, cy: number, rInner: number, rOuter: number, startDeg: number, endDeg: number): string {
  const p1 = polarToXY(cx, cy, rOuter, startDeg)
  const p2 = polarToXY(cx, cy, rOuter, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  if (rInner <= 0.01) {
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`
  }
  const p3 = polarToXY(cx, cy, rInner, endDeg)
  const p4 = polarToXY(cx, cy, rInner, startDeg)
  return `M ${p4.x} ${p4.y} L ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`
}

export default function WindRoseChart({ rose }: { rose: WindRose }) {
  const size = 320
  const cx = size / 2
  const cy = size / 2
  const maxRadius = 120
  const sectorTotals = rose.frequencies.map((row) => row.reduce((a, b) => a + b, 0))
  const maxTotal = Math.max(...sectorTotals, 0.0001)
  const gridRings = [0.25, 0.5, 0.75, 1]

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: '22rem', display: 'block', margin: '0 auto' }} role="img" aria-label="Rose des vents">
        {gridRings.map((frac) => (
          <circle key={frac} cx={cx} cy={cy} r={maxRadius * frac} fill="none" stroke="var(--color-border)" strokeOpacity={0.18} strokeWidth={1} />
        ))}
        {DIRECTIONS_16.map((_, i) => {
          const angle = i * 22.5
          const p = polarToXY(cx, cy, maxRadius, angle)
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--color-border)" strokeOpacity={0.12} strokeWidth={1} />
        })}

        {DIRECTIONS_16.map((_, i) => {
          const startDeg = i * 22.5 - 11.25
          const endDeg = i * 22.5 + 11.25
          let cumulative = 0
          return rose.frequencies[i].map((value, bandIndex) => {
            const rInner = (cumulative / maxTotal) * maxRadius
            cumulative += value
            const rOuter = (cumulative / maxTotal) * maxRadius
            if (value <= 0) return null
            return (
              <path
                key={bandIndex}
                d={wedgePath(cx, cy, rInner, rOuter, startDeg, endDeg)}
                fill={BAND_COLORS[bandIndex]}
                stroke="var(--color-surface)"
                strokeWidth={0.75}
              />
            )
          })
        })}

        {(['N', 'E', 'S', 'O'] as const).map((label, i) => {
          const p = polarToXY(cx, cy, maxRadius + 16, i * 90)
          return (
            <text key={label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="var(--color-ink)">
              {label}
            </text>
          )
        })}
      </svg>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
        {SPEED_BANDS.map((band, i) => (
          <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            <span style={{ width: '0.8rem', height: '0.8rem', borderRadius: '50%', background: BAND_COLORS[i], display: 'inline-block' }} />
            {band.label}
          </div>
        ))}
      </div>
    </div>
  )
}
