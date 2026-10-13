import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { fetchAllPages } from '@/lib/paginate'
import type { MealEstimate } from '../../../supabase/functions/_shared/meal-agent'
import type {
  DailyNutritionTotal, Food, FoodEntry, FoodInput, FoodServing, Meal, NutritionGoal, Recipe, RecipeIngredient, UsdaLogItem,
} from '@/types/database'

export type FoodWithServings = Food & { food_servings: FoodServing[] }
export type RecentFood = { food: FoodWithServings; quantity: number; serving_id: string | null; serving_count: number | null }
export type RecipeWithFood = Recipe & { food: FoodWithServings | null }
export type RecipeDetail = Recipe & {
  food: FoodWithServings | null
  recipe_ingredients: Array<RecipeIngredient & { food: Food }>
}

const FOOD_WITH_SERVINGS = '*, food_servings(*)'

function sortServings(food: FoodWithServings): FoodWithServings {
  return { ...food, food_servings: [...food.food_servings].sort((a, b) => a.position - b.position) }
}

// ---------------------------------------------------------------- diary

export async function fetchDiary(date: string): Promise<FoodEntry[]> {
  return unwrap(
    await supabase().from('food_entries').select('*').eq('entry_date', date).order('logged_at', { ascending: true }),
  )
}

export interface NewEntry {
  entry_date: string
  meal: Meal
  food_id: string
  quantity?: number
  serving_id?: string | null
  serving_count?: number | null
}

/** Nutrients are computed by the database from a snapshot of the food; never sent by the client. */
export async function addEntry(entry: NewEntry): Promise<FoodEntry> {
  return unwrap(await supabase().from('food_entries').insert(entry).select('*').single())
}

export interface EntryPatch {
  entry_date?: string
  meal?: Meal
  quantity?: number
  serving_id?: string | null
  serving_count?: number | null
}

export async function updateEntry(id: string, patch: EntryPatch): Promise<FoodEntry> {
  return unwrap(await supabase().from('food_entries').update(patch).eq('id', id).select('*').single())
}

export async function deleteEntry(id: string): Promise<void> {
  unwrap(await supabase().from('food_entries').delete().eq('id', id))
}

/** Copies an entry, including its nutrition snapshot, to a date and meal. */
export async function duplicateEntry(id: string, entry_date: string, meal: Meal): Promise<FoodEntry> {
  return unwrap(
    await supabase().from('food_entries').insert({ duplicated_from_id: id, entry_date, meal }).select('*').single(),
  )
}

export async function fetchTotals(from: string, to: string): Promise<DailyNutritionTotal[]> {
  return fetchAllPages((a, b) =>
    supabase().from('daily_nutrition_totals').select('*').gte('entry_date', from).lte('entry_date', to).order('entry_date').range(a, b),
  )
}

// ---------------------------------------------------------------- goals

export async function fetchGoals(): Promise<NutritionGoal[]> {
  return unwrap(await supabase().from('nutrition_goals').select('*').order('effective_date', { ascending: false }))
}

