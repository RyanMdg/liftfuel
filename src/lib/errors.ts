/**
 * Converts Supabase, Postgres and network errors into messages safe to show users.
 * Database functions raise readable messages with SQLSTATE 22023 / P0002 / 23502 / 42501;
 * those pass through. Constraint names map to plain-language explanations.
 */

interface PgLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
  name?: string
}

const CONSTRAINT_MESSAGES: Array<[RegExp, string]> = [
  [/foods_macro_mass/, 'Protein, carbs and fat add up to more than the reference amount. Check the values.'],
  [/foods_fiber_within_carbs/, 'Fiber cannot be greater than total carbohydrates.'],
  [/workout_sets_completed_has_reps/, 'Enter reps before marking the set as done.'],
  [/template_exercises_rep_range/, 'The maximum reps must be at least the minimum reps.'],
  [/workout_sessions_one_in_progress/, 'You already have a workout in progress.'],
  [/weight_entries_user_id_entry_date_key/, 'There is already a weigh-in for that date. Edit it instead.'],
  [/nutrition_goals_user_id_entry_date_key|nutrition_goals_user_id_effective_date_key/, 'Targets already start on that date. They have been updated instead.'],
  [/exercises_owner_name_key|exercises_catalog_name_key/, 'You already have an exercise with that name.'],
  [/food_servings_food_id_label_key/, 'Each serving needs a different name.'],
  [/recipe_ingredients_food_id_fkey/, 'This food is used in a recipe. Remove it from the recipe first.'],
  [/template_exercises_exercise_id_fkey|workout_exercises_exercise_id_fkey/, 'This exercise is used in a template or workout, so it cannot be deleted.'],
]

const PASS_THROUGH_CODES = new Set(['22023', 'P0001', 'P0002', '23502'])

export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  const e = error as PgLikeError
  const text = `${e.message ?? ''} ${e.details ?? ''}`

  for (const [pattern, message] of CONSTRAINT_MESSAGES) {
    if (pattern.test(text)) return message
  }
  if (e.code && PASS_THROUGH_CODES.has(e.code) && e.message) return e.message
  if (e.code === '23505') return 'That already exists.'
  if (e.code === '23514') return 'One of the values is outside the allowed range.'
  if (e.code === '42501' || e.status === 401 || e.status === 403) {
    return 'You do not have access to this. Try signing in again.'
  }
  if (e.code === 'PGRST116') return 'That item could not be found. It may have been deleted.'
  if (e.name === 'TypeError' && /fetch/i.test(e.message ?? '')) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  // Supabase Auth errors are written for end users.
  if (e.name === 'AuthApiError' || e.name === 'AuthWeakPasswordError') return e.message ?? fallback
  return fallback
}

/**
 * Throws the Supabase error if present, otherwise returns data.
 * Successful selects, inserts with .select() and RPCs return data; deletes return null,
 * and callers of those ignore the result.
 */
export function unwrap<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error
  return result.data as NonNullable<T>
}
