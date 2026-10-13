# LiftFuel

Nutrition tracking and strength training in one web app: a food diary with macros and recipes, Hevy-style workout logging with per-exercise graphs and records, body-weight trends, and a USDA-backed meal assistant (Mistral).

Built with React, Vite, TypeScript, Tailwind CSS v4 and Supabase (Postgres, Auth, Row Level Security).

> Working on this codebase with an AI assistant? Read [AGENTS.md](AGENTS.md) first.

## Requirements

- Node.js 20.19 or newer (developed on Node 24)
- A Supabase project (free tier is fine)

## 1. Install

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` from **Supabase Dashboard > Project Settings > API**:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_...`). A legacy `anon` key also works via `VITE_SUPABASE_ANON_KEY`. |
| `VITE_APP_NAME` | Optional product name (default `LiftFuel`) |

Never put a secret or `service_role` key in any `VITE_` variable: those are bundled into browser JavaScript.

Without these variables the app shows a setup screen instead of failing.

## 2. Apply the database migrations

The schema, RLS policies, database functions and the shared exercise/food catalog are in `supabase/migrations/` and must be applied in filename order.

**Option A: Supabase CLI (recommended)**

```bash
npx supabase login
npx supabase init            # creates supabase/config.toml; keeps the existing migrations
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B: SQL editor.** Open each file in `supabase/migrations/` in order and run it in the Supabase SQL editor.

After applying, regenerate types if you change the schema later:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

`src/types/database.ts` is hand-maintained to match the current migrations. If you regenerate it, keep the convenience aliases at the bottom of the file.

### Supabase MCP (for Claude Code)

`.mcp.json` registers the Supabase MCP server for project `pakpvanempwexhmjrobx`. Authenticate once in a regular terminal: run `claude`, then `/mcp`, choose **supabase**, then **Authenticate**. After that, an AI session can inspect the database, apply migrations and deploy functions. The server is configured with write-capable features (database, functions, branching), so review what it does.

## 3. Configure Auth

In **Authentication > URL Configuration**:

- **Site URL**: your app URL (for example `http://localhost:5173` in development).
- **Redirect URLs**: add `http://localhost:5173/**` and your production URL with `/**`. The app uses `/onboarding` (email confirmation) and `/reset-password` (password recovery) as redirect targets.

Email confirmation can stay on (the default). After sign-up the app asks the user to confirm their email.

## 3b. Meal assistant (optional): USDA data with a Mistral agent

"Describe a meal" in the log-food panel sends text to the `meal-estimate` Edge Function. A Mistral model picks USDA FoodData Central foods and gram amounts. Calories and macros are calculated from USDA data, and the user reviews everything before it is logged. Without this setup the rest of the app works and the panel shows a "not set up" message.

1. Get a free USDA FoodData Central key at https://fdc.nal.usda.gov/api-key-signup (data.gov). The shared `DEMO_KEY` allows only 30 requests per hour and is not used.
2. Get a Mistral API key from Mistral AI Studio > API Keys.
3. Optional: create a Studio agent (see `supabase/functions/meal-estimate/AGENT_SETUP.md`) and note its ID.
4. Set the secrets and deploy:

```bash
npx supabase secrets set MISTRAL_API_KEY=... USDA_FDC_API_KEY=...
npx supabase secrets set MISTRAL_AGENT_ID=ag_...      # optional; otherwise MISTRAL_MODEL (default mistral-medium-latest)
npx supabase functions deploy meal-estimate
```

Each user gets 30 estimates per hour (`consume_ai_request`). USDA data is public domain (CC0). Credit "USDA FoodData Central", which the UI does.

## 4. Run

```bash
npm run dev          # http://localhost:5173
```

## Quality checks

```bash
npm run typecheck    # TypeScript (tsc -b)
npm run lint         # ESLint
npm test             # Vitest: unit, component and database tests
npm run build        # production build to dist/
npm run e2e          # Playwright (see below)
```

**Database tests** (`tests/db/`) run the real migrations inside PGlite, which is Postgres 18 compiled to WebAssembly, against a minimal stub of Supabase's `auth` schema and roles. They verify constraints, triggers, RPCs and RLS isolation between users. They are not a substitute for a real Supabase project (no PostgREST or GoTrue, and a different Postgres major version).

**End-to-end tests**: `tests/e2e/smoke.spec.ts` needs no backend. `tests/e2e/flows.spec.ts` covers sign-in and onboarding, logging a meal, recording and finishing a workout, and logging body weight. It runs only against a **non-production** project with a dedicated test account:

```bash
npx playwright install chromium
set -a; source .env.local; set +a
E2E_EMAIL=test@example.com E2E_PASSWORD='...' npm run e2e
```

The flow tests write data to that account.

## Deploy

The app is a static single-page application. Any static host works (Vercel, Netlify, Cloudflare Pages, or Supabase-adjacent hosting):

1. Build command `npm run build`, output directory `dist`.
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (and optionally `VITE_APP_NAME`) in the host's environment.
3. Configure a SPA fallback so every path serves `index.html`. Vercel: the committed `vercel.json` does this (and sets cache headers for `sw.js` and hashed assets). On Netlify, add `/* /index.html 200` to `public/_redirects`.
   `VITE_` variables are read **at build time**, so after adding or changing them in the host's settings, redeploy.
4. Add the production URL to Supabase Auth's Site URL and Redirect URLs.
5. Installable app: serve over **HTTPS** (browsers only install from secure origins; `localhost` counts, a LAN IP such as `http://192.168.x.x` does not). Serve `/sw.js` without long-lived caching so updates reach users. On phones, the browser tab shows install steps until the app is opened from the home screen. Set `VITE_INSTALL_GATE=off` to turn that off.

## Documentation

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Rules for anyone (human or AI) changing the code |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Vision, users, scope, acceptance criteria |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, typography, components, anti-patterns |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | App structure, data flow, auth, security |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, constraints, RLS, calculation rules |
| [docs/API_AND_DATA_ACCESS.md](docs/API_AND_DATA_ACCESS.md) | Data-access functions, RPCs and views |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Status, verification results, next steps |
| [docs/research/ui-ux-research.md](docs/research/ui-ux-research.md) | UI/UX research and the decisions it drove |
