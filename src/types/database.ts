/**
 * Database types for supabase-js.
 *
 * Hand-maintained to match supabase/migrations. When a Supabase project is linked,
 * regenerate with:  npx supabase gen types typescript --linked > src/types/database.ts
 * and keep the convenience aliases at the bottom of this file.
 *
 * PostgREST serialises Postgres numeric as JSON numbers, so numeric columns are `number`.
 */

type Rel<FK extends string, Col extends string, Ref extends string, OneToOne extends boolean = false> = {
  foreignKeyName: FK
  columns: [Col]
  isOneToOne: OneToOne
  referencedRelation: Ref
  referencedColumns: ['id']
}

export type WeightUnit = 'kg' | 'lb'
export type Goal = 'lose' | 'maintain' | 'gain'
export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'
export type BaseUnit = 'g' | 'ml'
export type Preparation = 'raw' | 'cooked' | 'not_applicable'
export type Provenance = 'user_entered' | 'nutrition_label' | 'reference_database' | 'estimated' | 'recipe_calculated'
export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell'
  | 'smith_machine' | 'ez_bar' | 'trap_bar' | 'band' | 'other'
export type ExerciseCategory = 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'full_body'
export type MovementPattern =
  | 'squat' | 'hinge' | 'lunge' | 'horizontal_push' | 'vertical_push' | 'horizontal_pull'
  | 'vertical_pull' | 'fly' | 'raise' | 'curl' | 'extension' | 'calf_raise' | 'core' | 'carry' | 'other'
export type Mechanic = 'compound' | 'isolation'
export type SetType = 'warmup' | 'working' | 'drop'
export type SessionStatus = 'in_progress' | 'completed'

