import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NumberInput, SelectInput, Textarea } from '@/components/ui/Field'
import { Divider } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { grams, kcal } from '@/lib/format'
import { MEALS, scaleNutrients, sumTotals } from '@/lib/nutrition'
import type { Meal } from '@/types/database'
import { estimateMeal, type EstimatedItem } from '../api'
import { useLogUsdaFoods } from '../hooks'

const MAX_LENGTH = 600

const BASIS_TEXT: Record<EstimatedItem['portion_basis'], string> = {
  user_weight: 'Portion from the weight you gave',
  usda_portion: 'Portion from a USDA serving weight',
  estimate: 'Portion estimated by the assistant, so check it',
}

interface Row extends EstimatedItem {
  key: string
  gramsText: string
}

/**
 * Describe a meal in words; the assistant matches USDA FoodData Central foods and portions.
 * Nutrition values are USDA data recalculated here as grams change. Nothing is logged until
 * the user reviews the list and confirms.
 */
export function DescribeMealView({ date, meal, onMealChange, onLogged }: {
  date: string
  meal: Meal
  onMealChange: (m: Meal) => void
  onLogged: (message: string) => void
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [unmatched, setUnmatched] = useState<string[]>([])
  const estimate = useMutation({ mutationFn: estimateMeal })
  const log = useLogUsdaFoods()

  const run = useSingleFlight(async () => {
    const t = text.trim()
    if (!t) return
    try {
      const result = await estimate.mutateAsync(t)
      setRows(result.items.map((i, n) => ({ ...i, key: `${i.fdc_id}-${n}`, gramsText: String(i.grams) })))
      setUnmatched(result.unmatched)
    } catch {
      // shown inline from estimate.error
    }
  })

  const parsed = (rows ?? []).map((r) => {
    const g = Number(r.gramsText)
    const valid = r.gramsText.trim() !== '' && Number.isFinite(g) && g > 0 && g <= 3000
    return { row: r, g, valid, n: scaleNutrients({ reference_amount: 100, ...r.per100g }, valid ? g : 0) }
  })
  const allValid = parsed.length > 0 && parsed.every((p) => p.valid)
  const totals = sumTotals(parsed.map((p) => p.n))

  const submit = useSingleFlight(async () => {
    if (!allValid) return
    try {
      const n = await log.mutateAsync({
        date,
        meal,
        items: parsed.map(({ row, g }) => ({
          fdc_id: row.fdc_id, description: row.description, data_type: row.data_type, grams: g,
          calories: row.per100g.calories, protein_g: row.per100g.protein_g, carbs_g: row.per100g.carbs_g,
          fat_g: row.per100g.fat_g, fiber_g: row.per100g.fiber_g,
        })),
      })
      const message = `Logged ${n} ${n === 1 ? 'item' : 'items'} (${kcal(totals.calories)} kcal) to ${MEALS.find((m) => m.value === meal)?.label}.`
      setRows(null)
      setUnmatched([])
      setText('')
      onLogged(message)
    } catch (error) {
      toast.error(error, 'Could not log these items.')
    }
  })

  return (
    <div className="space-y-6">
      <form noValidate onSubmit={(e) => { e.preventDefault(); run() }} className="space-y-4">
        <Textarea
          label="What did you eat?"
          autoFocus
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          hint={<>For example: 2 scrambled eggs, 1 cup cooked white rice, 150 g grilled chicken breast. <span className="num">{text.length}/{MAX_LENGTH}</span></>}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant={rows ? 'secondary' : 'primary'} icon={<Sparkles className="size-4" strokeWidth={1.75} />} loading={estimate.isPending} disabled={!text.trim()}>
            {rows ? 'Estimate again' : 'Match with USDA data'}
          </Button>
          <p className="text-xs text-ink-muted">An AI model (Mistral) suggests foods and portions. Nutrition values come from USDA FoodData Central.</p>
        </div>
      </form>

      {estimate.isError && <ErrorState title="Could not estimate this meal" error={estimate.error} />}

      {rows && (
        <section aria-labelledby="review-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-2">
            <h3 id="review-heading" className="font-semibold">Review before logging</h3>
            <p className="num text-sm text-ink-soft" aria-live="polite">
              {kcal(totals.calories)} kcal<Divider vertical />P {grams(totals.protein_g)} g<Divider vertical />C {grams(totals.carbs_g)} g<Divider vertical />F {grams(totals.fat_g)} g
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-ink-soft">No foods matched. Try naming the foods more plainly, or use search.</p>
          ) : (
            <ul className="divide-y divide-line">
              {parsed.map(({ row, valid, n }) => (
                <li key={row.key} className="grid grid-cols-[1fr_7.5rem_auto] items-start gap-3 py-4">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">&ldquo;{row.label}&rdquo;</p>
                    <p className="font-semibold">{row.description}</p>
                    <p className="text-xs text-ink-muted">USDA FDC {row.fdc_id}<Divider vertical className="mx-2 h-3" />{row.data_type}</p>
                    <p className={row.portion_basis === 'estimate' ? 'mt-1 text-xs font-semibold text-ink' : 'mt-1 text-xs text-ink-soft'}>
                      {BASIS_TEXT[row.portion_basis]}{row.note ? `: ${row.note}` : ''}
                    </p>
                    <p className="num mt-1 text-sm">
                      <span className="font-semibold">{kcal(n.calories)} kcal</span>
                      <span className="text-ink-soft">, P {grams(n.protein_g)} g, C {grams(n.carbs_g)} g, F {grams(n.fat_g)} g</span>
                    </p>
                  </div>
                  <NumberInput
                    label={`Grams of ${row.description}`}
                    hideLabel
                    unit="g"
                    value={row.gramsText}
                    error={valid ? undefined : '1 to 3000'}
                    onChange={(e) => setRows((all) => all!.map((x) => (x.key === row.key ? { ...x, gramsText: e.target.value } : x)))}
                  />
                  <IconButton label={`Remove ${row.description}`} tone="danger" icon={<Trash2 className="size-4" strokeWidth={1.75} />}
                    onClick={() => setRows((all) => all!.filter((x) => x.key !== row.key))} />
                </li>
              ))}
            </ul>
          )}

          {unmatched.length > 0 && (
            <p className="text-sm text-ink-soft">
              Not matched: {unmatched.join(', ')}. Add these with search.
            </p>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
            <SelectInput label="Meal" containerClassName="w-40" value={meal} onChange={(e) => onMealChange(e.target.value as Meal)}>
              {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </SelectInput>
            <Button onClick={() => submit()} disabled={!allValid} loading={log.isPending}>
              Log {parsed.length} {parsed.length === 1 ? 'item' : 'items'}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
