import type { ActivityLevel, Goal, Sex } from '@/types/database'
import { caloriesFromMacros } from './nutrition'

/**
 * Daily target estimate: Mifflin-St Jeor resting energy (Mifflin et al. 1990, the most accurate
 * common equation in Frankenfield et al. 2005) x an activity factor, adjusted for the goal.
 * It is a starting point. The weight trend over the next weeks is the real test.
 */

export const ACTIVITY_LEVELS: ReadonlyArray<{ value: ActivityLevel; label: string; description: string; factor: number }> = [
  { value: 'sedentary', label: 'Sedentary', description: 'Desk job, little or no exercise', factor: 1.2 },
  { value: 'light', label: 'Lightly active', description: 'Exercise 1 to 3 days a week', factor: 1.375 },
  { value: 'moderate', label: 'Moderately active', description: 'Exercise 3 to 5 days a week', factor: 1.55 },
  { value: 'very', label: 'Very active', description: 'Hard exercise 6 to 7 days a week', factor: 1.725 },
  { value: 'extra', label: 'Extremely active', description: 'Physical job plus hard training', factor: 1.9 },
]

/** Calorie change from maintenance per goal. */
export const GOAL_ADJUSTMENT: Record<Goal, number> = { lose: -0.2, maintain: 0, gain: 0.1 }

/** Protein per kg of body weight (ISSN 2017: 1.4 to 2.0 g/kg/day; the top of the range in a deficit). */
export const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 }

/** Protein is capped at this share of calories so heavier bodies do not get extreme targets. */
export const MAX_PROTEIN_SHARE = 0.35
/** Fat share of calories (inside the 20 to 35% acceptable range). */
export const FAT_SHARE = 0.25

export const MIN_AGE = 18
export const MAX_AGE = 100

export interface EnergyInputs {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: ActivityLevel
  goal: Goal
}

export interface TargetEstimate {
  bmr: number
  tdee: number
  /** Applied change from maintenance, for example -0.2. */
  adjustment: number
  /** True when the goal adjustment would have gone below resting energy and was raised to it. */
  flooredAtBmr: boolean
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  proteinPerKg: number
}

export function bmrMifflinStJeor({ sex, weightKg, heightCm, age }: Pick<EnergyInputs, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((a) => a.value === level)!.factor
}

const round10 = (n: number) => Math.round(n / 10) * 10

export function estimateTargets(input: EnergyInputs): TargetEstimate {
  const bmr = bmrMifflinStJeor(input)
  const tdee = bmr * activityFactor(input.activity)
  const adjusted = tdee * (1 + GOAL_ADJUSTMENT[input.goal])
  const flooredAtBmr = adjusted < bmr
  const calories = round10(Math.max(adjusted, bmr))

  const protein_g = Math.round(Math.min(PROTEIN_G_PER_KG[input.goal] * input.weightKg, (MAX_PROTEIN_SHARE * calories) / 4))
  const fat_g = Math.round((FAT_SHARE * calories) / 9)
  const carbs_g = Math.max(0, Math.round((calories - caloriesFromMacros(protein_g, 0, fat_g)) / 4))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    adjustment: flooredAtBmr ? bmr / tdee - 1 : GOAL_ADJUSTMENT[input.goal],
    flooredAtBmr,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    proteinPerKg: Math.round((protein_g / input.weightKg) * 10) / 10,
  }
}

/** Whole-year age from a birth year, as of a YYYY-MM-DD date. Can be one year high before the birthday. */
export function ageFromBirthYear(birthYear: number, today: string): number {
  return Number(today.slice(0, 4)) - birthYear
}

export function birthYearFromAge(age: number, today: string): number {
  return Number(today.slice(0, 4)) - age
}

export const CM_PER_INCH = 2.54

export function cmFromFeetInches(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10
}

export function feetInchesFromCm(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH)
  return { feet: Math.floor(total / 12), inches: total % 12 }
}
