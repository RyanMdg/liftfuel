# LiftFuel UI/UX Research

Research conducted on 2026-10-14 using web search and direct page fetches from the development environment. Every source below was actually retrieved, or appeared as a search result, on that date. Where a page could not be fetched (HTTP 403 or a redirect), this is stated, and only the search-result summary was used.

## 1. Research objectives

1. Find out what makes food logging fast enough to sustain daily (it's the most frequent action in the product).
2. Find the established interaction model for logging sets between lifts, including how "previous performance" is shown.
3. Decide how to structure a dashboard so the most important numbers can be read at a glance.
4. Establish accessibility requirements: WCAG 2.2 AA, form labelling, contrast, motion.
5. Decide how to present tables and charts responsively.
6. Confirm current conventions for Tailwind CSS v4, Supabase (keys, RLS) and TanStack Query before choosing implementation patterns.
7. Choose a documented, defensible approach to estimated 1RM and body-weight trends.

## 2. Sources consulted

| # | Title | URL | Accessed | Type | How it was read |
|---|---|---|---|---|---|
| S1 | What is the Fastest Food Logger? We Designed a System to Find Out (MacroFactor) | https://macrofactor.com/fastest-food-logger/ | 2026-10-14 | Vendor research (self-published) | Fetched |
| S2 | Is MacroFactor Still the Fastest Food Logger? (2025 FLSI Update) | https://macrofactor.com/fastest-food-logger-2025/ | 2026-10-14 | Vendor research | Search result summary |
| S3 | Hevy: Track Exercises feature page | https://www.hevyapp.com/features/track-exercises/ | 2026-10-14 | Product documentation | Fetched |
| S4 | Hevy Help: How to Use Previous Workout Values to Improve Performance | https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy | 2026-10-14 | Product help | Fetch returned HTTP 403; search result summary only |
| S5 | StrengthLog: How Our Workout Log App Helps You Lift Heavier | https://www.strengthlog.com/four-ways-to-lift-heavier-using-the-strengthlog-workout-app/ | 2026-10-14 | Product blog | Search result summary |
| S6 | Stronglifts Support: How to Log Sets and Reps | https://support.stronglifts.com/article/23-sets-reps | 2026-10-14 | Product help | Search result summary |
| S7 | Cronometer Help Center (diary and nutrient targets articles) | https://support.cronometer.com/hc/en-us/articles/360018171731 | 2026-10-14 | Product help | Search result summary |
| S8 | What's New in WCAG 2.2 (W3C WAI) | https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ | 2026-10-14 | Official standard | Fetched |
| S9 | Understanding SC 1.4.3 Contrast (Minimum) (W3C) | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | 2026-10-14 | Official standard | Fetched |
| S10 | Understanding SC 2.3.3 Animation from Interactions (W3C) | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | 2026-10-14 | Official standard | Fetched |
| S11 | Labeling Controls, Forms Tutorial (W3C WAI) | https://www.w3.org/WAI/tutorials/forms/labels/ | 2026-10-14 | Official guidance | Fetched |
| S12 | Placeholders in Form Fields Are Harmful, Katie Sherwin (NN/g) | https://www.nngroup.com/articles/form-design-placeholders/ | 2026-10-14 | UX research | Fetched |
| S13 | Mobile Tables: Comparisons and Other Data Tables, Amy Schade (NN/g, 2017) | https://www.nngroup.com/articles/mobile-tables/ | 2026-10-14 | UX research | Fetched |
| S14 | Choosing Chart Types: Consider Context, Kate Moran (NN/g, 2022) | https://www.nngroup.com/articles/choosing-chart-types/ | 2026-10-14 | UX research | Fetched |
| S15 | Data Visualizations for Dashboards (NN/g video) | https://www.nngroup.com/videos/data-visualizations-dashboards/ | 2026-10-14 | UX research | Search result summary |
| S16 | Theme variables (Tailwind CSS docs) | https://tailwindcss.com/docs/theme | 2026-10-14 | Official docs | Fetched |
| S17 | Installing Tailwind CSS with Vite | https://tailwindcss.com/docs/installation/using-vite | 2026-10-14 | Official docs | Fetched |
| S18 | Row Level Security (Supabase docs) | https://supabase.com/docs/guides/database/postgres/row-level-security | 2026-10-14 | Official docs | Fetched |
| S19 | Understanding API keys (Supabase docs) | https://supabase.com/docs/guides/api/api-keys | 2026-10-14 | Official docs | Fetched |
| S20 | Use Supabase Auth with React (Supabase quickstart) | https://supabase.com/docs/guides/auth/quickstarts/react | 2026-10-14 | Official docs | Fetched (page gave little code detail) |
| S21 | Optimistic Updates (TanStack Query docs) | https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates | 2026-10-14 | Official docs | Fetched |
| S22 | font-variant-numeric (MDN) | https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric | 2026-10-14 | Reference | Fetched |
| S23 | MacroFactor Help: Weight Trend | https://help.macrofactorapp.com/en/articles/278-weight-trend | 2026-10-14 | Product help | Fetch returned navigation only; search result summary used |
| S24 | LeSuer et al. (1997), "The accuracy of prediction equations for estimating 1-RM performance in the bench press, squat, and deadlift" | Citation found in reference lists; primary paper not retrieved | 2026-10-14 | Peer-reviewed study (secondary report only) | Not read directly |
| S25 | Fitness Volt: e1RM formula comparison | https://fitnessvolt.com/rpe-training/compare/e1rm-formulas/ | 2026-10-14 | Secondary source | Search result summary |

S4, S5, S6, S7, S15, S23 and S25 were only seen as search summaries. Their findings are treated as indicative, not authoritative. S24 is cited for context only, because the primary paper was not read.

## 3. Key findings

### 3.1 Food logging (S1, S2, S7)

- **Fewer discrete actions mean faster logging (documented, vendor-defined).** MacroFactor's index counts taps/clicks for four workflows: search, multi-add of repeat foods, barcode, and quick-add. Search is the most common path (S1).
- **Logging is frequent, so small inefficiencies add up.** S1 notes diligent trackers run these workflows "15+ times per day".
- **Recent and historical foods matter more over time.** S1: "The opportunity to use multi-add occurs more and more over time." Remembering the last-used quantity for a food reduces input.
- **Weight-based logging means three- and four-digit entries** (S1). The quantity input must be quick to type, numeric-keyboard friendly, and pre-filled sensibly.
- **Users stay in the logging flow.** MacroFactor's "speed mode" returns the user to the logger after each add (S2 summary).
- **Diary structure (Cronometer, S7):** a time-ordered diary with description, amount, unit and energy per entry, plus a separate macro/target summary. Targets can be edited from the diary context.
- Caveat: MacroFactor designed and scored its own index (S1 acknowledges the bias). The principle (count and minimise actions) is sound; the rankings are not used.

### 3.2 Workout logging (S3, S4, S5, S6)

- **A "Previous" column in the set table** shows what was done last time for the same set, so the lifter can aim to match or beat it (S3, S4).
- **Tapping a previous value copies it into the current set** (S3), which avoids retyping load and reps.
- **Completion is a single action per set.** Stronglifts logs a set with one tap (S6). Hevy marks sets complete inline, and completion starts a rest timer (S3, third-party summary).
- **Pre-filling from the last session** reduces typing (S5, StrengthLog's "copy sets from last workout").
- No source recommended modal dialogs per set. All the products reviewed log inline in a table-like list.

### 3.3 Dashboards and charts (S14, S15)

- Dashboards should use visual encodings that are processed preattentively, mainly **length and 2D position**, for fast reading (S15).
- **"Numbers are meaningless without context"** (S14): a figure should come with a comparison, such as a target or a previous period.
- **Line charts for trends over time, with data-point markers** so viewers can see when each measurement was taken (S14).
- **Bar charts by default for comparisons.** Avoid pie, stacked area and stacked bar charts, which need angle or area judgements (S14).

### 3.4 Forms and accessibility (S8–S12)

- **Placeholders must not replace labels.** "Disappearing placeholder text strains users' short-term memory" (S12). Placeholders also have weak contrast and are inconsistently announced.
- **Explicit `<label for>` is better supported** than implicit labels. `title` is "generally less reliable and not recommended" (S11).
- **WCAG 2.2 AA additions that apply here** (S8):
  - 2.4.11 Focus Not Obscured (Minimum): sticky headers and footers must not hide the focused element.
  - 2.5.7 Dragging Movements: any reorder must have a non-drag alternative.
  - 2.5.8 Target Size (Minimum): targets of at least 24×24 CSS px.
  - 3.3.7 Redundant Entry (A): don't ask again for information already entered.
  - 3.3.8 Accessible Authentication (Minimum): no cognitive tests at login; password managers and paste must work.
- **Contrast** (S9): 4.5:1 for normal text and 3:1 for large text (18pt, or 14pt bold). 1.4.11 needs 3:1 for UI component boundaries and states.
- **Motion** (S10): respect `prefers-reduced-motion`, and "eliminate unnecessary motion effects."

### 3.5 Tables (S13, S22)

- Design the table for a large screen first, then adapt it. Keep text legible without zooming. Keep headers visible on long tables. Lock the identifying column when scrolling horizontally. Show clearly when a table scrolls sideways (S13).
- **Tabular numerals** make digits equal width so numbers align in columns (S22).

### 3.6 Implementation conventions (S16–S21)

- **Tailwind v4** sets tokens in CSS with `@theme`. `--color-*: initial` removes the default palette, so only brand tokens generate utilities. Vite uses the `@tailwindcss/vite` plugin, and no `tailwind.config.js` is needed (S16, S17).
- **Supabase keys:** publishable keys (`sb_publishable_...`) are browser-safe. Legacy `anon` keys are being deprecated by the end of 2026. Secret and `service_role` keys bypass RLS and must never reach the browser (S19).
- **Supabase RLS:** write one policy per operation, `to authenticated`, and wrap `auth.uid()` as `(select auth.uid())` so it is evaluated once per statement. Index the columns that policies filter on. Views need `security_invoker = true`. Security-definer functions must set `search_path = ''` (S18).
- **TanStack Query:** invalidate in `onSettled` so the cache reflects true server state. Use UI-level optimistic display when only one component shows the pending value (S21).

### 3.7 Calculations (S23, S24, S25)

- **Weight trend:** MacroFactor's trend smooths out water and gut-content fluctuations by weighting recent values. It fills skipped days by linear interpolation (S23, search summary). LiftFuel does **not** interpolate (see §6).
- **e1RM:** secondary sources agree that common formulas (Epley, Brzycki) are most reliable in roughly the 1–10 rep range and diverge above it (S25). LeSuer et al. (1997) is widely cited as finding high correlations but exercise-dependent error, with deadlift under-predicted (S24, secondary reports only).

## 4. Relevant design patterns adopted

| Pattern | Source(s) | LiftFuel application |
|---|---|---|
| Search-first logging with recent and favourite foods listed above results | S1, S7 | Log-food panel opens with Favourites and Recent, and the search field is focused |
| Remember last quantity per food | S1 | Selecting a recent food pre-fills its last logged quantity and serving |
| Stay in the logging flow | S1, S2 | "Add" keeps the panel open with a confirmation line. "Add and close" is a secondary action |
| Inline set table with a Previous column | S3, S4 | `WorkoutSetTable` columns: Set, Type, Previous, Load, Reps, RPE, Done |
| Tap previous to copy | S3 | The Previous cell is a button that copies load and reps into the row |
| One-action set completion | S3, S6 | A single check button marks a set done and saves the row's values at the same moment |
| Target-relative numbers | S14 | Every consumed value is shown against its target, with the remainder stated in words |
| Line charts with point markers for time series | S14 | Weight and e1RM charts show points. Weekly volume and frequency use bars |
| Visible labels, numeric input modes, units adjacent | S11, S12 | Shared `Field` component with label above, unit suffix, and `inputMode="decimal"` |
| Button alternative to drag reordering | S8 (2.5.7) | Template exercises reorder with Move up / Move down buttons |

## 5. Patterns intentionally rejected

- **Rings and donut gauges for calories and macros.** Angle and arc length are read less accurately than straight length (S14, S15). LiftFuel uses horizontal bars and exact numbers.
- **Per-set modal dialogs.** Too many actions between sets. No reviewed product uses them.
- **Drag-only reordering.** Fails WCAG 2.5.7.
- **Placeholder-as-label inputs.** Rejected per S12.
- **Interpolating missing weigh-ins** (as MacroFactor does, S23). LiftFuel shows only real weigh-ins and a trailing average over real data, so gaps stay visible.
- **Gamified streaks, badges and confetti.** These add motion and noise, and they conflict with S10 and the calm editorial direction.
- **Card-per-metric dashboards, gradients, glow effects.** These are prohibited by the LiftFuel brief. The research above (length and position over decoration) supports leaving them out.

## 6. Decisions made for LiftFuel

1. **Diary layout:** four meal sections (Breakfast, Lunch, Dinner, Snacks). Each is a flat table under a section heading with a thin divider. The meal total sits in the heading row.
2. **Daily summary:** one row of calories, protein, carbs and fat, each with a large tabular number, its target, a 4px length bar, and "remaining" or "over" stated in words.
3. **Log-food panel:** a right-side sheet on desktop, full-screen on mobile. It shows search, Favourites and Recent, then a quantity step with a serving selector and a live nutrient preview.
4. **Workout logger:** one inline table per exercise. Each row saves on blur. The Done button saves and completes in one request. Refreshing the page loses nothing.
5. **e1RM:** Epley `w × (1 + reps/30)`, only for completed working sets of 1–10 reps. A single (1 rep) uses the actual load. Always labelled "Estimated".
6. **Weight trend:** a trailing 7-day mean of actual weigh-ins, shown only when the window contains at least 3 weigh-ins. No interpolation. The chart caption says that daily changes mostly reflect water and food volume.
7. **Charts:** teal series on white, navy axes text, hairline gridlines, point markers, units in the axis label.

## 7. Accessibility implications

- Every input has a visible `<label>`. Units appear as visible suffixes and are also part of the accessible name.
- Focus ring: 2px Deep Teal outline with 2px offset (8.3:1 against white). On navy surfaces it is a white outline.
- Minimum target 24×24 px everywhere, and 40px for primary touch targets on mobile.
- The sticky mobile header is short, and `scroll-padding-top` is set so focused fields are not hidden (2.4.11).
- Login works with password managers. No CAPTCHA or cognitive tests (3.3.8).
- Motion is limited to short opacity and colour transitions, and all of it is disabled under `prefers-reduced-motion`.
- Status changes such as "Logged 150 g Chicken breast" are announced through an `aria-live="polite"` region.

## 8. How research shaped specific screens

| Screen or component | Research influence |
|---|---|
| Dashboard | Length bars and target context (S14, S15). The most important numbers sit top-left (S15) |
| Nutrition diary | Cronometer-style entry rows (S7). Speed-mode logging (S1, S2) |
| Food search | Recent and Favourites first, remembered quantity (S1) |
| Active workout | Previous column with tap-to-copy (S3, S4). Single-action completion (S3, S6) |
| Templates | Button reordering (WCAG 2.5.7, S8) |
| Progress charts | Line plus markers for trends, bars for weekly comparisons (S14). No interpolation (decision against S23's approach) |
| Tables on mobile | Identifying column first, sideways scroll signalled, legible type (S13) |
| Forms | Visible labels (S11, S12) |
| Tokens and fonts | Tailwind v4 `@theme` with a reset palette (S16). Tabular numerals (S22) |

## 9. Iteration 2 research (2026-10-14): meal assistant and general workout tracking

| # | Title | URL | How read |
|---|---|---|---|
| S26 | FoodData Central API Guide (USDA) | https://fdc.nal.usda.gov/api-guide/ | Fetched |
| S27 | FoodData Central API, live responses | https://api.nal.usda.gov/fdc/v1/foods/search | Live calls with DEMO_KEY |
| S28 | Mistral API: Agents completions (listed under "Deprecated") | https://docs.mistral.ai/api/endpoint/deprecated/agents | Fetched |
| S29 | Mistral docs: Function calling | https://docs.mistral.ai/capabilities/function_calling/ | Fetched |
| S30 | Hevy: Exercise performance feature | https://www.hevyapp.com/features/exercise-performance/ | Search result only |

Findings and decisions:
- **USDA data** is public domain (CC0), with credit to FoodData Central requested (S26). The demo key allows only 30 requests per hour, so a personal key is required. Foundation Foods report energy as nutrient 2047/2048 rather than 1008 (S27, verified live), so the parser falls back in that order. Survey (FNDDS) results include portion weights such as "1 cup, cooked" = 174 g (S27). The assistant prefers these over model guesses.
- **Mistral**: tool calls arrive as `tool_calls[].function.arguments` (a JSON string), and results go back as `role: "tool"` messages with `tool_call_id` (S29). The agents completions endpoint accepts `agent_id`, `messages`, `tools` and `response_format`, but is listed as deprecated (S28). Chat completions is therefore the default, and a Studio agent is optional.
- **Review before logging** follows the same principle as earlier: nothing changes the diary without an explicit user action, and estimated portions are visually emphasised.
- **Hevy-style exercise pages** (S30, summary only): per-exercise graphs and records replace the powerlifting total. Graph options are estimated 1RM, heaviest weight, session volume and total reps, and the records are heaviest, best 1RM, best set volume and most reps.

## 10. Iteration 3 research (2026-10-14): target calculator (TDEE)

| # | Title | URL | How read |
|---|---|---|---|
| S31 | Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 1990;51(2):241–7 | https://doi.org/10.1093/ajcn/51.2.241 | Search result summary of the abstract (PubMed blocked automated fetch) |
| S32 | Frankenfield D, Roth-Yousey L, Compher C. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. J Am Diet Assoc 2005;105(5):775–89 | https://doi.org/10.1016/j.jada.2005.02.005 | Search result summary of the abstract |
| S33 | Jäger R, et al. ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20 | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/ | Search result summary of the position statements |
| S34 | MacroFactor help: why expenditure differs from a TDEE calculator | https://help.macrofactorapp.com/en/articles/126-why-is-my-expenditure-in-macrofactor-different-from-the-output-of-a-tdee-calculator | Search result only |

Findings and decisions:
- **Equation**: Mifflin-St Jeor (S31) predicted resting energy within 10% of measured for more people than other equations, with the narrowest error range (S32). S32 also warns about individual error and under-represented age and ethnic groups. So the UI calls the result an estimate and tells users to adjust after 2 to 3 weeks of weight trend.
- **Activity factors** 1.2 to 1.9 are a widely used convention (often attributed to McArdle et al.'s exercise physiology textbook), not a verified primary study. Bucketing adds error, and people tend to overestimate activity (S34). So the hint says "If unsure, pick the lower level".
- **Protein**: 1.4 to 2.0 g/kg/day suffices for most exercising people, with more during a deficit (S33). We use 2.0 (lose), 1.6 (maintain) and 1.8 (gain) g/kg, capped at 35% of calories because total body weight overstates needs at high body fat.
- **Not AI**: the user asked whether AI could do this. The calculation is a fixed formula, so code gives exact, testable, free results. A model would add cost and arithmetic risk, and AGENTS.md excludes generated plans.
- **Sex input** is labelled for what it does ("The formula has separate equations for male and female bodies"). Birth year is stored instead of a birth date to keep personal data to what the formula needs.

## 11. Iteration 4 research (2026-10-14): installable app on phones

| # | Title | URL | How read |
|---|---|---|---|
| S35 | web.dev: What does it take to be installable? | https://web.dev/articles/install-criteria | Search result summary |
| S36 | WebKit Bugzilla 181849: "Add to homescreen" apps don't share storage with Safari | https://bugs.webkit.org/show_bug.cgi?id=181849 | Search result summary |
| S37 | firt.dev: iOS PWA Compatibility | https://firt.dev/notes/pwa-ios/ | Search result summary |

Findings and decisions:
- **Chrome's install prompt** needs HTTPS, a manifest with a name, `start_url`, `display` and 192 and 512 px icons, and some user engagement (a tap and about 30 seconds on the site) before `beforeinstallprompt` fires (S35). So the install screen shows the browser-menu steps until the event arrives, then switches to an **Install** button. Verified in Chromium: `Page.getInstallabilityErrors` returns none for the production build.
- **iOS has no install API.** The only path is Share > Add to Home Screen, so the screen gives numbered steps with the matching Lucide icons.
- **iOS home-screen apps do not share storage with Safari, by design** (S36, S37). Users sign in again inside the app, and the screen says so. Password recovery is completed in Safari, which is why `/reset-password` is exempt from the gate and linked from it.
- The product owner asked for installation to be **required** on phones. Tablets and desktops are not gated, and a narrow desktop window is not a phone (coarse pointer required).

