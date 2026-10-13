import { describe, expect, it } from 'vitest'
import { displayLoad, formatWeight, fromKg, KG_PER_LB, toKg } from '@/lib/units'
import { addDays, diffDays, formatDateLong, isDateString, relativeDayLabel, startOfWeek, todayInZone } from '@/lib/dates'

describe('unit conversion', () => {
  it('converts pounds and kilograms with the exact definition', () => {
    expect(KG_PER_LB).toBe(0.45359237)
    expect(toKg(225, 'lb')).toBeCloseTo(102.0582833, 6)
    expect(fromKg(100, 'lb')).toBeCloseTo(220.462262, 5)
    expect(toKg(80, 'kg')).toBe(80)
  })
  it('round-trips a pound entry without visible drift', () => {
    expect(displayLoad(toKg(225, 'lb'), 'lb')).toBe(225)
    expect(displayLoad(toKg(137.5, 'lb'), 'lb')).toBe(137.5)
  })
  it('formats with the unit suffix', () => {
    expect(formatWeight(82.5, 'kg')).toBe('82.5 kg')
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })
})

describe('dates', () => {
  it('computes today in the profile time zone, not UTC', () => {
    const instant = new Date('2026-10-14T02:30:00Z')
    expect(todayInZone('UTC', instant)).toBe('2026-10-14')
    expect(todayInZone('America/Los_Angeles', instant)).toBe('2026-10-13')
    expect(todayInZone('Asia/Manila', new Date('2026-10-13T17:30:00Z'))).toBe('2026-10-14')
  })
  it('does calendar arithmetic across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(diffDays('2026-10-01', '2026-10-14')).toBe(13)
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12') // Wednesday -> Monday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12') // Sunday -> Monday
  })
  it('validates date strings', () => {
    expect(isDateString('2026-02-29')).toBe(false)
    expect(isDateString('2028-02-29')).toBe(true)
    expect(isDateString('2026-1-01')).toBe(false)
  })
  it('labels relative days', () => {
    expect(relativeDayLabel('2026-10-14', '2026-10-14')).toBe('Today')
    expect(relativeDayLabel('2026-10-13', '2026-10-14')).toBe('Yesterday')
    expect(relativeDayLabel('2026-10-01', '2026-10-14')).toBe(formatDateLong('2026-10-01'))
    expect(formatDateLong('2026-10-14')).toBe('Wednesday 14 October 2026')
  })
})

describe('formatSigned', () => {
  it('uses a true minus sign and an explicit plus', async () => {
    const { formatSigned } = await import('@/lib/units')
    expect(formatSigned(-1.34)).toBe('−1.3')
    expect(formatSigned(2)).toBe('+2')
    expect(formatSigned(0.01)).toBe('0')
  })
})
