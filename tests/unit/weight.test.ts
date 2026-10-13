import { describe, expect, it } from 'vitest'
import { trendChange, weightTrend } from '@/lib/weight'

describe('weightTrend', () => {
  it('averages real weigh-ins in a trailing 7-day window without interpolating', () => {
    const points = weightTrend([
      { entry_date: '2026-10-01', weight_kg: 80 },
      { entry_date: '2026-10-02', weight_kg: 81 },
      { entry_date: '2026-10-04', weight_kg: 79.5 },
      { entry_date: '2026-10-07', weight_kg: 80.5 },
      { entry_date: '2026-10-20', weight_kg: 78 },
    ])
    expect(points.map((p) => p.averageKg)).toEqual([null, null, 80.17, 80.25, null])
    expect(points).toHaveLength(5) // no invented days
  })
  it('excludes weigh-ins older than the window', () => {
    const points = weightTrend([
      { entry_date: '2026-10-01', weight_kg: 90 },
      { entry_date: '2026-10-08', weight_kg: 80 },
      { entry_date: '2026-10-09', weight_kg: 80 },
      { entry_date: '2026-10-10', weight_kg: 80 },
    ])
    expect(points[3].averageKg).toBe(80)
  })
  it('reports change between first and last available averages', () => {
    const points = weightTrend([
      { entry_date: '2026-10-01', weight_kg: 80 }, { entry_date: '2026-10-02', weight_kg: 80 },
      { entry_date: '2026-10-03', weight_kg: 80 }, { entry_date: '2026-10-10', weight_kg: 79 },
      { entry_date: '2026-10-11', weight_kg: 79 }, { entry_date: '2026-10-12', weight_kg: 79 },
    ])
    expect(trendChange(points)).toEqual({ fromDate: '2026-10-03', toDate: '2026-10-12', changeKg: -1, days: 9 })
    expect(trendChange(points.slice(0, 3))).toBeNull()
  })
})
