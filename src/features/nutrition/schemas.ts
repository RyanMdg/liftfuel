import { z } from 'zod'

/** Empty input -> undefined, otherwise a number (form inputs give strings). */
export function optionalNumber<T extends z.ZodNumber>(inner: T) {
  return z.preprocess((v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : Number(v)), inner.optional())
}

export function requiredNumber<T extends z.ZodNumber>(inner: T, message = 'Required') {
  return z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number({ message }).pipe(inner))
}

export const goalTargetsSchema = z.object({
  calories: requiredNumber(z.number().min(500, 'At least 500 kcal').max(20000, 'At most 20,000 kcal'), 'Enter a calorie target'),
  protein_g: requiredNumber(z.number().min(0, 'Cannot be negative').max(2000, 'Too high'), 'Enter a protein target'),
  carbs_g: requiredNumber(z.number().min(0, 'Cannot be negative').max(3000, 'Too high'), 'Enter a carbohydrate target'),
  fat_g: requiredNumber(z.number().min(0, 'Cannot be negative').max(1000, 'Too high'), 'Enter a fat target'),
})
