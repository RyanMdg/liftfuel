# Design system

Character: minimal, precise, editorial, athletic, calm, data-focused. Hierarchy comes from type, whitespace and hairline dividers, not from boxes and fills.

Tokens are defined once in `src/styles/index.css` (Tailwind v4 `@theme`). Tailwind's default palette is removed (`--color-*: initial`), so only the tokens below generate colour utilities.

## 1. Colour tokens

Ratios are WCAG contrast ratios against white unless noted. They are computed values, not estimates.

| Token | Hex | Ratio | Use |
|---|---|---|---|
| `navy` / `ink` | `#030027` | 20.3:1 | Primary text, navigation surface |
| `white` | `#FFFFFF` | | Page background, text on navy and teal |
| `teal` | `#0A575C` | 8.3:1 | Primary buttons, links, active tab rule, focus ring, chart emphasis, completed state |
| `teal-dark` | `#073F43` | | Primary button hover |
| `teal-soft` | `#EDF4F4` | | Completed set rows, selected option. `ink-muted` on it is 4.7:1 |
| `teal-mid` | `#5D8F92` | 3.6:1 | Secondary chart series (weigh-in dots) |
| `teal-light` | `#B6CECF` | | Reserved for chart reference fills |
| `ink-soft` | `#4F4D68` | 8.1:1 | Secondary text |
| `ink-muted` | `#6B6A80` | 5.25:1 (4.9:1 on `surface`) | Metadata, captions, labels |
| `line` | `#E3E2E9` | | Hairline separators (decorative only) |
| `line-strong` | `#8A899C` | 3.4:1 | Input and control borders (meets 1.4.11) |
| `surface` | `#F6F6F8` | | Row hover, chart cursor |
| `danger` | `#9F1D20` | 7.9:1 | Destructive actions, validation errors, over-target values |
| `danger-dark` | `#7C1619` | | Danger hover |
| `danger-soft` | `#F8E9E9` | | Destructive icon-button hover |
| `on-navy-muted` | `#B3B2BE` | 9.7:1 on navy | Inactive navigation text |

Rules:
- Navy carries navigation, the auth panel and primary text. Content areas stay white.
- Teal marks action and state: primary buttons, links, active tabs, progress fills, completed sets. It is never a background behind paragraphs.
- `danger` is functional only, and it is always paired with words ("214 kcal over target"). Colour is never the only signal.
- No gradients, glows, neon, or extra hues.

## 2. Typography

- **Montserrat Variable**, self-hosted through `@fontsource-variable/montserrat`. `--font-sans` is set to it, so every element inherits it. Nothing overrides the family.
- Body text is 15px/24px. Inputs are 16px, which prevents iOS zoom on focus.

| Role | Classes | Notes |
|---|---|---|
| Page title | `text-3xl sm:text-display font-bold tracking-tight` | 36/40 at sm+ |
| Section heading | `text-lg font-semibold` | with hairline underneath (`SectionHeading`) |
| Sub-section label | `label-caps` | 11px, 600, uppercase, 0.08em tracking, muted |
| Body | default | 15/24 |
| Metadata | `text-sm text-ink-soft` or `text-xs text-ink-muted` | |
| Hero figure | `Stat size="lg"` | 36–48px semibold, **proportional** digits |
| Stat value | `Stat` | 24–30px semibold, tabular digits |
| Table numbers | `num` utility | `tabular-nums` so columns align |

Do not make everything bold. Weights in use: 400 (body), 500 (units), 600 (labels, headings, emphasis), 700 (page titles and wordmark only).

## 3. Spacing and layout

- Tailwind's 4px spacing scale. Page gutters are `px-4` (mobile), `sm:px-6` and `lg:px-10`. Content max width is `max-w-6xl`.
- Sections are separated by `space-y-10` to `space-y-16`. Within a section, `gap-5` or `gap-6`.
- Breakpoints (Tailwind defaults): `sm` 640, `md` 768, `lg` 1024.
  - `< md`: sticky 56px navy top bar plus a drawer (`<dialog>`).
  - `md`: 80px icon rail with visible labels.
  - `lg+`: 240px sidebar with account footer.

## 4. Borders and radius

- `rounded-sm` (4px) for buttons, inputs, icon buttons and selects. `rounded-md` (6px) for dialogs.
- Hairlines (`border-line`) separate sections, table rows and list items.
- `border-l-2` accents mark one notable item: a workout in progress, a toast, a success line. Each is a single rule, not a box.
- Cards are not used for metrics or text. The only bordered groups are interactive option cards (onboarding goal radios), dialogs and toasts.
- `shadow-overlay` exists only for overlays (dialogs, toasts, chart tooltips).

## 5. Buttons (`components/ui/Button.tsx`)

| Variant | Look | Use |
|---|---|---|
| `primary` | Teal fill, white text | The main action on a screen (Log food, Finish workout) |
| `secondary` | White with `line-strong` border | Alternatives (Cancel, Log and close) |
| `danger` | Danger fill | Confirmed destructive actions |
| `quiet` | Text with hover fill | In-section actions (Add food, Add set) |
| `text` | Teal text, underline on hover | Inline navigation |

Sizes are `md` (40px) and `sm` (32px). The `loading` prop shows a spinner, sets `aria-busy` and disables the button. Disabled buttons use 50% opacity and a not-allowed cursor.

`IconButton` (32 or 36px) **requires** `label`, which becomes both `aria-label` and the tooltip. Tones are `default`, `danger` and `on-navy`.

