import { addDays } from '@/lib/dates'

export type PeriodKey = '4w' | '12w' | '6m' | '1y'

export const PERIODS: ReadonlyArray<{ value: PeriodKey; label: string; days: number }> = [
  { value: '4w', label: '4 weeks', days: 28 },
  { value: '12w', label: '12 weeks', days: 84 },
  { value: '6m', label: '6 months', days: 182 },
  { value: '1y', label: '1 year', days: 364 },
]

export interface Period {
  key: PeriodKey
  label: string
  days: number
  from: string
  to: string
  /** The equally long period immediately before, for comparisons. */
  previousFrom: string
  previousTo: string
}

export function periodFor(key: PeriodKey, today: string): Period {
  const p = PERIODS.find((x) => x.value === key) ?? PERIODS[1]
  const from = addDays(today, -(p.days - 1))
  return {
    key: p.value, label: p.label, days: p.days, from, to: today,
    previousFrom: addDays(from, -p.days), previousTo: addDays(from, -1),
  }
}
