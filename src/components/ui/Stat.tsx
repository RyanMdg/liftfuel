import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface StatProps {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  size?: 'lg' | 'md'
  className?: string
}

/** Label above value, on the page background. Use inside a <dl>. */
export function Stat({ label, value, unit, sub, size = 'md', className }: StatProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="label-caps">{label}</dt>
      {/* Hero figures use proportional digits; tabular digits look loose at display sizes. */}
      <dd className={cn('mt-1 font-semibold', size === 'lg' ? 'text-4xl tracking-tight sm:text-5xl' : 'num text-2xl sm:text-stat')}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium whitespace-nowrap text-ink-soft sm:text-base">{unit}</span>}
      </dd>
      {sub && <dd className="mt-1 text-sm text-ink-soft">{sub}</dd>}
    </div>
  )
}

interface ProgressBarProps {
  label: string
  value: number
  max: number
  valueText: string
  className?: string
}

/** Thin length bar: length is read faster and more accurately than arcs or rings. */
export function ProgressBar({ label, value, max, valueText, className }: ProgressBarProps) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const over = max > 0 && value > max
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(Math.min(value, max))}
      aria-valuetext={valueText}
      className={cn('h-1 w-full bg-line', className)}
    >
      <div className={cn('h-full transition-[width] duration-300', over ? 'bg-danger' : 'bg-teal')} style={{ width: `${fraction * 100}%` }} />
    </div>
  )
}
