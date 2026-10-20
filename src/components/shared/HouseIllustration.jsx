// Decorative stand-in for the artifact's photo asset (not bundled in the approved HTML). Brand art: it reads the
// palettes from src/brand/tokens.css directly so it recolours with the brand.
export function HouseIllustration({ className }) {
  return (
    <svg viewBox="0 0 480 300" className={className} role="img" aria-label="Ilustrasi rumah keluarga" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--palette-primary-100)" />
          <stop offset="1" stopColor="var(--palette-neutral-50)" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--palette-primary-500)" />
          <stop offset="1" stopColor="var(--palette-primary-900)" />
        </linearGradient>
      </defs>
      <rect width="480" height="300" fill="url(#sky)" />
      <circle cx="392" cy="70" r="34" fill="var(--palette-white)" opacity="0.9" />
      <ellipse cx="120" cy="80" rx="46" ry="14" fill="var(--palette-white)" opacity="0.8" />
      <ellipse cx="300" cy="48" rx="34" ry="10" fill="var(--palette-white)" opacity="0.7" />
      <rect y="232" width="480" height="68" fill="var(--palette-success-100)" />
      <rect y="250" width="480" height="50" fill="var(--palette-success-200)" />
      <circle cx="70" cy="214" r="38" fill="var(--palette-success-300)" />
      <rect x="66" y="222" width="8" height="34" rx="3" fill="var(--palette-warning-800)" />
      <circle cx="418" cy="206" r="44" fill="var(--palette-success-400)" />
      <rect x="414" y="216" width="9" height="40" rx="3" fill="var(--palette-warning-800)" />
      <rect x="150" y="140" width="190" height="112" rx="6" fill="var(--palette-white)" />
      <polygon points="136,146 245,72 354,146" fill="url(#roof)" />
      <rect x="226" y="186" width="40" height="66" rx="4" fill="var(--palette-primary-700)" />
      <circle cx="258" cy="222" r="3" fill="var(--palette-white)" />
      <rect x="170" y="166" width="38" height="34" rx="4" fill="var(--palette-primary-50)" stroke="var(--palette-primary-500)" strokeWidth="3" />
      <rect x="284" y="166" width="38" height="34" rx="4" fill="var(--palette-primary-50)" stroke="var(--palette-primary-500)" strokeWidth="3" />
      <rect x="296" y="96" width="18" height="34" fill="var(--palette-secondary-500)" />
      <rect x="120" y="252" width="250" height="6" rx="3" fill="var(--palette-white)" opacity="0.7" />
    </svg>
  )
}