## 6. Forms (`components/ui/Field.tsx`)

- Every control has a visible `<label for>` (`TextInput`, `NumberInput`, `SelectInput`, `Textarea`, `Checkbox`). `hideLabel` is allowed only where context makes the purpose obvious (list filter, recipe ingredient amount).
- Units appear as a visible suffix and are added to the accessible name ("Weight in kg").
- `NumberInput` uses `inputMode="decimal"`, tabular digits and no spinners.
- Errors use `aria-invalid`, a red border, and a message linked by `aria-describedby`, with an icon and text.
- Placeholders are examples only, never labels.

## 7. Navigation patterns

- The primary nav is the sidebar, rail or drawer. Section tabs (Diary, Foods, Recipes and Workouts, Templates) sit inside `PageHeader` as underlined links.
- In-page choices (period, food list) use `SegmentedControl`: a radio group with underline styling and arrow-key navigation.
- A skip link ("Skip to content") is the first focusable element.

## 8. Tables (`components/ui/table.ts`)

- Flat tables: `label-caps` headers, hairline row separators, hover tint, no zebra striping, no cell boxes.
- Numbers are right-aligned with `num`.
- Responsive approach: secondary columns hide with `hidden sm:table-cell`, and their values move into a secondary line under the identifying column (for example "P 30 g, C 12 g, F 5 g"). This follows NN/g's mobile table guidance.
- The diary uses `table-fixed` with shared column widths so all four meal tables align.

## 9. Charts (`components/charts/`)

- Every chart is wrapped in `ChartFrame`: a title phrased as the question it answers, a caption explaining method and gaps, the y-axis unit, a legend when there are 2 or more series, an `aria-label` summary, and a "Show data table" disclosure.
- Line and time series use a numeric time x-axis, so gaps keep their real spacing. Lines are 2px with round caps. Markers are 8px with a 2px white ring.
- Bars are at most 24px wide, with 4px rounded data ends and a square baseline.
- Grid: one hairline per y tick, solid, horizontal only. One y-axis only, never dual axes.
- Text in charts uses ink tokens. Series identity comes from the mark (dot, line, bar), and colour is secondary.
- Tooltips: a white panel with hairline border, values in tabular digits.
- **Palette validation** (dataviz `validate_palette.js`, light mode): teal versus teal-mid and teal versus navy **pass** CVD separation (ΔE 19.4 and 27.9) and contrast (3:1 or better). They do not meet the validator's lightness-band and chroma-floor checks, which assume many-hue categorical palettes. This is accepted on purpose to stay on-brand, because no chart has more than two series and series always differ by mark shape (dot versus line, bar versus step line) plus a legend.
- Motion: a 300ms draw animation, disabled under `prefers-reduced-motion`.

## 10. Icons

Lucide React only. Use 16px (`size-4`) in controls and 20px (`size-5`) in navigation, with stroke width 1.75 (2 to 2.25 for the check mark). Decorative icons get `aria-hidden`. No emoji.

## 11. Accessibility requirements (WCAG 2.2 AA)

- Text contrast is 4.5:1 or better (see the table above). Control borders and focus are 3:1 or better.
- Visible focus: a 2px teal outline with 2px offset (white on navy).
- Pointer targets are at least 24×24 (2.5.8). Primary touch targets are 40px.
- `scroll-padding-top` keeps focused fields clear of the sticky mobile header (2.4.11).
- Reordering uses Move up and Move down buttons, never drag only (2.5.7).
- Login works with password managers and has no cognitive tests (3.3.8).
- Status messages use `role="status"` or `role="alert"` live regions (toasts, logging confirmation).
- `prefers-reduced-motion` disables transitions and animations globally.
- Dialogs use native `<dialog>` with `showModal()` for focus trapping, Escape, inert background and focus return.

## 12. Explicit anti-patterns (do not introduce)

1. Rounded coloured boxes behind ordinary text, headings, stats or lists.
2. A card per metric. Stats sit in a `<dl>` grid on the page background.
3. Gradients, glows, neon, decorative shadows, floating shapes.
4. **Decorative centred dots between text.** ESLint fails the build on `·` or `•` in source. Use `<Divider vertical />`, a comma, or separate labels.
5. Pill containers as decoration.
6. Emoji icons.
7. Teal backgrounds behind paragraphs.
8. Everything bold.
9. Clickable-looking elements that do nothing.
10. Hardcoded or fake statistics.
11. Rings or donuts for calories and macros (rejected in research in favour of length bars).

## 13. Design review log

**2026-10-14**, reviewed against this file, AGENTS.md and the research document using source scans and screenshots at 1440px, 900px and 390px rendered against mocked API data. Fixed during the review:
- Meal tables had unaligned columns. Fixed with `table-fixed` and shared widths.
- On mobile, the set table truncated the load value and the workout title collided with its buttons. Fixed with stacked layouts and narrower cells.
- Hero figures used tabular digits. They now use proportional digits.
- Negative changes used a hyphen. They now use a true minus sign (`formatSigned`).
- Charts lacked y-axis units. `ChartFrame` now has a `unit` prop.
- `ink-muted` on `teal-soft` was 4.46:1. `teal-soft` was lightened to give 4.71:1.
- The rail monogram was the first two letters. It is now the first letter.

Source scans found no centred dots, arbitrary hex colours, gradients, emoji or font overrides.
