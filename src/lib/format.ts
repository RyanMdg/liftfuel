import { formatNumber } from './units'

export const kcal = (n: number) => formatNumber(n, 0)
/** Grams in tables: up to one decimal. */
export const grams = (n: number) => formatNumber(n, 1)
/** Grams in summaries: whole numbers. */
export const gramsWhole = (n: number) => formatNumber(n, 0)

/** "150 g", or "2 x 1 large egg" for serving-based amounts. */
export function amountLabel(e: { quantity: number; base_unit: string; serving_label: string | null; serving_count: number | null }): string {
  if (e.serving_count != null && e.serving_label) {
    return `${formatNumber(e.serving_count, 2)} × ${e.serving_label}`
  }
  return `${formatNumber(e.quantity, 1)} ${e.base_unit}`
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n, 0)} ${n === 1 ? one : many}`
}
