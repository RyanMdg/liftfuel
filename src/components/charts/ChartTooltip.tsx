import type { ReactNode } from 'react'

interface Row {
  label: string
  value: ReactNode
  color?: string
}

/** Tooltip panel: text in ink tokens; series identity carried by a small key, not coloured text. */
export function TooltipPanel({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="border border-line bg-white px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-ink-soft">
          {r.color && <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="num ml-auto pl-4 font-semibold text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  )
}
