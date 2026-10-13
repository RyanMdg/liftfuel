# API and data access

There is no custom REST API. The browser talks to Supabase directly through `supabase-js`:

- **PostgREST** for table and view CRUD (RLS enforced)
- **RPC** for multi-row or trusted operations (Postgres functions, SECURITY INVOKER)
- **GoTrue** for authentication

One Edge Function, `meal-estimate`, holds third-party API keys. It does not use the service-role key: it acts as the calling user.

All calls live in `src/features/*/api.ts`, are wrapped by hooks in `src/features/*/hooks.ts`, and use keys from `src/lib/queryKeys.ts`. `unwrap()` throws Supabase errors. `toUserMessage()` turns them into UI text.

## Auth (`features/auth/api.ts`)

| Function | Supabase call |
|---|---|
| `signIn(email, password)` | `auth.signInWithPassword` |
| `signUp(email, password)` | `auth.signUp` with `emailRedirectTo: /onboarding`. Returns whether a session was created |
| `signOut()` | `auth.signOut` |
| `requestPasswordReset(email)` | `auth.resetPasswordForEmail` with `redirectTo: /reset-password` |
| `updatePassword(password)` | `auth.updateUser` |
| `fetchProfile(userId)` / `updateProfile(userId, patch)` | `profiles` select / update |
| RPC `complete_onboarding` | Called from `OnboardingPage` |

## Nutrition (`features/nutrition/api.ts`)

| Function | Query | Notes |
|---|---|---|
| `fetchDiary(date)` | `food_entries` where `entry_date = date`, ordered by `logged_at` | |
| `addEntry({entry_date, meal, food_id, quantity \| serving_id + serving_count})` | insert | Nutrients and snapshot set by trigger |
| `updateEntry(id, patch)` | update `quantity`, serving, `meal`, `entry_date` | Recomputed from the snapshot |
| `deleteEntry(id)` | delete | |
| `duplicateEntry(id, date, meal)` | insert `{duplicated_from_id}` | Copies the snapshot |
| `fetchTotals(from, to)` | view `daily_nutrition_totals`, paginated | |
| `fetchGoals()` | `nutrition_goals`, newest first | |
| `saveGoal(userId, values)` | upsert on (`user_id`, `effective_date`) | |
| `deleteGoal(id)` | delete | The UI prevents deleting the last goal |
| `searchFoods(q)` | RPC `search_foods`, then `food_servings in (...)` | |
| `fetchFood(id)` | `foods` with `food_servings(*)` | |
| `fetchMyFoods(userId)` / `fetchCatalogFoods()` | `foods` by owner, excluding recipe foods / `owner_id is null` | |
| `fetchFavorites()` | `favorite_foods` with embedded `food:foods(*, food_servings(*))` | |
| `fetchRecentFoods()` | last 80 entries with a food, de-duplicated to 12 | Includes the last quantity and serving |
| `saveFood(id, food, servings)` | RPC `save_food` | Atomic food and servings |
| `deleteFood(id)` | delete | Blocked by FK if used in a recipe (friendly message) |
| `setFavorite(foodId, bool)` | insert or delete `favorite_foods` | A duplicate insert is treated as success |
| `fetchRecipes()` / `fetchRecipe(id)` | `recipes` with `food:foods(...)` (and `recipe_ingredients(*, food:foods(*))`) | |
| `saveRecipe(id, input)` | RPC `save_recipe` | |
| `deleteRecipe(id)` | delete | Cascades to the derived food. Entries keep their snapshot |

## Meal assistant

| Function | Call | Notes |
|---|---|---|
| `estimateMeal(text)` | `functions.invoke('meal-estimate', { body: { text } })` | Returns `{ items, unmatched, source, model }`. Readable errors from the `{ error: { code, message } }` body |
| `logUsdaFoods(date, meal, items)` | RPC `log_usda_foods` | After user review. Items carry USDA per-100 g values and grams |

