# Implementation plan and status

Last updated: 2026-10-14 (second iteration: general workout tracking and the USDA meal assistant).

## Phases

| Phase | Status |
|---|---|
| 0. Inspection, research, documentation | Done |
| 1. Foundation: shell, routing, tokens, Supabase client, auth, migrations, RLS, onboarding, settings | Done |
| 2. Nutrition: catalog, search, custom foods, diary, calculations, totals, targets, recipes | Done |
| 3. Training: exercise library, templates, workouts, set logging, previous performance, history | Done |
| 4. Progress: weight, e1RM, records, volume, frequency, nutrition consistency, dashboard | Done |
| 5. Integration and polish: responsive review, a11y, design review, lint and type clean | Done (see limitations) |
| 6. Deployment readiness: docs, build, tests | Done. Migrations and the Edge Function are deployed to the live project; app flows not yet run there |

## Starting state

The working directory (`~/Documents`) had no LiftFuel code. An unrelated project (`millennium-gym`) was left untouched. LiftFuel was created from scratch in `~/Documents/liftfuel` with `git init`. Nothing has been committed.

## Completed work

- **Database:** 4 migrations covering 15 tables, constraints, indexes, RLS on every table, 19 functions (11 RPCs, the rest trigger and helper functions), 3 security-invoker views, and a reference catalog (77 exercises, 38 foods, 22 serving sizes).
- **Auth:** sign-up (with the email-confirmation screen), sign-in, sign-out, password reset, session persistence and refresh, cache clearing on sign-out, protected routes, onboarding guard with no loop.
- **Nutrition:** diary by date (URL `?date=`), four meals, a log panel with favourites, recent foods (last-used amount remembered), search, create-food-inline, grams, ml or servings, live preview, Log versus Log and close, edit (from the snapshot), copy to any date or meal, delete with confirmation, a foods library (mine, favourites, catalog), recipes with yield and serving calculations, and targets versioned by effective date with history.
- **Training:** exercise selector with search, body-area filter and custom exercise creation (duplicate-name protection). Templates with sets, rep range, RPE and rest, plus up and down reordering. One active workout enforced in the database. Inline set table with type, load, reps, RPE and Done, saved on blur. Previous column with tap-to-copy. Rest timer. Add or remove exercises and sets. Notes. Date edit. Finish (discarding incomplete sets) or discard. History with volume and duration.
- **Progress:** weigh-in log, edit and delete, a 7-day trailing average with no interpolation, Hevy-style exercise graphs (estimated 1RM, heaviest weight, session volume, total reps), period comparison, all-time records (heaviest, best e1RM, best set volume, most reps), weekly workouts and volume, sets per body area, and nutrition consistency (days logged, averages, days near target, calories against a step target line).
- **Dashboard:** today's calories and macros against targets, Log food, workout status (resume, today's completed sessions, quick start from templates), 30-day weight trend, this week's workouts, sets and volume, and recent personal records.
- **Meal assistant (iteration 2):** "Describe a meal" in the log-food panel. The `meal-estimate` Edge Function runs Mistral tool calling against the USDA FoodData Central search. Macros are computed from USDA per-100 g data (with Foundation-food energy handling). The review list has editable grams, portion source labels and unmatched items. `log_usda_foods` logs atomically. Rate limit is 30 per hour per user.
- **Workout tracker refactor (iteration 2):** powerlifting total and competition-lift flags removed. Exercise graphs, records and sets per body area added.
- **Supabase MCP:** `.mcp.json` registers `pakpvanempwexhmjrobx`. Authentication by the user is pending.
- **Settings:** profile (name, goal, unit, time zone), targets with effective date and history, password change, sign out.
- **Installable app (iteration 4):** manifest, icons, hand-written service worker (offline app shell, never caches Supabase data), and a phone install gate with Android install button, Android menu steps, iOS Add to Home Screen steps and an in-app-browser notice. See ARCHITECTURE > Installable app.
- **Target calculator (iteration 3):** onboarding and Settings estimate BMR and TDEE (Mifflin-St Jeor × activity factor), apply the goal and fill calories and macros that add up. Inputs are stored on `profiles` (migration `20261016000100_energy_profile.sql`). Formula code in `src/lib/energy.ts`, no AI.

