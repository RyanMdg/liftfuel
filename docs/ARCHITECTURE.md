# Architecture

## Overview

```
Browser (React SPA, Vite build)
  ├── React Router 7 data router, lazy route modules
  ├── TanStack Query: server-state cache
  ├── supabase-js (publishable key, user JWT)
  │     ├── PostgREST  → tables and views (RLS enforced)
  │     ├── PostgREST  → RPC functions (SECURITY INVOKER, RLS enforced)
  │     └── GoTrue     → sign-up, sign-in, refresh, password reset
  └── Pure calculation modules (src/lib): previews and analytics
  └── functions.invoke('meal-estimate') → Edge Function (Deno)
          ├── Mistral API (agent or chat completions, tool calling)
          └── USDA FoodData Central API (search)
Supabase Postgres
  ├── Tables with RLS on every table
  ├── Triggers: snapshot and nutrient calculation, name normalisation, recipe propagation
  ├── Functions: atomic multi-row operations
  └── Views (security_invoker): completed_sets, exercise_records, daily_nutrition_totals
```

There is no custom backend server. Supabase is the backend, and **RLS is the security boundary**. The browser only ever holds the publishable key and the signed-in user's JWT.

The one server-side component is the **`meal-estimate` Edge Function**, which holds the Mistral and USDA keys as secrets. It never writes diary data. It verifies the user (`auth.getUser` with the caller's JWT), applies the per-user rate limit through RLS-protected `consume_ai_request`, runs the tool-calling loop in `supabase/functions/_shared/meal-agent.ts`, and returns suggestions. The client logs reviewed items with the `log_usda_foods` RPC. The shared module has no runtime-specific code, so Vitest tests it directly.

## Source layout

```
src/
  app/            config.ts (env, APP_NAME), providers.tsx, router.tsx, RouteError, SetupRequired
  components/
    ui/           Button, IconButton, Field, Dialog, ConfirmDialog, States, Headings, Stat,
                  Toast, SegmentedControl, DateNavigator, table classes
    layout/       AppShell (sidebar, rail, drawer)
    charts/       ChartFrame, theme, chart components (Recharts)
  features/
    auth/         AuthProvider, api, hooks (profile), guards, Login, Signup, ResetPassword
    onboarding/   OnboardingPage
    dashboard/    DashboardPage
    nutrition/    api, hooks, schemas, tabs, DiaryPage, FoodsPage, RecipesPage, components/
    training/     api, hooks, labels, tabs, TrainingPage, TemplatesPage, WorkoutPage, components/
    progress/     api, hooks, period, ProgressPage, sections/
    settings/     SettingsPage
  hooks/          useSingleFlight
  lib/            supabase, errors, queryKeys, paginate, dates, units, nutrition, training,
                  weight, format, cn
  types/          database.ts (Supabase Database types plus aliases)
  styles/         index.css (Tailwind v4 tokens)
supabase/migrations/   schema, RLS, functions and views, reference catalog
tests/unit             pure logic plus React Testing Library
tests/db               migrations and RLS in PGlite
tests/e2e              Playwright
```

Domain components live in their feature folder (`features/<domain>/components`) rather than in `components/<domain>`. This keeps each feature's UI, data access and hooks together.

## Data flow

1. Components call hooks from `features/*/hooks.ts`.
2. Hooks wrap `features/*/api.ts` functions in TanStack Query (`useQuery` or `useMutation`) with keys from `lib/queryKeys.ts`.
3. `api.ts` functions are the only place that calls `supabase()`. They unwrap `{ data, error }` and throw on error.
4. Mutations invalidate the narrowest affected keys in `onSettled` or `onSuccess`. For example, a diary change invalidates `diary/<date>`, `nutrition-totals` and `foods/recent`.
5. Set edits during a workout use an **optimistic cache update** (`useUpdateSet`) with rollback on error and re-sync afterwards. Logging between sets feels instant, and the server stays the source of truth.

Authoritative numbers come from the database: entry nutrients come from a trigger, recipe nutrition from a function, and all-time records from a view. `src/lib` mirrors the same formulas for previews (the quantity preview, recipe preview) and for period analytics over fetched rows. Unit tests and DB tests assert both sides give the same results.

## State management conventions

- Server state lives in TanStack Query. There is no global client store.
- Auth state comes from `AuthProvider` (session, user, recovery flag).
- Form state uses React Hook Form with Zod. Small inline editors (set rows, plan fields) use local `useState` and save on blur.
- URL state is used where shareable or refresh-safe: diary `?date=`, progress `?period=`, `?log=1` to open the log panel, `/settings#targets`.
- Duplicate submission guard: `useSingleFlight` returns a callback that shares one in-flight promise between repeated calls. It backs logging, copying, starting workouts, finishing and saving.

## Authentication flow

1. `supabase-js` is created with `persistSession`, `autoRefreshToken`, `detectSessionInUrl` and `flowType: 'pkce'`, using its default browser storage. No custom token storage.
2. `AuthProvider` reads `getSession()` once, then follows `onAuthStateChange`. On `SIGNED_OUT` (explicit or failed refresh) it clears the whole query cache so no private data lingers. On `PASSWORD_RECOVERY` it sets a flag that shows the new-password form.
3. Guards (`features/auth/guards.tsx`):
   - `RedirectIfSignedIn` wraps `/login` and `/signup`.
   - `RequireAuth` wraps everything else and redirects to `/login`, remembering the target.
   - `RequireOnboarded` wraps the app shell and redirects to `/onboarding` when `onboarding_completed_at` is null. `/onboarding` sits outside this guard and redirects completed users to `/dashboard`, so there is no loop.
4. Sign-up: if email confirmation is on, the user sees a "confirm your email" screen, and the link returns to `/onboarding`.
5. A `profiles` row is created by the `on_auth_user_created` trigger, never by the client.

## Error handling

- `lib/errors.ts#toUserMessage` maps Postgres and PostgREST codes and constraint names to plain-language messages. It passes through the readable messages raised by our own functions (SQLSTATE `22023`, `P0002`) and never shows internals.
- Queries render `ErrorState` with **Try again**. Mutations show error toasts (an `role="alert"` live region).
- Query retries skip permission, validation and not-found errors, and retry transient failures once.
- Route errors render `RouteError`. Failed lazy chunk imports after a deployment prompt a reload.
- Missing environment variables render `SetupRequired` instead of crashing.

## Security boundaries

| Concern | Control |
|---|---|
| Data ownership | RLS on every table. Child tables check the parent's owner. Inserts are `with check`ed |
| References to private rows | Policies also require referenced foods and exercises to be visible (FK checks bypass RLS) |
| Calculated values | Trigger overwrites client-sent nutrients and snapshot columns |
| Anonymous access | All table, view and function privileges are revoked from `anon` |
| Privileged code | Only `handle_new_user` is `SECURITY DEFINER`, with `search_path = ''` |
| Keys | Only the publishable key in the browser. Mistral and USDA keys are Edge Function secrets |
| AI output | Model output is untrusted: unknown `fdc_id`s are rejected, numbers are ignored, grams are bounded, and the user reviews before logging |
| AI cost | 30 requests per user per hour (`ai_requests`, no delete grant). Input is capped at 600 characters, and each request is capped at 6 model steps and 10 USDA searches |
| User content | Rendered as React text (escaped). No `dangerouslySetInnerHTML` anywhere |
| Sessions | supabase-js default storage, auto refresh, cache cleared on sign-out |

## Performance

- Each route is a lazy chunk. Recharts is split into its own chunk (`charts`), which loads only with the dashboard or progress pages.
- Initial JS is about 137 KB gzip (app plus Supabase client) before route chunks.
- Indexes cover every RLS filter column and the main access paths (`food_entries(user_id, entry_date)`, `workout_sessions(user_id, session_date)` and others).
- Long-range analytics use `fetchAllPages`, so PostgREST row caps never truncate results. All-time records are aggregated in SQL (`exercise_records`).
- Search is debounced (200ms) and keeps previous results while typing.

## Installable app (PWA)

- `public/manifest.webmanifest` (name, `start_url` `/dashboard`, `display: standalone`, 192 and 512 px icons plus a maskable icon) and Apple meta tags in `index.html`. Icons are in `public/icons/`, rendered from the favicon geometry.
- `public/sw.js` is hand-written (about 60 lines, no dependency). It handles **same-origin GET only**: pages are network-first with the cached shell as the offline fallback, and hashed `/assets/*` files are cache-first (at most 150 kept). Supabase requests are another origin and are never intercepted, so no private data is cached. It is registered only in production builds (`registerServiceWorker` in `src/lib/pwa.ts`). Bump `VERSION` in `sw.js` to drop old caches.
- **Phone install gate** (`src/app/InstallGate.tsx`, the root layout route). On a phone (coarse pointer, short screen side under 600 px) in a browser tab, the app shows install steps instead of the route: a real **Install** button when Chromium fires `beforeinstallprompt` (captured at startup), browser-menu steps otherwise, Share > Add to Home Screen on iOS, and "open in your browser" in social-app browsers. The installed app (`display-mode: standalone` or iOS `navigator.standalone`), tablets and desktops pass through. `/reset-password` is exempt because recovery links open in the browser. `VITE_INSTALL_GATE=off` disables the gate (the Playwright config sets it).
- **iOS storage is separate** between Safari and a home-screen app (WebKit bug 181849, by design). A session started in one is not visible in the other, so users sign in inside the installed app. A password-reset link requested from the installed iOS app opens in Safari, where the PKCE verifier is missing. The install screen therefore links to `/reset-password`, so the whole reset happens in Safari.
- A browser cannot force installation. The gate is a product rule, not a security control.

## Deployment strategy

A static SPA (see README): build with `npm run build`, serve `dist/` with an SPA fallback, set the `VITE_` env vars, and apply migrations with `supabase db push`. Schema changes go out as new migration files, applied before deploying the frontend that depends on them.

## Dependencies and why

| Package | Reason |
|---|---|
| `@supabase/supabase-js` | Backend client (required) |
| `@tanstack/react-query` | Caching, invalidation, optimistic updates |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Forms and validation |
| `recharts` | Charts |
| `lucide-react` | Icons |
| `@fontsource-variable/montserrat` | Self-hosted Montserrat (no third-party font request) |
| `@electric-sql/pglite` (dev) | Runs real migrations and RLS in tests without Docker |
| (none for the PWA) | `vite-plugin-pwa` 2.0 was the only release supporting Vite 8 and was 11 days old. The hand-written manifest and service worker are small and fully under our control |
| TypeScript pinned to `~6.0` | typescript-eslint supports TS below 6.1 |
