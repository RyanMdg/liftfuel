import { formatDateShort } from '@/lib/dates'

/** Chart tokens mirror src/styles/index.css. Recharts needs literal values. */
export const chart = {
  teal: '#0a575c',
  tealMid: '#5d8f92',
  tealLight: '#b6cecf',
  navy: '#030027',
  grid: '#e3e2e9',
  axisText: '#6b6a80',
  surface: '#ffffff',
  font: '"Montserrat Variable", Montserrat, ui-sans-serif, system-ui, sans-serif',
}

export const axisProps = {
  stroke: chart.grid,
  tick: { fill: chart.axisText, fontSize: 11, fontFamily: chart.font },
  tickLine: false,
  axisLine: { stroke: chart.grid },
} as const

export const gridProps = { stroke: chart.grid, strokeDasharray: undefined, vertical: false } as const

/** Dates as epoch milliseconds so the x-axis spaces points by real time, not by index. */
export const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`)
export const fromTime = (t: number) => new Date(t).toISOString().slice(0, 10)
export const timeTick = (t: number) => formatDateShort(fromTime(t))

/** Marker: 8px, surface ring so it stays legible over lines. */
export const dotProps = (fill: string) => ({ r: 4, fill, stroke: chart.surface, strokeWidth: 2 })
export const activeDotProps = (fill: string) => ({ r: 6, fill, stroke: chart.surface, strokeWidth: 2 })

/** Compact tick labels: 1,250 -> 1.3K. */
export function compactTick(n: number) {
  return Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}K` : String(Math.round(n * 10) / 10)
}