type ProfileRow = {
  id: string
  display_name: string | null
  weight_unit: WeightUnit
  time_zone: string
  goal: Goal | null
  sex: Sex | null
  birth_year: number | null
  height_cm: number | null
  activity_level: ActivityLevel | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

type NutritionGoalRow = {
  id: string
  user_id: string
  effective_date: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  created_at: string
  updated_at: string
}

type RecipeRow = {
  id: string
  owner_id: string
  name: string
  notes: string | null
  servings: number | null
  cooked_yield_g: number | null
  created_at: string
  updated_at: string
}

type FoodRow = {
  id: string
  owner_id: string | null
  recipe_id: string | null
  name: string
  brand: string | null
  base_unit: BaseUnit
  reference_amount: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  barcode: string | null
  preparation: Preparation
  provenance: Provenance
  provenance_note: string | null
  /** USDA FoodData Central id for foods logged through the meal assistant. */
  fdc_id: number | null
  created_at: string
  updated_at: string
}

type FoodServingRow = {
  id: string
  food_id: string
  label: string
  amount: number
  position: number
  created_at: string
}

type FavoriteFoodRow = {
  user_id: string
  food_id: string
  created_at: string
}

type RecipeIngredientRow = {
  id: string
  recipe_id: string
  food_id: string
  quantity: number
  position: number
  created_at: string
}

type FoodEntryRow = {
  id: string
  user_id: string
  entry_date: string
  meal: Meal
  food_id: string | null
  duplicated_from_id: string | null
  quantity: number
  serving_id: string | null
  serving_label: string | null
  serving_amount: number | null
  serving_count: number | null
  food_name: string
  food_brand: string | null
  base_unit: BaseUnit
  snapshot_reference_amount: number
  snapshot_calories: number
  snapshot_protein_g: number
  snapshot_carbs_g: number
  snapshot_fat_g: number
  snapshot_fiber_g: number | null
  snapshot_provenance: Provenance
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  logged_at: string
  created_at: string
  updated_at: string
}

type WeightEntryRow = {
  id: string
  user_id: string
  entry_date: string
  weight_kg: number
  note: string | null
  created_at: string
  updated_at: string
}

type ExerciseRow = {
  id: string
  owner_id: string | null
  name: string
  equipment: Equipment
  category: ExerciseCategory
  movement_pattern: MovementPattern
  mechanic: Mechanic
  primary_muscles: string[]
  created_at: string
  updated_at: string
}

type WorkoutTemplateRow = {
  id: string
  user_id: string
  name: string
  notes: string | null
  created_at: string
  updated_at: string
}

type TemplateExerciseRow = {
  id: string
  template_id: string
  exercise_id: string
  position: number
  planned_sets: number
  rep_min: number | null
  rep_max: number | null
  target_rpe: number | null
  rest_seconds: number | null
  notes: string | null
  created_at: string
}

type WorkoutSessionRow = {
  id: string
  user_id: string
  template_id: string | null
  name: string
  session_date: string
  status: SessionStatus
  started_at: string
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type WorkoutExerciseRow = {
  id: string
  session_id: string
  exercise_id: string
  position: number
  rep_min: number | null
  rep_max: number | null
  target_rpe: number | null
  rest_seconds: number | null
  notes: string | null
  created_at: string
}

type WorkoutSetRow = {
  id: string
  workout_exercise_id: string
  set_number: number
  set_type: SetType
  load_kg: number | null
  load_unit: WeightUnit
  reps: number | null
  rpe: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

type CompletedSetRow = {
  set_id: string
  user_id: string
  session_id: string
  session_date: string
  session_completed_at: string
  workout_exercise_id: string
  exercise_id: string
  exercise_name: string
  category: ExerciseCategory
  mechanic: Mechanic
  set_number: number
  set_type: SetType
  load_kg: number | null
  load_unit: WeightUnit
  reps: number
  rpe: number | null
  completed_at: string
}

type ExerciseRecordRow = {
  user_id: string
  exercise_id: string
  exercise_name: string
  category: ExerciseCategory
  heaviest_kg: number | null
  heaviest_reps: number | null
  heaviest_date: string | null
  best_e1rm: number | null
  e1rm_load_kg: number | null
  e1rm_reps: number | null
  e1rm_date: string | null
  best_set_volume_kg: number | null
  volume_load_kg: number | null
  volume_reps: number | null
  volume_date: string | null
  max_reps: number
  max_reps_load_kg: number | null
  max_reps_date: string
}

type DailyNutritionTotalRow = {
  user_id: string
  entry_date: string
  entry_count: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** One reviewed item for log_usda_foods. Nutrients are USDA values per 100 g. */
export type UsdaLogItem = {
  fdc_id: number
  description: string
  data_type: string
  grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
}

/** Payload accepted by the save_food RPC. */
export type FoodInput = {
  name: string
  brand: string | null
  base_unit: BaseUnit
  reference_amount: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  barcode: string | null
  preparation: Preparation
  provenance: Exclude<Provenance, 'recipe_calculated'>
  provenance_note: string | null
}

/** Columns with defaults or filled by triggers are optional on insert. */
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
type Table<R, I, Rels extends unknown[] = []> = {
  Row: R
  Insert: I
  Update: Partial<I>
  Relationships: Rels
}

type CommonDefaults = 'id' | 'created_at' | 'updated_at'

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Optional<ProfileRow, 'display_name' | 'weight_unit' | 'time_zone' | 'goal' | 'sex' | 'birth_year' | 'height_cm' | 'activity_level' | 'onboarding_completed_at' | 'created_at' | 'updated_at'>>
      nutrition_goals: Table<NutritionGoalRow, Optional<NutritionGoalRow, CommonDefaults | 'user_id'>>
      recipes: Table<RecipeRow, Optional<RecipeRow, CommonDefaults | 'owner_id' | 'notes' | 'servings' | 'cooked_yield_g'>>
      foods: Table<
        FoodRow,
        Optional<FoodRow, CommonDefaults | 'owner_id' | 'recipe_id' | 'brand' | 'base_unit' | 'reference_amount' | 'fiber_g' | 'barcode' | 'preparation' | 'provenance' | 'provenance_note' | 'fdc_id'>,
        [Rel<'foods_recipe_id_fkey', 'recipe_id', 'recipes', true>]
      >
      food_servings: Table<
        FoodServingRow,
        Optional<FoodServingRow, 'id' | 'created_at' | 'position'>,
        [Rel<'food_servings_food_id_fkey', 'food_id', 'foods'>]
      >
      favorite_foods: Table<
        FavoriteFoodRow,
        Optional<FavoriteFoodRow, 'user_id' | 'created_at'>,
        [Rel<'favorite_foods_food_id_fkey', 'food_id', 'foods'>]
      >
      recipe_ingredients: Table<
        RecipeIngredientRow,
        Optional<RecipeIngredientRow, 'id' | 'created_at' | 'position'>,
        [Rel<'recipe_ingredients_recipe_id_fkey', 'recipe_id', 'recipes'>, Rel<'recipe_ingredients_food_id_fkey', 'food_id', 'foods'>]
      >
      food_entries: Table<
        FoodEntryRow,
        // Snapshot and computed columns are written by the food_entries_compute trigger.
        {
          entry_date: string
          meal: Meal
          food_id?: string | null
          duplicated_from_id?: string | null
          quantity?: number
          serving_id?: string | null
          serving_count?: number | null
          user_id?: string
        },
        [Rel<'food_entries_food_id_fkey', 'food_id', 'foods'>, Rel<'food_entries_serving_id_fkey', 'serving_id', 'food_servings'>]
      >
      weight_entries: Table<WeightEntryRow, Optional<WeightEntryRow, CommonDefaults | 'user_id' | 'note'>>
      exercises: Table<ExerciseRow, Optional<ExerciseRow, CommonDefaults | 'owner_id' | 'primary_muscles'>>
      workout_templates: Table<WorkoutTemplateRow, Optional<WorkoutTemplateRow, CommonDefaults | 'user_id' | 'notes'>>
      template_exercises: Table<
        TemplateExerciseRow,
        Optional<TemplateExerciseRow, 'id' | 'created_at' | 'planned_sets' | 'rep_min' | 'rep_max' | 'target_rpe' | 'rest_seconds' | 'notes'>,
        [Rel<'template_exercises_template_id_fkey', 'template_id', 'workout_templates'>, Rel<'template_exercises_exercise_id_fkey', 'exercise_id', 'exercises'>]
      >
      workout_sessions: Table<
        WorkoutSessionRow,
        Optional<WorkoutSessionRow, CommonDefaults | 'user_id' | 'template_id' | 'status' | 'started_at' | 'completed_at' | 'notes'>,
        [Rel<'workout_sessions_template_id_fkey', 'template_id', 'workout_templates'>]
      >
      workout_exercises: Table<
        WorkoutExerciseRow,
        Optional<WorkoutExerciseRow, 'id' | 'created_at' | 'rep_min' | 'rep_max' | 'target_rpe' | 'rest_seconds' | 'notes'>,
        [Rel<'workout_exercises_session_id_fkey', 'session_id', 'workout_sessions'>, Rel<'workout_exercises_exercise_id_fkey', 'exercise_id', 'exercises'>]
      >
      workout_sets: Table<
        WorkoutSetRow,
        Optional<WorkoutSetRow, CommonDefaults | 'set_type' | 'load_kg' | 'load_unit' | 'reps' | 'rpe' | 'completed_at'>,
        [Rel<'workout_sets_workout_exercise_id_fkey', 'workout_exercise_id', 'workout_exercises'>]
      >
    }
    Views: {
      completed_sets: { Row: CompletedSetRow; Relationships: [] }
      exercise_records: { Row: ExerciseRecordRow; Relationships: [] }
      daily_nutrition_totals: { Row: DailyNutritionTotalRow; Relationships: [] }
    }
    Functions: {
      save_food: {
        Args: { p_food_id: string | null; p_food: FoodInput; p_servings?: Array<{ id?: string; label: string; amount: number }> }
        Returns: string
      }
      search_foods: { Args: { p_query: string; p_limit?: number }; Returns: FoodRow[] }
      save_recipe: {
        Args: {
          p_recipe_id: string | null
          p_name: string
          p_notes: string | null
          p_servings: number | null
          p_cooked_yield_g: number | null
          p_ingredients: Array<{ food_id: string; quantity: number }>
        }
        Returns: string
      }
      complete_onboarding: {
        Args: {
          p_display_name: string
          p_weight_unit: WeightUnit
          p_time_zone: string
          p_goal: Goal
          p_start_date: string
          p_calories: number
          p_protein_g: number
          p_carbs_g: number
          p_fat_g: number
          p_weight_kg?: number | null
        }
        Returns: undefined
      }
      log_usda_foods: { Args: { p_entry_date: string; p_meal: Meal; p_items: UsdaLogItem[] }; Returns: number }
      consume_ai_request: { Args: { p_kind: 'meal_estimate'; p_hourly_limit?: number }; Returns: boolean }
      add_template_exercise: { Args: { p_template_id: string; p_exercise_id: string }; Returns: string }
      reorder_template_exercises: { Args: { p_template_id: string; p_ordered_ids: string[] }; Returns: undefined }
      start_workout: {
        Args: { p_session_date: string; p_template_id?: string | null; p_name?: string | null }
        Returns: Array<{ session_id: string; created: boolean }>
      }
      add_workout_exercise: { Args: { p_session_id: string; p_exercise_id: string; p_sets?: number }; Returns: string }
      add_workout_set: { Args: { p_workout_exercise_id: string }; Returns: string }
      finish_workout: { Args: { p_session_id: string; p_discard_incomplete?: boolean }; Returns: undefined }
      get_previous_performance: {
        Args: { p_session_id: string }
        Returns: Array<{
          exercise_id: string
          session_id: string
          session_date: string
          set_ordinal: number
          set_type: SetType
          load_kg: number | null
          load_unit: WeightUnit
          reps: number
          rpe: number | null
        }>
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicTables = Database['public']['Tables']
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

export type Profile = ProfileRow
export type NutritionGoal = NutritionGoalRow
export type Food = FoodRow
export type FoodServing = FoodServingRow
export type FoodEntry = FoodEntryRow
export type Recipe = RecipeRow
export type RecipeIngredient = RecipeIngredientRow
export type WeightEntry = WeightEntryRow
export type Exercise = ExerciseRow
export type WorkoutTemplate = WorkoutTemplateRow
export type TemplateExercise = TemplateExerciseRow
export type WorkoutSession = WorkoutSessionRow
export type WorkoutExercise = WorkoutExerciseRow
export type WorkoutSet = WorkoutSetRow
export type CompletedSet = CompletedSetRow
export type DailyNutritionTotal = DailyNutritionTotalRow
export type ExerciseRecord = ExerciseRecordRow
export type PreviousSet = Database['public']['Functions']['get_previous_performance']['Returns'][number]
