# AGENTS.md: Instructions for AI coding sessions

**Read this file completely before making any change.** Then read the docs that are relevant to your task:

| Task touches | Read first |
|---|---|
| Any UI | `docs/DESIGN_SYSTEM.md`, `docs/research/ui-ux-research.md` |
| Database, RLS, migrations | `docs/DATABASE_SCHEMA.md` |
| Data fetching or mutations | `docs/API_AND_DATA_ACCESS.md`, `docs/ARCHITECTURE.md` |
| Scope or features | `docs/PRODUCT_SPEC.md` |
| What to do next | `docs/IMPLEMENTATION_PLAN.md` |

## 1. Product

**LiftFuel** is a web app for nutrition tracking (food diary, macros, recipes) and workout tracking in the style of Hevy (templates, set logging, per-exercise graphs and personal records), plus body-weight progress. The name is configurable with `VITE_APP_NAME` and read through `src/app/config.ts`. Never hardcode the product name in components.

Target users: general gym-goers, bodybuilders and recreational lifters tracking macros and training.

Principle: **accurate tracking first, useful analytics second, advanced features later.**

**AI scope (decided by the product owner on 2026-10-14):** exactly one AI feature is allowed, the **USDA meal assistant**. A Mistral model turns a meal description into USDA FoodData Central foods and gram amounts for the user to review. Rules for it:
- Nutrient values always come from USDA data fetched by our code (`supabase/functions/_shared/meal-agent.ts`). Never from model output.
- The model may only use `fdc_id` values returned by the search tool. Anything else is rejected.
- Nothing is logged without explicit user review (`log_usda_foods` is called by the client after confirmation).
- Model calls happen only in the `meal-estimate` Edge Function. API keys are Supabase secrets, never `VITE_` variables. Rate limit: `consume_ai_request`.

Still out of scope: AI coaching, generated meal or training plans, chatbots, other "smart" suggestions. No barcode scanning or OCR yet. Powerlifting-specific features (competition totals) were removed on purpose.

## 2. Stack (do not substitute)

- React 19, Vite 8, TypeScript (strict, pinned to 6.0.x because typescript-eslint does not support TS 7 yet)
- Tailwind CSS **v4** via `@tailwindcss/vite`. Tokens live in `src/styles/index.css` under `@theme`. There is **no** `tailwind.config.js`; do not add one.
- React Router 7 (`react-router` package, data router via `createBrowserRouter`)
- TanStack Query 5 for server state, React Hook Form with Zod 4 for forms
- Recharts 3 for charts, Lucide React for icons
- Montserrat Variable, self-hosted via `@fontsource-variable/montserrat`
- Supabase: Postgres, Auth and RLS. **No Express, ORM or second database.**
- Vitest, React Testing Library, PGlite (in-process Postgres for migration and RLS tests), Playwright

## 3. Brand and design rules (non-negotiable)

Exact colours:

| Token | Hex | Use |
|---|---|---|
| Deep Navy (`navy`, `ink`) | `#030027` | Primary text, sidebar, dark surfaces |
| White (`white`) | `#FFFFFF` | Page background, text on navy |
| Deep Teal (`teal`) | `#0A575C` | Primary actions, links, selection, chart emphasis |

Neutrals and the functional `danger` red are defined in `docs/DESIGN_SYSTEM.md`. Use only the tokens defined there. Tailwind's default palette is removed (`--color-*: initial`), so `bg-blue-500` and similar classes do not exist on purpose.

**Font:** Montserrat everywhere. Use `tabular-nums` (the `num` utility) for numbers in tables, stat values and inputs. Hero figures (`Stat size="lg"`) use proportional digits. Show signed changes with `formatSigned` (true minus sign).

**Anti-patterns. Do not introduce these, and remove them if you find them:**

1. Rounded coloured boxes behind ordinary text, headings, stats or lists. Use typography, whitespace and hairline dividers instead.
2. A card for every metric. Stats sit in a grid on the page background.
3. Gradients, glows, neon, drop-shadow decoration, floating decorative shapes.
4. **Decorative centred dots between text** (`·`, `•`). Use spacing, a comma, a vertical divider (`<Divider vertical />`) or separate labels.
5. Pill-shaped containers used as decoration. Status tags are plain text or small outlined labels.
6. Emoji as icons. Use Lucide icons at a consistent size (16 or 20) with a stroke width of 1.75.
7. Teal backgrounds behind paragraphs.
8. Everything bold. Use the documented type scale.
9. Clickable-looking elements that do nothing.
10. Hardcoded or fake statistics. Every number comes from persisted data.

Rounded corners (4px) are allowed on buttons, inputs, menus and dialogs only.

## 4. Coding conventions

