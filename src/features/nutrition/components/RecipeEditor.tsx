import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NumberInput, TextInput, Textarea } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { grams, kcal } from '@/lib/format'
import { recipePreview, scaleNutrients } from '@/lib/nutrition'
import { formatNumber } from '@/lib/units'
import type { Food } from '@/types/database'
import { useFoodSearch, useRecipe, useSaveRecipe } from '../hooks'

interface Row {
  key: string
  food: Food
  quantity: string
}

let rowSeq = 0
const nextKey = () => `row-${++rowSeq}`

export function RecipeEditor({ recipeId, onDone }: { recipeId: string | null; onDone: () => void }) {
  const existing = useRecipe(recipeId)
  if (recipeId && existing.isPending) return <LoadingState label="Loading recipe" />
  if (recipeId && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  return <RecipeForm key={recipeId ?? 'new'} recipeId={recipeId} initial={existing.data ?? null} onDone={onDone} />
}

function RecipeForm({ recipeId, initial, onDone }: {
  recipeId: string | null
  initial: ReturnType<typeof useRecipe>['data'] | null
  onDone: () => void
}) {
  const toast = useToast()
  const save = useSaveRecipe()
  const [name, setName] = useState(initial?.name ?? '')
  const [servings, setServings] = useState(initial?.servings != null ? String(initial.servings) : '')
  const [yieldG, setYieldG] = useState(initial?.cooked_yield_g != null ? String(initial.cooked_yield_g) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [rows, setRows] = useState<Row[]>(
    () => initial?.recipe_ingredients.map((i) => ({ key: nextKey(), food: i.food, quantity: String(i.quantity) })) ?? [],
  )
  const [submitted, setSubmitted] = useState(false)

  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  const servingsN = num(servings)
  const yieldN = num(yieldG)
  const preview = recipePreview(
    rows.map((r) => ({ food: r.food, quantity: Number(r.quantity) || 0 })),
    yieldN && yieldN > 0 ? yieldN : null,
    servingsN && servingsN > 0 ? servingsN : null,
  )

  const errors = {
    name: name.trim() === '' ? 'Enter a name' : name.length > 120 ? 'Use at most 120 characters' : undefined,
    servings: servingsN != null && !(servingsN > 0 && servingsN <= 1000) ? 'Enter a number between 0 and 1000' : undefined,
    yield: yieldN != null && !(yieldN > 0 && yieldN <= 100000) ? 'Enter a weight greater than 0' : undefined,
    rows: rows.length === 0 ? 'Add at least one ingredient' : undefined,
    quantities: rows.map((r) => (Number(r.quantity) > 0 ? undefined : 'Enter an amount')),
  }
  const valid = !errors.name && !errors.servings && !errors.yield && !errors.rows && errors.quantities.every((e) => !e)

  const submit = useSingleFlight(async () => {
    setSubmitted(true)
    if (!valid) return
    try {
      await save.mutateAsync({
        id: recipeId,
        input: {
          name: name.trim(),
          notes: notes.trim() || null,
          servings: servingsN,
          cooked_yield_g: yieldN,
          ingredients: rows.map((r) => ({ food_id: r.food.id, quantity: Number(r.quantity) })),
        },
      })
      toast.success(recipeId ? `Saved ${name.trim()}.` : `Created ${name.trim()}.`)
      onDone()
    } catch (error) {
      toast.error(error, 'Could not save the recipe.')
    }
  })

  const show = (e: string | undefined) => (submitted ? e : undefined)

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-8">
      <div className="space-y-5">
        <TextInput label="Recipe name" value={name} onChange={(e) => setName(e.target.value)} error={show(errors.name)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberInput label="Cooked yield" unit="g" value={yieldG} onChange={(e) => setYieldG(e.target.value)} error={show(errors.yield)}
            hint="Weigh the finished dish. Without it, values are estimated from raw weights." />
          <NumberInput label="Servings" value={servings} onChange={(e) => setServings(e.target.value)} error={show(errors.servings)}
            hint="Optional. Adds a '1 serving' size." />
        </div>
      </div>

      <section aria-labelledby="ingredients-heading">
        <h3 id="ingredients-heading" className="label-caps mb-3">Ingredients</h3>
        {rows.length > 0 && (
          <ul className="mb-4 divide-y divide-line border-y border-line">
            {rows.map((r, i) => {
              const n = scaleNutrients(r.food, Number(r.quantity) || 0)
              return (
                <li key={r.key} className="grid grid-cols-[1fr_7.5rem_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.food.name}</p>
                    <p className="num text-xs text-ink-soft">{kcal(n.calories)} kcal, P {grams(n.protein_g)}, C {grams(n.carbs_g)}, F {grams(n.fat_g)}</p>
                  </div>
                  <NumberInput label={`Amount of ${r.food.name}`} hideLabel unit={r.food.base_unit} value={r.quantity}
                    error={show(errors.quantities[i])}
                    onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, quantity: e.target.value } : x)))} />
                  <IconButton label={`Remove ${r.food.name}`} tone="danger" icon={<Trash2 className="size-4" strokeWidth={1.75} />}
                    onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} />
                </li>
              )
            })}
          </ul>
        )}
        {show(errors.rows) && <p className="mb-3 text-sm text-danger">{errors.rows}</p>}
        <IngredientPicker
          onPick={(food) => setRows((all) => [...all, { key: nextKey(), food, quantity: '100' }])}
        />
      </section>

      {preview && (
        <section aria-labelledby="recipe-preview-heading" aria-live="polite">
          <h3 id="recipe-preview-heading" className="label-caps mb-3">Calculated nutrition</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-3 sm:grid-cols-4">
            <div><dt className="text-xs text-ink-muted">Whole batch</dt><dd className="num font-semibold">{kcal(preview.batch.calories)} kcal</dd></div>
            <div><dt className="text-xs text-ink-muted">Yield</dt><dd className="num font-semibold">{formatNumber(preview.yieldAmount, 0)} g</dd></div>
            <div><dt className="text-xs text-ink-muted">Per 100 g</dt><dd className="num font-semibold">{kcal(preview.per100g.calories)} kcal</dd></div>
            <div>
              <dt className="text-xs text-ink-muted">Per serving</dt>
              <dd className="num font-semibold">{preview.perServing ? `${kcal(preview.perServing.calories)} kcal` : '-'}</dd>
              {preview.servingAmount && <dd className="num text-xs text-ink-soft">{formatNumber(preview.servingAmount, 0)} g</dd>}
            </div>
          </dl>
          {preview.yieldEstimated && (
            <p className="mt-3 text-xs text-ink-muted">
              Estimate: without a cooked yield, the finished weight is assumed to equal the raw ingredient weight ({formatNumber(preview.rawAmount, 0)} g). Cooking usually changes weight through water loss or absorption.
            </p>
          )}
          {preview.containsEstimates && <p className="mt-2 text-xs text-ink-muted">Some ingredients use estimated values.</p>}
        </section>
      )}

      <Textarea label="Notes" hint="Optional." value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{recipeId ? 'Save recipe' : 'Create recipe'}</Button>
      </div>
    </form>
  )
}

