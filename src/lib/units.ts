import type { WeightUnit } from '@/types/database'

/** Exact international avoirdupois pound. */
export const KG_PER_LB = 0.45359237

/** Converts a stored kilogram value for display in the user's unit. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

/** Converts a value the user typed in their unit to canonical kilograms. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Format a stored kg value in the user's unit, e.g. "82.5 kg" or "181.9 lb". */
export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  return `${formatNumber(fromKg(kg, unit), decimals)} ${unit}`
}

/** Display value for a load in the unit it was entered, rounded to avoid 102.058 noise. */
export function displayLoad(kg: number, unit: WeightUnit): number {
  return round(fromKg(kg, unit), 2)
}

/** Signed number with a true minus sign (U+2212), e.g. "+1.3" or "−1.3". */
export function formatSigned(value: number, maxDecimals = 1): string {
  const r = round(value, maxDecimals)
  if (r === 0) return formatNumber(0, maxDecimals)
  return `${r > 0 ? '+' : '\u2212'}${formatNumber(Math.abs(r), maxDecimals)}`
}

const numberFormats = new Map<number, Intl.NumberFormat>()
export function formatNumber(value: number, maxDecimals = 0): string {
  let f = numberFormats.get(maxDecimals)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals, minimumFractionDigits: 0 })
    numberFormats.set(maxDecimals, f)
  }
  return f.format(round(value, maxDecimals))
}