## Verification results (2026-10-14, after iteration 2)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | Pass, 0 errors |
| ESLint | `npm run lint` | Pass, 0 errors, 0 warnings |
| Unit, component and DB tests | `npm test` | **134 passed** across 14 files (iteration 3 re-run) |
| PWA | `tests/unit/pwa.test.tsx` plus a Chromium check of the production build | 8 unit tests passed (platform detection, gate rules, install screens, install prompt). Chromium: no installability or manifest errors, service worker active and controlling, offline reload shows the app shell, gate shown on Pixel 7 and iPhone 15 emulation, `/reset-password` not gated, iOS standalone flag passes through |
| Target calculator | `tests/unit/energy.test.ts`, `tests/unit/target-calculator.test.tsx`, `tests/db/profile.test.ts` | 14 passed: published equation values, goal adjustments, BMR floor, protein cap, macros agree with calories across 360 input combinations, form validation, profile column constraints and RLS |
| of which DB (PGlite) | `npm run test:db` | 59 passed: nutrition 22, RLS 18, training 12, USDA and rate limit 7 |
| Meal-agent logic | `tests/unit/meal-agent.test.ts` | 13 passed: USDA parsing (real response shapes), tool loop with a scripted fake model, rejection of invented FDC IDs |
| Production build | `npm run build` | Pass. Initial JS about 137 KB gzip. Charts chunk 111 KB gzip, lazy |
| Playwright smoke | `npm run e2e` | 10 passed (5 tests × desktop and mobile) |
| Playwright full flows | `npm run e2e` with test account | **Skipped (not run):** no Supabase project available |
| Visual review | Screenshots at 1440, 900 and 390 px against **mocked** API responses | Done. Issues found and fixed (see DESIGN_SYSTEM §13) |

USDA live check: one run of `searchUsda` against the live FDC API with `DEMO_KEY` completed without errors, but its output was not captured. A second run hit the demo key's hourly limit (HTTP 429). The response shapes used in the tests were captured from live calls earlier the same day.

What the DB tests cover: snapshot stability, reference-amount scaling, servings, client-forgery resistance, copying, totals view, search, effective-date goals, recipe yield and propagation, `save_food` atomic rollback, exercise naming, template reorder, one in-progress session, set completion rules, finish rules, previous performance, the records view, and cross-user RLS on every table, view and RPC.

### Live project checks (`pakpvanempwexhmjrobx`, 2026-10-14)
- `supabase db push` applied all 6 migrations. `migration list` shows local and remote in sync. `db lint --linked` reports no schema errors.
- `meal-estimate` deployed (version 1, ACTIVE, `verify_jwt` on). Secrets `MISTRAL_API_KEY`, `USDA_FDC_API_KEY` and `MISTRAL_AGENT_ID` are set.
- Function without a JWT: 401 at the gateway. With the publishable key but no user: the handler boots under Deno and returns 401 `unauthorized` from `auth.getUser`, so imports and startup work.
- `anon` reading `exercises` and calling `log_usda_foods`: `permission denied` (42501), as intended.
- Auth: email sign-up enabled, email confirmation on.

### Not verified
- **PWA on real phones.** Install on a real Android phone and iPhone has not been tried (it needs an HTTPS deployment). Chromium cannot emulate `display-mode: standalone`, so the Android installed-app pass-through is covered only by unit tests.
- **The meal assistant end to end.** No signed-in request has reached Mistral or USDA yet, so the real tool-call format, JSON mode together with tools, and the agent endpoint are untested. These were built from Mistral's docs as of 2026-10-14.
- **App flows against the live project.** PostgREST embedding and filter syntax and GoTrue flows (email confirmation, PKCE password recovery) have not run yet. Run `npm run dev` and sign up, or run the Playwright flows with a test account.
- Supabase's `supabase_auth_admin` path for the sign-up trigger. PGlite inserts into `auth.users` as superuser.
- Screen-reader testing with real assistive technology. Only semantics were reviewed.
- Real-device mobile testing (only Chromium mobile emulation).

## Known limitations

- iOS home-screen apps and Safari keep separate sign-ins (WebKit design). Password reset requested from the installed iOS app must be redone from Safari (the install screen links to it).

- Food search uses term matching with `position()` and a `lower(name)` index. There is no trigram or fuzzy search yet (PGlite lacks `pg_trgm`, which kept tests portable).
- Catalog foods are approximate generic values marked as estimates, not imported from FoodData Central.
- One weigh-in per day (a later log replaces the earlier one).
- Timed and distance exercises (planks, carries, cardio) are not supported.
- Set rows edited in another tab are not reflected until reload (local inputs are initialised once).
- Nested recipes (recipes as ingredients) are not allowed.
- The meal default for "Log food" uses the browser's local hour, not the profile time zone.
- No offline mode. Set edits need connectivity (failed saves show an error and roll back).
- `src/types/database.ts` is hand-written. Regenerate it once a project is linked.

## Next recommended task

**Connect a Supabase project and run the full verification:**
1. Create a non-production project, `supabase db push` the migrations, and configure Auth URLs.
2. Fill `.env.local`, create a test user, and run `E2E_EMAIL=... E2E_PASSWORD=... npm run e2e`.
3. Regenerate `src/types/database.ts` with `supabase gen types` and fix any drift.
4. Run Supabase's Security Advisor and Performance Advisor and address findings.

After that, the most valuable product feature is a **FoodData Central import** (verified provenance for common foods) with trigram search.
