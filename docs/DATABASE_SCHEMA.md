# Database schema

Postgres on Supabase. Migrations live in `supabase/migrations/`:

| File | Contents |
|---|---|
| `20261014000100_core_schema.sql` | Tables, constraints, indexes, helper triggers, sign-up trigger |
| `20261014000200_row_level_security.sql` | Grants, RLS enablement, all policies |
| `20261014000300_functions_and_views.sql` | Food entry trigger, recipe, food, workout and onboarding RPCs, search, analytics views |
| `20261014000400_reference_catalog.sql` | Shared exercise library (77) and generic foods (38) with servings |
| `20261015000100_general_workout_tracker.sql` | Removes `exercises.powerlifting_lift`. Rebuilds `completed_sets` (adds category and mechanic) and `exercise_records` (adds best set volume and most reps) |
| `20261015000200_usda_meal_agent.sql` | `foods.fdc_id`, `ai_requests` and `consume_ai_request()` (rate limit), `log_usda_foods()` |

**Migration strategy:** never edit a migration that has been applied to any environment. Add a new timestamped file. New tables must repeat the pattern in file 0200: revoke from `anon`, grant needed privileges to `authenticated`, enable RLS, and add one policy per operation. Supabase's default privileges grant new objects to `anon`, so the revoke matters.

## Conventions

- UUID primary keys (`gen_random_uuid()`) for application entities.
- `timestamptz` for timestamps. Diary and session **days** are `date` values computed in the user's profile time zone.
- Owner columns default to `auth.uid()`, so clients usually omit them. RLS `with check` still verifies them.
- Body weight and training load are stored in **kg** (`numeric`). Food quantities are stored in the food's base unit (g or ml).
- `numeric` is used for every nutrition value and measurement. There is no `float`.
- Names are normalised by trigger (trimmed, internal whitespace collapsed).
- `updated_at` is maintained by trigger.

## Tables

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK `auth.users(id)` on delete cascade |
| `display_name` | text | at most 80 characters |
| `weight_unit` | text | `kg` or `lb` (display only) |
| `time_zone` | text | IANA name, validated by trigger (`now() at time zone`) |
| `goal` | text | `lose`, `maintain` or `gain` |
| `onboarding_completed_at` | timestamptz | null until onboarding is done |
| `created_at`, `updated_at` | timestamptz | |

Created by the `on_auth_user_created` trigger (`handle_new_user`, SECURITY DEFINER, empty search_path).

### `nutrition_goals`
`id`, `user_id`, `effective_date` date, `calories` numeric(7,1) 0–20000, `protein_g` numeric(6,1), `carbs_g`, `fat_g`, timestamps. **Unique (`user_id`, `effective_date`).**

### `recipes`
`id`, `owner_id`, `name` (1–120), `notes` (at most 2000), `servings` numeric(6,2) > 0, `cooked_yield_g` numeric(8,1) > 0 (nullable = unknown), timestamps.

### `foods`
| Column | Type | Notes |
|---|---|---|
| `owner_id` | uuid null | **null = shared catalog** (read-only to users) |
| `recipe_id` | uuid unique null | set for a recipe's derived food. Cascades on recipe delete |
| `name`, `brand` | text | |
| `base_unit` | text | `g` or `ml` |
| `reference_amount` | numeric(9,2) | > 0. Nutrients are per this amount, **not assumed to be 100** |
| `calories`, `protein_g`, `carbs_g`, `fat_g` | numeric(8,2) | at least 0 |
| `fiber_g` | numeric(8,2) null | at most carbs + 0.5 |
| `barcode` | text | 6–14 digits |
| `fdc_id` | integer null | USDA FoodData Central id (meal assistant). Unique per owner |
| `preparation` | text | `raw`, `cooked` or `not_applicable` |
| `provenance` | text | `user_entered`, `nutrition_label`, `reference_database`, `estimated` or `recipe_calculated` |
| `provenance_note` | text | at most 300 |

Constraints: `foods_macro_mass` (for grams, P+C+F ≤ reference × 1.02), `foods_recipe_owned`. Indexes: `owner_id`, `lower(name) text_pattern_ops`.

### `food_servings`
`food_id` FK cascade, `label` (1–60), `amount` numeric(9,2) > 0 in the food's base unit, `position`. Unique (`food_id`, `label`).

### `favorite_foods`
PK (`user_id`, `food_id`).

### `recipe_ingredients`
`recipe_id` FK cascade, `food_id` FK **restrict** (a food used in a recipe cannot be deleted), `quantity` > 0, `position`.

### `food_entries`
| Group | Columns |
|---|---|
| Identity | `id`, `user_id`, `entry_date` date, `meal` (`breakfast`, `lunch`, `dinner`, `snacks`) |
| Source | `food_id` FK **set null**, `duplicated_from_id` FK set null |
| Amount | `quantity` > 0 (base units). `serving_id` FK set null, plus snapshot `serving_label`, `serving_amount`, `serving_count` |
| Snapshot | `food_name`, `food_brand`, `base_unit`, `snapshot_reference_amount`, `snapshot_calories`, `snapshot_protein_g`, `snapshot_carbs_g`, `snapshot_fat_g`, `snapshot_fiber_g`, `snapshot_provenance` |
| Computed | `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g` |
| Time | `logged_at`, `created_at`, `updated_at` |

