import type { WeightEntry } from '@/types/database'
import { addDays, diffDays } from './dates'
import { round } from './units'

export const TREND_WINDOW_DAYS = 7
export const TREND_MIN_POINTS = 3

export interface WeightPoint {
  date: string
  weightKg: number
  /** Trailing mean of real weigh-ins in the window ending on this date, or null if too sparse. */
  averageKg: number | null
}

/**
 * Trailing 7-calendar-day mean of actual weigh-ins (no interpolation).
 * The average is shown only when the window contains at least 3 weigh-ins,
 * so sparse data is reported honestly instead of being smoothed into a trend.
 */
export function weightTrend(
  entries: ReadonlyArray<Pick<WeightEntry, 'entry_date' | 'weight_kg'>>,
  windowDays = TREND_WINDOW_DAYS,
  minPoints = TREND_MIN_POINTS,
): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  return sorted.map((e, i) => {
    const windowStart = addDays(e.entry_date, -(windowDays - 1))
    let sum = 0
    let n = 0
    for (let j = i; j >= 0 && sorted[j].entry_date >= windowStart; j--) {
      sum += sorted[j].weight_kg
      n++
    }
    return { date: e.entry_date, weightKg: e.weight_kg, averageKg: n >= minPoints ? round(sum / n, 2) : null }
  })
}

export interface TrendChange {
  fromDate: string
  toDate: string
  changeKg: number
  days: number
}

/**
 * Change between the earliest and latest available trailing averages in the series.
 * Returns null when fewer than two averages exist.
 */
export function trendChange(points: ReadonlyArray<WeightPoint>): TrendChange | null {
  const withAvg = points.filter((p) => p.averageKg != null)
  if (withAvg.length < 2) return null
  const first = withAvg[0]
  const last = withAvg[withAvg.length - 1]
  return {
    fromDate: first.date,
    toDate: last.date,
    changeKg: round((last.averageKg as number) - (first.averageKg as number), 2),
    days: diffDays(first.date, last.date),
  }
}
