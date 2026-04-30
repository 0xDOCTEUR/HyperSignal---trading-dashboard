import { useId } from 'react'

/**
 * Marque onde / « pulse » alignée sur HyperPulse (même polyline que le canvas du dashboard).
 */
export function BrandPulseLogo({ className }: { className?: string }) {
  const gradId = useId().replace(/:/g, 'g')
  const fillId = `hp-wave-${gradId}`

  return (
    <svg
      className={className}
      viewBox="-4 -4 64 56"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      focusable={false}
    >
      <defs>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6ee7ff" />
          <stop offset="50%" stopColor="#97fce4" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#${fillId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,30 12,30 18,12 30,48 36,22 42,36 56,30"
      />
    </svg>
  )
}