**Edge Function contract (`POST /functions/v1/meal-estimate`)**
- Request: `{ "text": string (1–600 chars) }` with the user's `Authorization: Bearer <jwt>`.
- 200: `{ items: [{ label, fdc_id, description, data_type, grams, portion_basis: 'user_weight'|'usda_portion'|'estimate', note, per100g: {calories, protein_g, carbs_g, fat_g, fiber_g, energy_source}, nutrients }], unmatched: string[], source, model }`
- Errors: 400 `bad_request`, 401 `unauthorized`, 429 `rate_limited`, 422 `agent_failed` or `invalid_output`, 502 `usda_failed`, 503 `not_configured`.
- Secrets: `MISTRAL_API_KEY`, `USDA_FDC_API_KEY`, optional `MISTRAL_AGENT_ID` (uses `/v1/agents/completions`) and `MISTRAL_MODEL` (default `mistral-medium-latest`, `/v1/chat/completions`).

## Training (`features/training/api.ts`)

| Function | Query |
|---|---|
| `fetchExercises()` / `createExercise(input)` | `exercises` (catalog and own) / insert |
| `fetchTemplates()` | `workout_templates` with `template_exercises(*, exercise:exercises(*))` |
| `createTemplate`, `updateTemplate`, `deleteTemplate` | table CRUD |
| `addTemplateExercise(t, e)` | RPC `add_template_exercise` |
| `updateTemplateExercise`, `removeTemplateExercise` | table update / delete |
| `reorderTemplateExercises(t, ids)` | RPC `reorder_template_exercises` |
| `startWorkout(date, templateId?, name?)` | RPC `start_workout` returns `{session_id, created}` |
| `fetchActiveSession()` | `workout_sessions` where `status = in_progress` (`maybeSingle`) |
| `fetchSession(id)` | session with `workout_exercises(*, exercise:exercises(*), workout_sets(*))` |
| `fetchHistory(limit)` / `fetchSessionsOnDate(date)` | sessions with a minimal set summary embed |
| `updateSession`, `deleteSession` | table update / delete (cascades) |
| `finishWorkout(id)` | RPC `finish_workout` (discards incomplete sets) |
| `addWorkoutExercise(s, e, sets)` / `removeWorkoutExercise` | RPC `add_workout_exercise` / delete |
| `addSet(we)` / `updateSet(id, patch)` / `deleteSet(id)` | RPC `add_workout_set` / update with `.select()` / delete |
| `fetchPrevious(sessionId)` | RPC `get_previous_performance` |
| `fetchCompletedSets(fromDate)` | view `completed_sets`, paginated |
| `fetchExerciseRecords()` | view `exercise_records`, paginated |

## Progress (`features/progress/api.ts`)

| Function | Query |
|---|---|
| `fetchWeights()` | `weight_entries`, all, paginated |
| `saveWeight(userId, input)` | upsert on (`user_id`, `entry_date`) |
| `updateWeight(id, input)` / `deleteWeight(id)` | update / delete |

## Pagination

`lib/paginate.ts#fetchAllPages` requests `range(from, from + 999)` until a short page arrives (capped at 50,000 rows). It is used for every long-range or all-time read, so Supabase's default 1,000-row cap never silently truncates analytics.

## Cache invalidation map

| Mutation | Invalidates |
|---|---|
| Diary add, edit, copy, delete | `diary/<date>` (old and new date), `nutrition-totals`, `foods/recent` |
| Goal save or delete | `goals` |
| Food save or delete, favourite | `foods/*` (and `recipes` on save) |
| Recipe save or delete | `recipes`, `foods` |
| Template changes | `templates` |
| Workout start, finish, exercise or set changes | `workouts/*`, `completed-sets`, the session detail |
| Set update | Optimistic write to the session detail, then invalidate it and `completed-sets` |
| Weight save or delete | `weights` |
| Profile update | Sets `profile/<id>` directly |
