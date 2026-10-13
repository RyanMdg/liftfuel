import type { Food, FoodEntry, Meal, NutritionGoal } from '@/types/database'
import { round } from './units'

export const MEALS: ReadonlyArray<{ value: Meal; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
]

export interface MacroTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
}

export const ZERO_TOTALS: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: null }

type NutrientSource = Pick<Food, 'reference_amount' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>

/**
 * Nutrients for a quantity of a food. Mirrors the database trigger exactly:
 * quantity / reference_amount * nutrient, rounded to 2 decimals.
 * Used for previews only; persisted values are computed by the database.
 */
export function scaleNutrients(food: NutrientSource, quantity: number): MacroTotals {
  if (!(quantity > 0) || !(food.reference_amount > 0)) return { ...ZERO_TOTALS }
  const factor = quantity / food.reference_amount
  return {
    calories: round(food.calories * factor, 2),
    protein_g: round(food.protein_g * factor, 2),
    carbs_g: round(food.carbs_g * factor, 2),
    fat_g: round(food.fat_g * factor, 2),
    fiber_g: food.fiber_g == null ? null : round(food.fiber_g * factor, 2),
  }
}

type EntryNutrients = Pick<FoodEntry, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>

/** Sums entry nutrients. Fiber is null unless at least one entry reports it. */
export function sumTotals(entries: ReadonlyArray<EntryNutrients>): MacroTotals {
  const totals = entries.reduce<MacroTotals>(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein_g: acc.protein_g + e.protein_g,
      carbs_g: acc.carbs_g + e.carbs_g,
      fat_g: acc.fat_g + e.fat_g,
      fiber_g: e.fiber_g == null ? acc.fiber_g : (acc.fiber_g ?? 0) + e.fiber_g,
    }),
    { ...ZERO_TOTALS },
  )
  return {
    calories: round(totals.calories, 2),
    protein_g: round(totals.protein_g, 2),
    carbs_g: round(totals.carbs_g, 2),
    fat_g: round(totals.fat_g, 2),
    fiber_g: totals.fiber_g == null ? null : round(totals.fiber_g, 2),
  }
}

export function groupByMeal<T extends Pick<FoodEntry, 'meal'>>(entries: ReadonlyArray<T>): Record<Meal, T[]> {
  const groups: Record<Meal, T[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] }
  for (const e of entries) groups[e.meal].push(e)
  return groups
}

export interface ResolvedGoal {
  goal: NutritionGoal | null
  /** True when no goal was effective on the date and the earliest goal is used instead. */
  isFallback: boolean
}

/**
 * The goal in effect on a date: the goal with the greatest effective_date <= date.
 * Dates before the first goal fall back to the earliest goal (flagged), so a user who
 * back-fills days before onboarding still sees targets.
 */
export function resolveGoalForDate(goals: ReadonlyArray<NutritionGoal>, date: string): ResolvedGoal {
  let best: NutritionGoal | null = null
  let earliest: NutritionGoal | null = null
  for (const g of goals) {
    if (!earliest || g.effective_date < earliest.effective_date) earliest = g
    if (g.effective_date <= date && (!best || g.effective_date > best.effective_date)) best = g
  }
  if (best) return { goal: best, isFallback: false }
  return { goal: earliest, isFallback: earliest !== null }
}

export interface Remaining {
  amount: number
  over: boolean
}

export function remaining(target: number, consumed: number): Remaining {
  const diff = round(target - consumed, 2)
  return { amount: Math.abs(diff), over: diff < 0 }
}

/** Fraction of target reached, clamped to 0..1 for bar lengths. */
export function progressFraction(consumed: number, target: number): number {
  if (!(target > 0)) return 0
  return Math.min(1, Math.max(0, consumed / target))
}

/** Atwater general factors: 4 kcal/g protein and carbohydrate, 9 kcal/g fat. */
export function caloriesFromMacros(protein_g: number, carbs_g: number, fat_g: number): number {
  return round(protein_g * 4 + carbs_g * 4 + fat_g * 9, 0)
}

/** True when macro-derived calories differ from the calorie target by more than the tolerance. */
export function macrosMismatch(calories: number, protein_g: number, carbs_g: number, fat_g: number, tolerance = 0.05): boolean {
  if (!(calories > 0)) return false
  return Math.abs(caloriesFromMacros(protein_g, carbs_g, fat_g) - calories) / calories > tolerance
}

export interface RecipeIngredientInput {
  food: NutrientSource & Pick<Food, 'base_unit' | 'provenance'>
  quantity: number
}

export interface RecipePreview {
  batch: MacroTotals
  rawAmount: number
  yieldAmount: number
  yieldEstimated: boolean
  per100g: MacroTotals
  perServing: MacroTotals | null
  servingAmount: number | null
  containsEstimates: boolean
}

/** Client-side preview mirroring public.recompute_recipe_food. */
export function recipePreview(
  ingredients: ReadonlyArray<RecipeIngredientInput>,
  cookedYieldG: number | null,
  servings: number | null,
): RecipePreview | null {
  const valid = ingredients.filter((i) => i.quantity > 0)
  if (valid.length === 0) return null
  const batchParts = valid.map((i) => scaleNutrients(i.food, i.quantity))
  const allFiber = valid.every((i) => i.food.fiber_g != null)
  const batch = sumTotals(batchParts.map((p) => ({ ...p, fiber_g: allFiber ? p.fiber_g : null })))
  const rawAmount = valid.reduce((s, i) => s + i.quantity, 0)
  const yieldEstimated = !(cookedYieldG && cookedYieldG > 0)
  const yieldAmount = yieldEstimated ? rawAmount : (cookedYieldG as number)
  const asFood = { reference_amount: yieldAmount, ...batch }
  const servingAmount = servings && servings > 0 ? round(yieldAmount / servings, 2) : null
  return {
    batch,
    rawAmount,
    yieldAmount,
    yieldEstimated,
    per100g: scaleNutrients(asFood, 100),
    perServing: servingAmount ? scaleNutrients(asFood, servingAmount) : null,
    servingAmount,
    containsEstimates: valid.some((i) => i.food.provenance === 'estimated'),
  }
}

export const PROVENANCE_LABELS: Record<Food['provenance'], string> = {
  user_entered: 'Entered by you',
  nutrition_label: 'Nutrition label',
  reference_database: 'Reference database',
  estimated: 'Estimate',
  recipe_calculated: 'Calculated from recipe',
}

export function isEstimate(provenance: Food['provenance']): boolean {
  return provenance === 'estimated'
}