- **Inspect before modifying.** Read the existing file and its neighbours. Preserve working code. Never overwrite unrelated work.
- TypeScript strict. No `any`. Prefer `unknown` with narrowing.
- Feature folders: `src/features/<domain>/` holds that domain's pages, components, `api.ts` (Supabase calls) and `hooks.ts` (TanStack Query hooks). Shared UI lives in `src/components/ui/`. Layout lives in `src/components/layout/`.
- Pure calculation logic lives in `src/lib/` (`nutrition.ts`, `training.ts`, `weight.ts`, `units.ts`, `dates.ts`). It must be framework-free and unit-tested.
- Components never call `supabase` directly. Go through `features/*/api.ts`, then `hooks.ts`.
- Query keys come from `src/lib/queryKeys.ts`. Invalidate the narrowest keys that are correct.
- Forms use React Hook Form with a Zod schema. Every input uses the shared inputs in `components/ui/Field.tsx`, which have visible labels.
- Any submit that creates data goes through `useSingleFlight` (or a disabled-while-pending button) so double clicks cannot create duplicates.
- Charts use `ChartFrame` (question-style title, unit, legend for 2+ series, data table). Read the dataviz guidance before adding a chart type.
- Icon-only buttons use `<IconButton label="...">`. The label is required.
- Dates: a diary or workout "day" is a `date` string (`YYYY-MM-DD`) computed in the user's profile time zone with `todayInZone()` from `src/lib/dates.ts`. Never use `new Date().toISOString().slice(0, 10)`, which gives the UTC date.
- Units: weight and load are stored in **kg**, nutrition quantities in grams or ml. Convert only for display, using `src/lib/units.ts`.
- Do not add dependencies without a clear reason. Record that reason in `docs/ARCHITECTURE.md`.

## 5. Supabase and security

- All schema changes go in a **new** timestamped file in `supabase/migrations/`. Never edit a migration that may already have been applied; add a new one instead.
- Every user-owned table has RLS enabled, with one policy per operation, `to authenticated`, and `(select auth.uid())`.
- Child tables (for example `workout_sets`) check ownership through the parent with `exists (...)` subqueries. Never trust a client-supplied `user_id` without a `with check`.
- **Never disable RLS to make something work.** Never put the secret or `service_role` key in the browser or the repo. The browser uses `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Multi-row atomic operations (start workout, finish workout, save recipe, save food, complete onboarding, reorder) are Postgres functions with `security invoker`, so RLS still applies.
- **New tables, views or functions:** Supabase's default privileges grant them to `anon`. Every migration that adds one must revoke from `anon` (and `public` for functions), grant only what `authenticated` needs, enable RLS, and add policies. Add a case to `tests/db/rls.test.ts`.
- Long-range reads must use `fetchAllPages` (PostgREST caps responses at 1,000 rows by default).
- Nutrition values on `food_entries` are computed by the `food_entries_compute` trigger from a snapshot. The client never supplies calories or macros for an entry.
- After a schema change, update `src/types/database.ts` (hand-maintained; regenerate with `supabase gen types typescript` when a project is linked) and `docs/DATABASE_SCHEMA.md`.

## 6. Calculation rules

- Food entry nutrient = `quantity / snapshot_reference_amount × snapshot_nutrient`. Foods are **not** assumed to be per 100 g.
- Nutrition target for date D = the `nutrition_goals` row with the greatest `effective_date <= D`.
- e1RM = Epley `load × (1 + reps / 30)`. It is eligible only for **completed working sets with 1–10 reps and load > 0**. For reps = 1, e1RM = load. Always label it "Estimated".
- Training volume = Σ(load_kg × reps) over completed **working** sets. Warm-ups are excluded.
- Exercise records (SQL view `exercise_records`): heaviest weight, best e1RM, best set volume (load × reps) and most reps. Warm-ups are excluded.
- Exercise graphs (`exerciseSeries`): one value per workout (best e1RM, heaviest weight, session volume, total reps). Never zero-fill missing workouts.
- Target calculator (`src/lib/energy.ts`): BMR = Mifflin-St Jeor `10 W + 6.25 H − 5 A + 5` (male) or `− 161` (female). TDEE = BMR × activity factor (1.2, 1.375, 1.55, 1.725 or 1.9). Calories = TDEE × (1 − 20%, 1, or 1 + 10%) by goal, never below BMR, rounded to 10. Protein g/kg by goal (2.0, 1.6, 1.8) capped at 35% of calories, fat 25%, carbohydrates the remainder. This is deterministic code, never a model call.
- Weight trend = trailing 7-day mean of real weigh-ins, shown only with at least 3 weigh-ins in the window. Never interpolate.

## 7. Testing and verification

Before declaring work done, run and report honestly:

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint
npm test            # vitest: unit, component and PGlite database tests
npm run build       # production build
```

- `tests/db/` runs the real migrations in PGlite (Postgres 18 WASM) with a minimal Supabase `auth` stub. It verifies RLS, triggers and RPCs. It is **not** a substitute for testing against a real Supabase project; say so when reporting.
- **Never claim a test passed unless you ran it and saw it pass.** Never weaken or delete meaningful assertions to make a test pass.
- E2E (Playwright) needs a configured Supabase project. If one is not available, report the e2e tests as unverified.

## 8. Research requirement for UI/UX changes

Before a major UI or UX change (a new screen, a new interaction model, a new chart type), consult current credible sources: official docs, WCAG, NN/g, and established fitness products. Add the sources (title, URL, access date) and decisions to `docs/research/ui-ux-research.md`. Never fabricate sources.

## 9. Documentation duty

After any architectural change, schema change, new feature or new known limitation, update the relevant file in `docs/`, and always update `docs/IMPLEMENTATION_PLAN.md` (completed, remaining, verification results).
