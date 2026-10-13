# Product specification

## Vision

LiftFuel combines nutrition tracking and strength training in one calm, precise tool. It answers three questions:

1. How much have I eaten today, and what do I have left?
2. How am I progressing in my training?
3. How are my nutrition habits, body weight and strength changing over time?

Principle: **accurate tracking first, useful analytics second, advanced features later.** It must be fully usable by one person from day one. The schema supports many users, each isolated by Row Level Security.

## Target users

| User | Main need |
|---|---|
| General gym-goer | Lose fat, gain muscle or maintain, with simple calorie and macro targets |
| Bodybuilder or recreational lifter | Accurate macros, recipes, progressive overload |
| Strength-focused lifter | Fast set logging, previous performance, per-exercise graphs and personal records |

## User problems

- Food logging is frequent, so slow logging leads to abandoned diaries.
- Generic per-100 g assumptions and recipe yield errors make totals wrong.
- Editing a food silently rewrites past days in many apps.
- Workout apps either slow you down between sets or lose data on refresh.
- Estimated maxes are often presented as if they were tested maxes.
- Daily weight swings are read as fat gain or loss.

## MVP scope (this version)

- Email and password authentication, password reset, protected routes, onboarding.
- Food diary with four meals: search, favourites, recent foods, log by grams or ml or by serving, edit, copy, delete, any date.
- Custom foods with per-reference-amount nutrition, serving sizes and provenance.
- Shared generic food catalog of 38 foods (labelled as estimates).
- Recipes with ingredients, cooked yield, servings, and calculated per-gram and per-serving nutrition.
- Nutrition targets versioned by effective date.
- Exercise library (77 catalog exercises) plus custom exercises.
- Workout templates: ordered exercises with sets, rep range, target RPE and rest.
- Workout logging: inline set table, set types, load, reps, RPE, completion, previous performance, notes, finish or discard.
- Progress: weigh-ins with a trailing average; Hevy-style exercise graphs (estimated 1RM, heaviest weight, session volume, total reps); personal records (heaviest, best e1RM, best set volume, most reps); weekly workouts, volume and sets per body area; nutrition consistency.
- Meal assistant: describe a meal in words. A Mistral model matches USDA FoodData Central foods and portions, macros are calculated from USDA values, and the user reviews and edits before logging.
- Dashboard summarising today plus trends.
- kg or lb display, canonical kg storage. Time-zone-aware diary days.

## Out of scope

- AI beyond the USDA meal assistant: coaching, generated plans, chatbots, "smart" suggestions.
- Powerlifting-specific features (competition lift totals). Removed on 2026-10-14 in favour of general workout tracking.
- Barcode scanning and OCR.
- External food database integration (custom foods and the catalog work without it).
- Social features, sharing, coaching marketplace.
- Native mobile apps (the web app is responsive).
- Timed or distance exercises (planks, carries, cardio).
- Micronutrients beyond fiber.

## Feature requirements and acceptance criteria

### Authentication
- Sign-up, sign-in, sign-out, session persistence and refresh, password reset by email.
- Signed-out visitors to any app route are redirected to `/login` and returned afterwards.
- Users with incomplete profiles are sent to `/onboarding`. Completed users are never sent there, so there is no redirect loop.

### Onboarding
- Collects goal, weight unit, time zone (pre-detected), optional body weight, and calorie and macro targets.
- Saves the profile, first goal and optional weigh-in atomically (`complete_onboarding`).
- Shows macro-derived calories and warns when they differ from the target by more than 5%.
- **Target calculator** (also in Settings > Nutrition targets): sex, age, height and activity level, plus body weight, give a BMR (Mifflin-St Jeor) and maintenance estimate (TDEE). The goal adjusts it (lose −20%, maintain 0, gain +10%, never below BMR), and macros are derived so they add up to the calories (protein 2.0, 1.6 or 1.8 g/kg by goal, capped at 35% of calories; fat 25%; carbohydrates the rest). The calculator fills the fields and the user can still edit them. Formula, not AI. The inputs are saved to the profile for recalculation.

### Food diary
- Totals and remaining amounts update after every add, edit, copy or delete.
- Nutrients are computed by the database: `quantity / reference_amount × nutrient`.
- Each entry snapshots the food's values. Editing or deleting the food never changes past entries.
- Estimated values are labelled "Estimate" wherever they appear.
- The log panel stays open after **Log**. **Log and close** returns to the diary.
- Repeated clicks cannot create duplicate entries.

### Recipes
- Uses an explicit cooked yield when given. Otherwise the yield is the raw weight, labelled as an estimate.
- Editing an ingredient food recalculates recipes that use it. Past diary entries are unchanged.

### Targets
- Changing targets creates or replaces the target row for an effective date. Earlier days keep earlier targets.

### Training
- Only one workout can be in progress. Starting another opens the existing one.
- Each set saves on blur. Refreshing never loses logged sets.
- Completed sets are visually distinct (tint, filled check, `aria-pressed`).
- Finishing removes uncompleted sets and needs at least one completed set.
- The Previous column shows the last completed session's sets for that exercise. Tapping a value copies it.

### Analytics
- e1RM (Epley) only from completed working sets of 1 to 10 reps, always labelled "Estimated".
- Every exercise has graphs and records. Bodyweight exercises use reps-based records.

### Meal assistant
- Nutrient values shown and logged are USDA values per 100 g × grams. Numbers produced by the model are discarded.
- Every item shows the USDA description, FDC ID and data type, and whether the portion came from the user's weight, a USDA serving weight, or an estimate (highlighted).
- Items not matched are listed, never silently dropped.
- Logging is atomic and only happens after the user presses Log.
- The weight trend never interpolates missing days.
- Every chart has a title stating its question, axis units, and a data table.

## Initial success metrics

| Metric | Target |
|---|---|
| Median actions to re-log a recent food | 3 or fewer (open, pick, log) |
| Logging a set | 1 action when using Previous (copy), plus 1 for Done |
| Data loss on refresh mid-workout | None |
| WCAG 2.2 AA conformance | No known failures |
| Diary days with at least one entry, first 4 weeks | Tracked in-app via Progress, "Days logged" |
| First contentful load (gzipped JS before route chunks) | About 140 KB (index plus Supabase chunks) |
