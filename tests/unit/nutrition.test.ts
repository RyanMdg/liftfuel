import { describe, expect, it } from 'vitest'
import {
  caloriesFromMacros, groupByMeal, macrosMismatch, progressFraction, recipePreview, remaining,
  resolveGoalForDate, scaleNutrients, sumTotals,
} from '@/lib/nutrition'
import type { NutritionGoal } from '@/types/database'

const per100 = { reference_amount: 100, calories: 120, protein_g: 22.5, carbs_g: 0, fat_g: 2.6, fiber_g: null }
const bar = { reference_amount: 60, calories: 210, protein_g: 20, carbs_g: 22, fat_g: 7, fiber_g: 3 }

describe('scaleNutrients', () => {
  it('scales per-100 g foods by grams', () => {
    expect(scaleNutrients(per100, 150)).toEqual({ calories: 180, protein_g: 33.75, carbs_g: 0, fat_g: 3.9, fiber_g: null })
  })
  it('uses the actual reference amount instead of assuming 100 g', () => {
    expect(scaleNutrients(bar, 30)).toEqual({ calories: 105, protein_g: 10, carbs_g: 11, fat_g: 3.5, fiber_g: 1.5 })
    expect(scaleNutrients(bar, 60).calories).toBe(210)
  })
  it('returns zero for invalid quantities', () => {
    expect(scaleNutrients(per100, 0).calories).toBe(0)
    expect(scaleNutrients(per100, -5).calories).toBe(0)
    expect(scaleNutrients(per100, Number.NaN).calories).toBe(0)
  })
  it('rounds to 2 decimals like the database trigger', () => {
    expect(scaleNutrients({ ...per100, calories: 143 }, 33).calories).toBe(47.19)
  })
})

describe('daily aggregation', () => {
  const entries = [
    { meal: 'breakfast' as const, calories: 214.5, protein_g: 18.9, carbs_g: 1.05, fat_g: 14.25, fiber_g: null },
    { meal: 'lunch' as const, calories: 180, protein_g: 33.75, carbs_g: 0, fat_g: 3.9, fiber_g: 0 },
    { meal: 'snacks' as const, calories: 105, protein_g: 10, carbs_g: 11, fat_g: 3.5, fiber_g: 1.5 },
  ]
  it('sums macros across entries without floating-point drift', () => {
    expect(sumTotals(entries)).toEqual({ calories: 499.5, protein_g: 62.65, carbs_g: 12.05, fat_g: 21.65, fiber_g: 1.5 })
  })
  it('reflects edits and deletions', () => {
    const edited = entries.map((e, i) => (i === 1 ? { ...e, calories: 240 } : e))
    expect(sumTotals(edited).calories).toBe(559.5)
    expect(sumTotals(entries.slice(1)).calories).toBe(285)
    expect(sumTotals([]).calories).toBe(0)
  })
  it('groups by meal in fixed order', () => {
    const g = groupByMeal(entries)
    expect(Object.keys(g)).toEqual(['breakfast', 'lunch', 'dinner', 'snacks'])
    expect(g.dinner).toHaveLength(0)
  })
})

describe('targets', () => {
  const goal = (effective_date: string, calories: number): NutritionGoal => ({
    id: effective_date, user_id: 'u', effective_date, calories, protein_g: 150, carbs_g: 250, fat_g: 70,
    created_at: '', updated_at: '',
  })
  const goals = [goal('2026-10-10', 2500), goal('2026-09-01', 2800), goal('2026-11-01', 2300)]

  it('uses the latest goal effective on or before the date', () => {
    expect(resolveGoalForDate(goals, '2026-09-01').goal?.calories).toBe(2800)
    expect(resolveGoalForDate(goals, '2026-10-09').goal?.calories).toBe(2800)
    expect(resolveGoalForDate(goals, '2026-10-10').goal?.calories).toBe(2500)
    expect(resolveGoalForDate(goals, '2027-01-01').goal?.calories).toBe(2300)
  })
  it('falls back to the earliest goal before the first effective date, flagged', () => {
    expect(resolveGoalForDate(goals, '2026-08-01')).toMatchObject({ isFallback: true, goal: { calories: 2800 } })
    expect(resolveGoalForDate([], '2026-08-01')).toEqual({ goal: null, isFallback: false })
  })
  it('reports remaining and exceeded amounts', () => {
    expect(remaining(2500, 2100.5)).toEqual({ amount: 399.5, over: false })
    expect(remaining(2500, 2714)).toEqual({ amount: 214, over: true })
    expect(progressFraction(3000, 2500)).toBe(1)
    expect(progressFraction(100, 0)).toBe(0)
  })
  it('checks macro and calorie consistency with Atwater factors', () => {
    expect(caloriesFromMacros(180, 250, 70)).toBe(2350)
    expect(macrosMismatch(2350, 180, 250, 70)).toBe(false)
    expect(macrosMismatch(3000, 180, 250, 70)).toBe(true)
  })
})

describe('recipePreview', () => {
  const rice = { reference_amount: 100, calories: 365, protein_g: 7.1, carbs_g: 80, fat_g: 0.7, fiber_g: 1.3, base_unit: 'g' as const, provenance: 'estimated' as const }
  const oil = { reference_amount: 100, calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0, base_unit: 'g' as const, provenance: 'nutrition_label' as const }

  it('matches the database recipe calculation with explicit yield', () => {
    const p = recipePreview([{ food: rice, quantity: 250 }, { food: oil, quantity: 10 }], 750, 4)!
    expect(p.batch.calories).toBe(1000.9)
    expect(p.yieldAmount).toBe(750)
    expect(p.yieldEstimated).toBe(false)
    expect(p.servingAmount).toBe(187.5)
    expect(p.perServing?.calories).toBe(250.23)
    expect(p.containsEstimates).toBe(true)
  })
  it('flags yield as estimated when cooked weight is unknown', () => {
    const p = recipePreview([{ food: oil, quantity: 10 }], null, null)!
    expect(p.yieldEstimated).toBe(true)
    expect(p.yieldAmount).toBe(10)
    expect(p.perServing).toBeNull()
  })
  it('returns null without ingredients', () => {
    expect(recipePreview([], 100, 1)).toBeNull()
  })
})
