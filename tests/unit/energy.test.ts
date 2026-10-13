import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_LEVELS, ageFromBirthYear, birthYearFromAge, bmrMifflinStJeor, cmFromFeetInches, estimateTargets,
  feetInchesFromCm, type EnergyInputs,
} from '@/lib/energy'
import { caloriesFromMacros, macrosMismatch } from '@/lib/nutrition'

const man: EnergyInputs = { sex: 'male', age: 30, heightCm: 180, weightKg: 83.5, activity: 'moderate', goal: 'lose' }

describe('bmrMifflinStJeor', () => {
  it('matches the published equations (10 W + 6.25 H - 5 A + 5 / -161)', () => {
    expect(bmrMifflinStJeor(man)).toBe(1815)
    expect(bmrMifflinStJeor({ sex: 'female', age: 30, heightCm: 160, weightKg: 55 })).toBe(1239)
  })
})

describe('estimateTargets', () => {
  it('applies the activity factor and a 20% deficit for fat loss', () => {
    const r = estimateTargets(man)
    expect(r.bmr).toBe(1815)
    expect(r.tdee).toBe(2813) // 1815 x 1.55
    expect(r.calories).toBe(2250) // 2813.25 x 0.8, rounded to 10
    expect(r.adjustment).toBe(-0.2)
    expect(r.flooredAtBmr).toBe(false)
    expect(r).toMatchObject({ protein_g: 167, fat_g: 63, carbs_g: 254, proteinPerKg: 2 })
  })

  it('uses maintenance for maintain and a 10% surplus for gain', () => {
    expect(estimateTargets({ ...man, goal: 'maintain' }).calories).toBe(2810)
    expect(estimateTargets({ ...man, goal: 'gain' }).calories).toBe(3090)
    expect(estimateTargets({ ...man, goal: 'gain' }).proteinPerKg).toBe(1.8)
  })

  it('never sets the target below resting energy, and caps protein at 35% of calories', () => {
    const r = estimateTargets({ sex: 'female', age: 30, heightCm: 160, weightKg: 55, activity: 'sedentary', goal: 'lose' })
    expect(r.flooredAtBmr).toBe(true)
    expect(r.calories).toBe(1240)
    expect(r.adjustment).toBeCloseTo(1239 / 1486.8 - 1, 6)
    expect(r.protein_g).toBe(109) // 2.0 g/kg would be 110 g, over the 35% cap
  })

  it('caps protein for heavy bodies instead of using total body weight', () => {
    const r = estimateTargets({ sex: 'male', age: 40, heightCm: 178, weightKg: 150, activity: 'sedentary', goal: 'lose' })
    expect(r.protein_g * 4).toBeLessThanOrEqual(r.calories * 0.35 + 2)
    expect(r.proteinPerKg).toBeLessThan(2)
  })

  it('always returns macros that agree with the calorie target', () => {
    for (const sex of ['male', 'female'] as const)
      for (const a of ACTIVITY_LEVELS)
        for (const goal of ['lose', 'maintain', 'gain'] as const)
          for (const weightKg of [45, 70, 95, 140])
            for (const age of [18, 45, 80]) {
              const r = estimateTargets({ sex, age, heightCm: 170, weightKg, activity: a.value, goal })
              expect(macrosMismatch(r.calories, r.protein_g, r.carbs_g, r.fat_g)).toBe(false)
              expect(Math.abs(caloriesFromMacros(r.protein_g, r.carbs_g, r.fat_g) - r.calories)).toBeLessThanOrEqual(10)
              expect(r.carbs_g).toBeGreaterThan(0)
            }
  })
})

describe('conversions', () => {
  it('converts feet and inches to cm and back', () => {
    expect(cmFromFeetInches(5, 11)).toBe(180.3)
    expect(feetInchesFromCm(180.3)).toEqual({ feet: 5, inches: 11 })
    expect(feetInchesFromCm(152.4)).toEqual({ feet: 5, inches: 0 })
  })

  it('turns age into a birth year and back', () => {
    expect(birthYearFromAge(30, '2026-10-14')).toBe(1996)
    expect(ageFromBirthYear(1996, '2026-10-14')).toBe(30)
  })
})
