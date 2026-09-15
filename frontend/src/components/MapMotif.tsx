/** Decorative illustration in the style of a hand-drawn commune map — thick
 * dark outlines, irregular green parcels, white roads, small red site
 * markers. Purely ornamental (aria-hidden), not a real map. */
export default function MapMotif({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 320 360" className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="mapmotif-blob">
          <path d="M46,26 Q130,2 208,20 T298,72 Q318,150 284,232 Q262,312 172,344 Q84,362 42,300 Q6,222 18,140 Q10,66 46,26 Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#mapmotif-blob)">
        <rect x="0" y="0" width="320" height="360" fill="var(--color-accent-soft)" />

        <polygon points="0,0 150,0 120,90 30,110 0,70" fill="#3f8f63" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="150,0 260,0 240,60 190,100 120,90" fill="#7fb37f" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="260,0 320,0 320,90 240,60" fill="#2f6b45" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="30,110 120,90 190,100 170,190 70,200" fill="#8fbf7a" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="190,100 240,60 320,90 320,190 170,190" fill="#4c9a6a" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="0,70 30,110 70,200 0,220" fill="#2a5a44" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="70,200 170,190 190,270 90,300" fill="#3f8f63" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="170,190 320,190 320,280 220,310 190,270" fill="#234b3a" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="0,220 70,200 90,300 40,340 0,320" fill="#7fb37f" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="90,300 190,270 220,310 170,360 40,340" fill="#4c9a6a" stroke="var(--color-ink)" strokeWidth="3" />
        <polygon points="220,310 320,280 320,360 170,360" fill="#2f6b45" stroke="var(--color-ink)" strokeWidth="3" />

        {/* Roads: dark edge stroke underneath, white fill on top. */}
        <path d="M0,74 Q90,96 130,92 T210,64 Q270,50 320,86" fill="none" stroke="var(--color-ink)" strokeWidth="13" strokeLinecap="round" />
        <path d="M0,74 Q90,96 130,92 T210,64 Q270,50 320,86" fill="none" stroke="#fffdf7" strokeWidth="8" strokeLinecap="round" />
        <path d="M124,0 Q140,90 150,150 Q160,230 130,300 Q116,335 96,360" fill="none" stroke="var(--color-ink)" strokeWidth="13" strokeLinecap="round" />
        <path d="M124,0 Q140,90 150,150 Q160,230 130,300 Q116,335 96,360" fill="none" stroke="#fffdf7" strokeWidth="8" strokeLinecap="round" />
        <path d="M40,200 Q140,212 200,205 Q270,198 320,214" fill="none" stroke="var(--color-ink)" strokeWidth="11" strokeLinecap="round" />
        <path d="M40,200 Q140,212 200,205 Q270,198 320,214" fill="none" stroke="#fffdf7" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* Outer frame */}
      <path
        d="M46,26 Q130,2 208,20 T298,72 Q318,150 284,232 Q262,312 172,344 Q84,362 42,300 Q6,222 18,140 Q10,66 46,26 Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="4"
      />

      {/* Site markers */}
      <circle cx="132" cy="90" r="6" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="207" cy="65" r="5" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="148" cy="207" r="5" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="70" cy="200" r="4" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
    </svg>
  )
}