Constraint `food_entries_serving_consistent`: serving fields are all set or all null. Indexes: (`user_id`, `entry_date`), (`user_id`, `logged_at desc`), `food_id`, `serving_id`, `duplicated_from_id`.

### `weight_entries`
`entry_date` date, `weight_kg` numeric(6,2) 20–400, `note` (at most 280). **Unique (`user_id`, `entry_date`)**: one weigh-in per day, and the app upserts.

### `exercises`
`owner_id` null = catalog. `name` (1–80). `equipment`, `category` (body area), `movement_pattern`, `mechanic` (`compound` or `isolation`), `primary_muscles` text[]. (`powerlifting_lift` existed in the first migration and was dropped in `20261015000100`.)
- Unique `lower(name)` among catalog rows, and unique (`owner_id`, `lower(name)`) among custom rows.
- Trigger `validate_exercise_name`: a custom name may not duplicate a catalog name (case and whitespace insensitive).

### `ai_requests`
`id` identity, `user_id`, `kind` (`meal_estimate`), `created_at`. RLS: read and insert own. No update or delete grant, so users cannot reset their usage. Used by `consume_ai_request(kind, hourly_limit)`, which returns false once the limit is reached.

### `workout_templates` and `template_exercises`
Templates: `name`, `notes`. Template exercises: `template_id` FK cascade, `exercise_id` FK restrict, `position`, `planned_sets` 1–20, `rep_min` and `rep_max` 1–100 (max ≥ min), `target_rpe` 5–10 in 0.5 steps, `rest_seconds` 0–1800, `notes`. Unique (`template_id`, `position`), DEFERRABLE.

### `workout_sessions`
`template_id` FK set null, `name`, `session_date`, `status` (`in_progress` or `completed`), `started_at`, `completed_at`, `notes`.
- `(status = 'completed') = (completed_at is not null)`, and `completed_at ≥ started_at`.
- **Partial unique index `workout_sessions_one_in_progress` on (`user_id`) where status = 'in_progress'** prevents duplicate active sessions.

### `workout_exercises`
`session_id` FK cascade, `exercise_id` FK restrict, `position` (unique per session, deferrable), plan copied from the template (`rep_min`, `rep_max`, `target_rpe`, `rest_seconds`, `notes`).

### `workout_sets`
`workout_exercise_id` FK cascade, `set_number` 1–50 (unique per exercise), `set_type` (`warmup`, `working` or `drop`), `load_kg` numeric(7,3) 0–1000 (null = bodyweight), `load_unit` (the unit the user entered), `reps` 0–100, `rpe` 1–10 in 0.5 steps, `completed_at`.
- `workout_sets_completed_has_reps`: a completed set must have reps.

## Views (all `security_invoker = true`)

| View | Purpose |
|---|---|
| `completed_sets` | Completed sets of completed sessions, joined with exercise name, body area (`category`) and `mechanic` |
| `exercise_records` | All-time per exercise: heaviest weight, best e1RM, best set volume (load × reps), most reps, each with its source set and date. Warm-ups excluded |
| `daily_nutrition_totals` | Per user and date: entry count and summed calories and macros |

## RLS policies

RLS is enabled on all 15 tables. Every policy is `to authenticated` and uses `(select auth.uid())`.

| Table | Select | Insert / update / delete |
|---|---|---|
| `profiles` | own | update own (no insert or delete by clients) |
| `nutrition_goals`, `recipes`, `food_entries`, `weight_entries`, `workout_templates` | own | own |
| `workout_sessions` | own | own. Insert also requires `template_id` (if set) to be own |
| `foods`, `exercises` | catalog or own | own only (users cannot create catalog rows) |
| `food_servings` | parent food visible | parent food owned |
| `favorite_foods` | own | own, and the food must be visible |
| `recipe_ingredients` | parent recipe owned | parent recipe owned, and the food visible and not a recipe food |
| `template_exercises` | parent template owned | parent owned, and the exercise visible |
| `workout_exercises` | parent session owned | parent owned, and the exercise visible |
| `workout_sets` | session (via workout_exercise) owned | same |

Grants: `anon` has no table, view or function privileges. `authenticated` gets only the operations listed. Verified in `tests/db/rls.test.ts`: cross-user read, update and delete on every table, foreign-owner inserts, child-to-foreign-parent attachment, references to private rows, RPC misuse, and anonymous access.

## Triggers and functions

