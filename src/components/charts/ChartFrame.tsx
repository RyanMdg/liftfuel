import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface LegendItem {
  label: string
  /** 'dot' for point series, 'line' for line series, 'bar' for bars, 'step' for reference lines. */
  kind: 'dot' | 'line' | 'bar' | 'step'
  color: string
}

interface ChartFrameProps {
  /** The question the chart answers, phrased as a title. */
  title: string
  caption?: ReactNode
  legend?: LegendItem[]
  /** Unit of the y-axis, shown above the plot. */
  unit?: string
  /** Text alternative summarising what the chart shows. */
  summary: string
  table: { columns: string[]; rows: Array<Array<string | number>> }
  children: ReactNode
  height?: number
  className?: string
}

/**
 * Every chart: a title stating its question, a legend when there are 2+ series
 * (identity is never colour alone), the plot, and a data table for screen readers
 * and anyone who wants exact values.
 */
export function ChartFrame({ title, caption, legend, unit, summary, table, children, height = 240, className }: ChartFrameProps) {
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption>
        <p className="font-semibold">{title}</p>
        {caption && <p className="mt-0.5 text-sm text-ink-soft">{caption}</p>}
      </figcaption>
      {legend && legend.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <LegendKey {...l} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {unit && <p aria-hidden className="mt-4 text-xs text-ink-muted">{unit}</p>}
      <div className={unit ? 'mt-1' : 'mt-4'} style={{ height }} role="img" aria-label={summary}>
        {children}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-teal">Show data table</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>{table.columns.map((c) => <th key={c} scope="col" className="label-caps sticky top-0 border-b border-line bg-white py-1.5 pr-4">{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((v, j) => <td key={j} className="num border-b border-line py-1.5 pr-4">{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

function LegendKey({ kind, color }: LegendItem) {
  if (kind === 'dot') return <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: color }} />
  if (kind === 'bar') return <span aria-hidden className="inline-block h-2.5 w-2 rounded-t-[2px]" style={{ background: color }} />
  if (kind === 'step') return <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: color }} />
  return <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} />
}

/** Empty plot area that explains why there is nothing to draw. */
export function ChartEmpty({ title, message }: { title: string; message: string }) {
  return (
    <figure>
      <figcaption className="font-semibold">{title}</figcaption>
      <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{message}</p>
    </figure>
  )
}