export interface GoalValues {
  effective_date: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** Creates targets effective from a date, or replaces targets that start on that same date. */
export async function saveGoal(userId: string, values: GoalValues): Promise<NutritionGoal> {
  return unwrap(
    await supabase()
      .from('nutrition_goals')
      .upsert({ user_id: userId, ...values }, { onConflict: 'user_id,effective_date' })
      .select('*')
      .single(),
  )
}

export async function deleteGoal(id: string): Promise<void> {
  unwrap(await supabase().from('nutrition_goals').delete().eq('id', id))
}

// ---------------------------------------------------------------- foods

export async function searchFoods(query: string): Promise<FoodWithServings[]> {
  const foods = unwrap(await supabase().rpc('search_foods', { p_query: query, p_limit: 30 }))
  if (foods.length === 0) return []
  const servings = unwrap(
    await supabase().from('food_servings').select('*').in('food_id', foods.map((f) => f.id)).order('position'),
  )
  return foods.map((f) => ({ ...f, food_servings: servings.filter((s) => s.food_id === f.id) }))
}

export async function fetchFood(id: string): Promise<FoodWithServings> {
  const food = unwrap(
    await supabase().from('foods').select(FOOD_WITH_SERVINGS).eq('id', id).single().overrideTypes<FoodWithServings, { merge: false }>(),
  )
  return sortServings(food)
}

/** The user's own custom foods (recipe-derived foods are managed on the recipes page). */
export async function fetchMyFoods(userId: string): Promise<FoodWithServings[]> {
  const foods = unwrap(
    await supabase()
      .from('foods')
      .select(FOOD_WITH_SERVINGS)
      .eq('owner_id', userId)
      .is('recipe_id', null)
      .order('name')
      .overrideTypes<FoodWithServings[], { merge: false }>(),
  )
  return foods.map(sortServings)
}

export async function fetchCatalogFoods(): Promise<FoodWithServings[]> {
  const foods = unwrap(
    await supabase().from('foods').select(FOOD_WITH_SERVINGS).is('owner_id', null).order('name').overrideTypes<FoodWithServings[], { merge: false }>(),
  )
  return foods.map(sortServings)
}

export async function fetchFavorites(): Promise<FoodWithServings[]> {
  const rows = unwrap(
    await supabase()
      .from('favorite_foods')
      .select(`created_at, food:foods(${FOOD_WITH_SERVINGS})`)
      .order('created_at', { ascending: false })
      .overrideTypes<Array<{ created_at: string; food: FoodWithServings | null }>, { merge: false }>(),
  )
  return rows.flatMap((r) => (r.food ? [sortServings(r.food)] : []))
}

/** Most recently logged distinct foods with the quantity used last time. */
export async function fetchRecentFoods(limit = 12): Promise<RecentFood[]> {
  const rows = unwrap(
    await supabase()
      .from('food_entries')
      .select(`food_id, quantity, serving_id, serving_count, food:foods(${FOOD_WITH_SERVINGS})`)
      .not('food_id', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(80)
      .overrideTypes<Array<{ food_id: string; quantity: number; serving_id: string | null; serving_count: number | null; food: FoodWithServings | null }>, { merge: false }>(),
  )
  const seen = new Set<string>()
  const recent: RecentFood[] = []
  for (const r of rows) {
    if (!r.food || seen.has(r.food_id)) continue
    seen.add(r.food_id)
    recent.push({ food: sortServings(r.food), quantity: r.quantity, serving_id: r.serving_id, serving_count: r.serving_count })
    if (recent.length >= limit) break
  }
  return recent
}

export async function saveFood(id: string | null, food: FoodInput, servings: Array<{ id?: string; label: string; amount: number }>): Promise<string> {
  return unwrap(await supabase().rpc('save_food', { p_food_id: id, p_food: food, p_servings: servings }))
}

export async function deleteFood(id: string): Promise<void> {
  unwrap(await supabase().from('foods').delete().eq('id', id))
}

export async function setFavorite(foodId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await supabase().from('favorite_foods').insert({ food_id: foodId })
    // Already a favourite (double click or another tab): treat as success.
    if (error && error.code !== '23505') throw error
  } else {
    unwrap(await supabase().from('favorite_foods').delete().eq('food_id', foodId))
  }
}

// ---------------------------------------------------------------- recipes

export async function fetchRecipes(): Promise<RecipeWithFood[]> {
  const rows = unwrap(
    await supabase()
      .from('recipes')
      .select(`*, food:foods(${FOOD_WITH_SERVINGS})`)
      .order('name')
      .overrideTypes<RecipeWithFood[], { merge: false }>(),
  )
  return rows.map((r) => ({ ...r, food: r.food ? sortServings(r.food) : null }))
}

export async function fetchRecipe(id: string): Promise<RecipeDetail> {
  const recipe = unwrap(
    await supabase()
      .from('recipes')
      .select(`*, food:foods(${FOOD_WITH_SERVINGS}), recipe_ingredients(*, food:foods(*))`)
      .eq('id', id)
      .single()
      .overrideTypes<RecipeDetail, { merge: false }>(),
  )
  return { ...recipe, recipe_ingredients: [...recipe.recipe_ingredients].sort((a, b) => a.position - b.position) }
}

export interface RecipeInput {
  name: string
  notes: string | null
  servings: number | null
  cooked_yield_g: number | null
  ingredients: Array<{ food_id: string; quantity: number }>
}

export async function saveRecipe(id: string | null, input: RecipeInput): Promise<string> {
  return unwrap(
    await supabase().rpc('save_recipe', {
      p_recipe_id: id,
      p_name: input.name,
      p_notes: input.notes,
      p_servings: input.servings,
      p_cooked_yield_g: input.cooked_yield_g,
      p_ingredients: input.ingredients,
    }),
  )
}

export async function deleteRecipe(id: string): Promise<void> {
  unwrap(await supabase().from('recipes').delete().eq('id', id))
}

// ---------------------------------------------------------------- meal assistant (USDA)

export type { MealEstimate, EstimatedItem } from '../../../supabase/functions/_shared/meal-agent'

/**
 * Asks the meal-estimate Edge Function to match a free-text meal to USDA foods.
 * Returns suggestions only; nothing is written until logUsdaFoods is called.
 */
export async function estimateMeal(text: string): Promise<MealEstimate> {
  const { data, error } = await supabase().functions.invoke<MealEstimate>('meal-estimate', { body: { text } })
  if (error) {
    let message = 'The meal assistant is unavailable. Use search instead.'
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const body = (await context.json()) as { error?: { message?: string } }
        if (body?.error?.message) message = body.error.message
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message)
  }
  if (!data) throw new Error('The meal assistant returned nothing. Try again.')
  return data
}

/** Logs reviewed USDA items atomically; each USDA food is stored once per user. */
export async function logUsdaFoods(entryDate: string, meal: Meal, items: UsdaLogItem[]): Promise<number> {
  return unwrap(await supabase().rpc('log_usda_foods', { p_entry_date: entryDate, p_meal: meal, p_items: items }))
}