function IngredientPicker({ onPick }: { onPick: (food: Food) => void }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 200)
    return () => window.clearTimeout(t)
  }, [query])
  const search = useFoodSearch(debounced)
  const results = (search.data ?? []).filter((f) => f.recipe_id == null).slice(0, 8)

  return (
    <div>
      <div className="relative">
        <TextInput label="Add an ingredient" type="search" autoComplete="off" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)}
          hint="Recipes cannot be used as ingredients." />
        <Search aria-hidden className="pointer-events-none absolute top-[2.35rem] left-3 size-4 text-ink-muted" strokeWidth={1.75} />
      </div>
      {debounced.trim().length >= 2 && (
        <ul className="mt-2 divide-y divide-line" aria-label="Ingredient results">
          {search.isPending && <li><LoadingState label="Searching" className="py-3" /></li>}
          {!search.isPending && results.length === 0 && <li className="py-3 text-sm text-ink-soft">No matching foods.</li>}
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" className="group flex w-full items-center justify-between gap-3 py-2.5 text-left"
                onClick={() => { onPick(f); setQuery(''); setDebounced('') }}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold group-hover:text-teal">{f.name}</span>
                  <span className="num text-xs text-ink-muted">{kcal(f.calories)} kcal per {formatNumber(f.reference_amount, 1)} {f.base_unit}{f.brand ? `, ${f.brand}` : ''}</span>
                </span>
                <Plus aria-hidden className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
