/** Decorative illustration in the style of a hand-drawn commune map — thick
 * dark outlines, irregular green parcels, a river, tiny buildings, a
 * compass rose, and coloured site markers. Purely ornamental (aria-hidden),
 * not a real map. */
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
        <polygon points="220,310 320,280 320,360 170,360" fill="#c98a3a" stroke="var(--color-ink)" strokeWidth="3" />

        {/* Field-boundary hatching, for a denser hand-surveyed texture. */}
        <g stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 4">
          <line x1="45" y1="15" x2="60" y2="80" />
          <line x1="90" y1="10" x2="105" y2="85" />
          <line x1="270" y1="15" x2="255" y2="55" />
          <line x1="20" y1="240" x2="55" y2="270" />
          <line x1="230" y1="230" x2="270" y2="255" />
          <line x1="120" y1="310" x2="150" y2="345" />
        </g>

        {/* River: a blue ribbon cutting through the parcels, distinct from the roads. */}
        <path d="M296,10 Q250,70 262,130 Q276,190 234,230 Q206,254 214,300" fill="none" stroke="var(--color-ink)" strokeWidth="10" strokeLinecap="round" />
        <path d="M296,10 Q250,70 262,130 Q276,190 234,230 Q206,254 214,300" fill="none" stroke="#3d84b8" strokeWidth="6" strokeLinecap="round" />

        {/* Roads: dark edge stroke underneath, white fill on top. */}
        <path d="M0,74 Q90,96 130,92 T210,64 Q270,50 320,86" fill="none" stroke="var(--color-ink)" strokeWidth="13" strokeLinecap="round" />
        <path d="M0,74 Q90,96 130,92 T210,64 Q270,50 320,86" fill="none" stroke="#fffdf7" strokeWidth="8" strokeLinecap="round" />
        <path d="M124,0 Q140,90 150,150 Q160,230 130,300 Q116,335 96,360" fill="none" stroke="var(--color-ink)" strokeWidth="13" strokeLinecap="round" />
        <path d="M124,0 Q140,90 150,150 Q160,230 130,300 Q116,335 96,360" fill="none" stroke="#fffdf7" strokeWidth="8" strokeLinecap="round" />
        <path d="M40,200 Q140,212 200,205 Q270,198 320,214" fill="none" stroke="var(--color-ink)" strokeWidth="11" strokeLinecap="round" />
        <path d="M40,200 Q140,212 200,205 Q270,198 320,214" fill="none" stroke="#fffdf7" strokeWidth="7" strokeLinecap="round" />
        {/* Warm dashes on the main road, echoing the reference posters' painted road markings. */}
        <path d="M0,74 Q90,96 130,92 T210,64 Q270,50 320,86" fill="none" stroke="#c98a3a" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 11" />

        {/* Tiny hand-drawn buildings. */}
        <g stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round">
          <path d="M78,146 L78,164 L100,164 L100,146 L89,136 Z" fill="#fffdf7" />
          <path d="M242,118 L242,134 L262,134 L262,118 L252,109 Z" fill="#fffdf7" />
          <path d="M56,262 L56,278 L74,278 L74,262 L65,254 Z" fill="#fffdf7" />
        </g>
        {/* A little church: nave + spire, near the road crossing. */}
        <g stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round">
          <path d="M150,222 L150,244 L178,244 L178,222 L164,208 Z" fill="#fffdf7" />
          <rect x="161" y="192" width="6" height="18" fill="#fffdf7" />
          <line x1="164" y1="188" x2="164" y2="196" strokeWidth="2" />
          <line x1="160.5" y1="191.5" x2="167.5" y2="191.5" strokeWidth="2" />
        </g>
      </g>

      {/* Outer frame */}
      <path
        d="M46,26 Q130,2 208,20 T298,72 Q318,150 284,232 Q262,312 172,344 Q84,362 42,300 Q6,222 18,140 Q10,66 46,26 Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="4"
      />

      {/* Compass rose, hand-sketched. */}
      <g transform="translate(272,38)">
        <circle r="20" fill="#fffdf7" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M0,-15 L5,0 L0,15 L-5,0 Z" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="1.5" />
        <path d="M-15,0 L0,-5 L15,0 L0,5 Z" fill="#dfe6e2" stroke="var(--color-ink)" strokeWidth="1.5" />
        <text x="0" y="-23" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)" fontFamily="var(--font-heading)">
          N
        </text>
      </g>

      {/* Site markers, coloured by kind. */}
      <circle cx="132" cy="90" r="6" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="207" cy="65" r="5" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="148" cy="207" r="5" fill="#a3671a" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="70" cy="200" r="4" fill="var(--color-accent-red)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="238" cy="200" r="5" fill="#3d84b8" stroke="var(--color-ink)" strokeWidth="2" />
    </svg>
  )
}