| Object | Kind | Behaviour |
|---|---|---|
| `food_entries_compute` | BEFORE INSERT/UPDATE | See nutrition rules below |
| `foods_propagate_to_recipes` | AFTER UPDATE of nutrient columns | Recomputes recipes that use the edited food |
| `recompute_recipe_food(recipe_id)` | function | Builds or updates the recipe's derived food and its "1 serving" size |
| `save_recipe(...)` | RPC | Upserts the recipe, replaces ingredients and recomputes, atomically |
| `save_food(id, food, servings)` | RPC | Creates or edits a custom food and reconciles servings atomically. Refuses `recipe_calculated` |
| `search_foods(query, limit)` | RPC | Every term must appear in name or brand (`position()`, no LIKE escaping needed). Exact, then prefix, then own-before-catalog, then shorter names first |
| `complete_onboarding(...)` | RPC | Profile, first goal and optional weigh-in, atomically |
| `add_template_exercise`, `reorder_template_exercises` | RPC | Positioning with row lock. Reorder requires a full, exact permutation |
| `start_workout(date, template?, name?)` | RPC | Returns the existing in-progress session (`created = false`) or creates one, copying the template and planned sets. Handles concurrent calls via `unique_violation` |
| `add_workout_exercise`, `add_workout_set` | RPC | Next position or set number under a row lock. New sets copy the previous set's type, load and unit |
| `finish_workout(id, discard_incomplete)` | RPC | Idempotent. Needs at least one completed set. Removes uncompleted sets and empty exercises |
| `get_previous_performance(session_id)` | RPC | For each exercise in the session, the completed sets from the most recent **earlier completed** session |
| `log_usda_foods(date, meal, items)` | RPC | Upserts one private food per USDA `fdc_id` (provenance `reference_database`, note with FDC ID and data type, values per 100 g), then inserts the diary entries. Atomic. At most 20 items |
| `consume_ai_request(kind, limit)` | RPC | Rate limit for the meal assistant |
| `validate_profile`, `validate_exercise_name`, `normalize_name`, `set_updated_at` | triggers | Validation and housekeeping |

All functions except `handle_new_user` are SECURITY INVOKER with `search_path = ''`.

## Nutrition calculation rules

1. **Scaling:** `nutrient = quantity / reference_amount × nutrient_per_reference`, rounded to 2 decimals. Foods are not assumed to be per 100 g.
2. **Servings:** when `serving_count` is set, `quantity = serving_count × serving_amount`. The serving must belong to the entry's food.
3. **Snapshot:** on insert, the food's current values are copied into `snapshot_*`. On update, snapshot columns, `user_id` and `logged_at` are reset to their old values, so clients cannot change them. `food_id` may only change to null (the food was deleted).
4. **Copy:** inserting with `duplicated_from_id` copies the source entry's snapshot and amount. The source must belong to the same user.
5. **Client values ignored:** consumed nutrients are always recomputed by the trigger.
6. **Daily totals** sum entry values (view `daily_nutrition_totals`, client `sumTotals`).
7. **Targets:** the goal for date D is the row with the greatest `effective_date ≤ D`. Before the first goal, the client shows the earliest goal, labelled as such.
8. **Recipes:** batch nutrition is the sum of the ingredients. Yield is `cooked_yield_g` when known. Otherwise it is the raw ingredient total, marked `estimated` with a note (ml counted as g, also noted). Any estimated ingredient makes the recipe `estimated`. Recipes cannot contain recipe foods, which prevents cycles.
9. **Provenance:** `estimated` values are labelled "Estimate" in the UI. Catalog foods are `estimated` because their values were not verified line by line against a source database.

## Workout calculation rules

1. **Completed set:** `completed_at` is set, which also requires `reps`.
2. **Counted sets** for volume: completed and not `warmup` (so working and drop sets).
3. **Volume load** = Σ `load_kg × reps` over counted sets. Bodyweight sets (null load) add 0.
4. **e1RM (Epley)** = `load × (1 + reps / 30)`. Eligible only for completed **working** sets with 1 ≤ reps ≤ 10 and load > 0. For reps = 1, e1RM = load.
5. **Records:** heaviest weight, best e1RM, best set volume (load × reps) and most reps per exercise, excluding warm-ups. Ties keep the earliest set.
6. **Exercise graphs:** one value per workout: best e1RM, heaviest weight, session volume (Σ load × reps) or total reps. Workouts without a qualifying set are omitted.
7. **Sets per body area:** completed working and drop sets, counted under the exercise's `category`.
8. **Previous performance** maps by ordinal position among the previous session's completed sets for that exercise.

## USDA rules (meal assistant)

1. Data types are limited to Foundation, SR Legacy and Survey (FNDDS), all published per 100 g. Branded foods are excluded.
2. Energy uses nutrient 1008 (kcal). If that is missing (typical for Foundation foods), it uses 2048 (Atwater specific), then 2047 (Atwater general), and only then 4/4/9 from macros. The source is recorded as `energy_source`.
3. Fiber that exceeds carbohydrate is dropped (set to null) to satisfy `foods_fiber_within_carbs`.
4. Item nutrients = per-100 g value × grams / 100, rounded to 2 decimals.

## Weight rules

Canonical kg (`weight_kg`). Display conversion uses 1 lb = 0.45359237 kg. The trend is a trailing 7-calendar-day mean of real weigh-ins, shown only when the window has at least 3 weigh-ins. Missing days are never filled.
