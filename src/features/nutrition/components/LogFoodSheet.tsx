import { useEffect, useMemo, useRef, useState } from 'react'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { ChevronLeft, Plus, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectInput, TextInput } from '@/components/ui/Field'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { kcal, grams } from '@/lib/format'
import { MEALS } from '@/lib/nutrition'
import { formatNumber } from '@/lib/units'
import { cn } from '@/lib/cn'
import type { Meal } from '@/types/database'
import { fetchFood, type FoodWithServings } from '../api'
import { useAddEntry, useFavorites, useFoodSearch, useRecentFoods, useSetFavorite } from '../hooks'
import { DescribeMealView } from './DescribeMealView'
import { FoodForm } from './FoodForm'
import { FoodMeta } from './FoodMeta'
import { QuantityForm, type QuantityValue } from './QuantityForm'

type View =
  | { kind: 'search' }
  | { kind: 'describe' }
  | { kind: 'amount'; food: FoodWithServings; initial: QuantityValue }
  | { kind: 'create'; name: string }

interface LogFoodSheetProps {
  open: boolean
  onClose: () => void
  date: string
  meal: Meal
}

/** Mounted only while open, so every opening starts fresh at the search step. */
export function LogFoodSheet(props: LogFoodSheetProps) {
  return props.open ? <LogFoodSheetContent {...props} /> : null
}

function LogFoodSheetContent({ onClose, date, meal: initialMeal }: LogFoodSheetProps) {
  const [view, setView] = useState<View>({ kind: 'search' })
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const mealLabel = MEALS.find((m) => m.value === meal)?.label ?? meal
  const title = view.kind === 'create' ? 'Create a food' : view.kind === 'amount' ? view.food.name : `Log food to ${mealLabel}`

  return (
    <Dialog open onClose={onClose} variant="sheet" title={title} description={view.kind === 'amount' ? <FoodMeta brand={view.food.brand} preparation={view.food.preparation} provenance={view.food.provenance} showSource /> : undefined}>
      {(view.kind === 'search' || view.kind === 'describe') && (
        <SegmentedControl<'search' | 'describe'>
          label="How to log"
          className="mb-6"
          value={view.kind}
          onChange={(kind) => setView({ kind })}
          options={[{ value: 'search', label: 'Search foods' }, { value: 'describe', label: 'Describe a meal' }]}
        />
      )}
      {view.kind === 'describe' && (
        <>
          {lastAdded && <p role="status" className="mb-6 border-l-2 border-teal pl-3 text-sm">{lastAdded}</p>}
          <DescribeMealView date={date} meal={meal} onMealChange={setMeal} onLogged={(message) => setLastAdded(message)} />
        </>
      )}
      {view.kind === 'search' && (
        <SearchView
          meal={meal}
          onMealChange={setMeal}
          lastAdded={lastAdded}
          onPick={(food, initial) => setView({ kind: 'amount', food, initial })}
          onCreate={(name) => setView({ kind: 'create', name })}
        />
      )}
      {view.kind === 'amount' && (
        <AmountView
          key={view.food.id}
          food={view.food}
          initial={view.initial}
          date={date}
          meal={meal}
          onMealChange={setMeal}
          onBack={() => setView({ kind: 'search' })}
          onAdded={(message, close) => {
            setLastAdded(message)
            if (close) onClose()
            else setView({ kind: 'search' })
          }}
        />
      )}
      {view.kind === 'create' && (
        <FoodForm
          initialName={view.name}
          submitLabel="Create and continue"
          onCancel={() => setView({ kind: 'search' })}
          onSaved={async (id) => {
            const food = await fetchFood(id)
            setView({ kind: 'amount', food, initial: defaultQuantity(food) })
          }}
        />
      )}
    </Dialog>
  )
}

function defaultQuantity(food: FoodWithServings): QuantityValue {
  const first = food.food_servings[0]
  return first ? { mode: 'serving', servingId: first.id, count: 1, amount: first.amount } : { mode: 'base', quantity: 100 }
}

function SearchView({ meal, onMealChange, lastAdded, onPick, onCreate }: {
  meal: Meal
  onMealChange: (m: Meal) => void
  lastAdded: string | null
  onPick: (food: FoodWithServings, initial: QuantityValue) => void
  onCreate: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 200)
    return () => window.clearTimeout(t)
  }, [query])
  useEffect(() => inputRef.current?.focus(), [])

  const searching = debounced.trim().length >= 2
  const search = useFoodSearch(debounced)
  const favorites = useFavorites()
  const recent = useRecentFoods()
  const favoriteIds = useMemo(() => new Set(favorites.data?.map((f) => f.id)), [favorites.data])

  const recentQuantity = (food: FoodWithServings): QuantityValue => {
    const r = recent.data?.find((x) => x.food.id === food.id)
    if (r) {
      const serving = r.serving_id ? food.food_servings.find((s) => s.id === r.serving_id) : undefined
      if (serving && r.serving_count) return { mode: 'serving', servingId: serving.id, count: r.serving_count, amount: serving.amount }
      return { mode: 'base', quantity: r.quantity }
    }
    return defaultQuantity(food)
  }

  return (
    <div className="space-y-6">
      {lastAdded && (
        <p role="status" className="border-l-2 border-teal pl-3 text-sm">
          {lastAdded}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div className="relative">
          <TextInput
            ref={inputRef}
            label="Search foods"
            type="search"
            autoComplete="off"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search aria-hidden className="pointer-events-none absolute bottom-3 left-3 size-4 text-ink-muted" strokeWidth={1.75} />
        </div>
        <SelectInput label="Meal" value={meal} onChange={(e) => onMealChange(e.target.value as Meal)}>
          {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </SelectInput>
      </div>

      {searching ? (
        <section aria-label="Search results">
          {search.isError ? (
            <ErrorState error={search.error} onRetry={() => search.refetch()} />
          ) : search.isPending ? (
            <LoadingState label="Searching" className="py-4" />
          ) : (
            <>
              <p className="sr-only" role="status">{search.data.length} results</p>
              {search.data.length === 0 ? (
                <p className="py-4 text-sm text-ink-soft">No foods match &ldquo;{debounced.trim()}&rdquo;.</p>
              ) : (
                <FoodList foods={search.data} favoriteIds={favoriteIds} onPick={(f) => onPick(f, recentQuantity(f))} />
              )}
            </>
          )}
        </section>
      ) : (
        <>
          {favorites.data && favorites.data.length > 0 && (
            <section aria-labelledby="fav-heading">
              <h3 id="fav-heading" className="label-caps mb-1">Favourites</h3>
              <FoodList foods={favorites.data} favoriteIds={favoriteIds} onPick={(f) => onPick(f, recentQuantity(f))} />
            </section>
          )}
          <section aria-labelledby="recent-heading">
            <h3 id="recent-heading" className="label-caps mb-1">Recent</h3>
            {recent.isPending ? (
              <LoadingState label="Loading recent foods" className="py-4" />
            ) : recent.data && recent.data.length > 0 ? (
              <FoodList
                foods={recent.data.map((r) => r.food)}
                favoriteIds={favoriteIds}
                detail={(f) => {
                  const r = recent.data!.find((x) => x.food.id === f.id)!
                  const s = r.serving_id ? f.food_servings.find((x) => x.id === r.serving_id) : undefined
                  return s && r.serving_count ? `Last: ${formatNumber(r.serving_count, 2)} × ${s.label}` : `Last: ${formatNumber(r.quantity, 1)} ${f.base_unit}`
                }}
                onPick={(f) => onPick(f, recentQuantity(f))}
              />
            ) : (
              <p className="py-2 text-sm text-ink-soft">Foods you log appear here for one-tap re-logging. Search above to start.</p>
            )}
          </section>
        </>
      )}

      <div className="border-t border-line pt-5">
        <Button variant="secondary" icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => onCreate(query.trim())}>
          Create a custom food
        </Button>
      </div>
    </div>
  )
}

function FoodList({ foods, favoriteIds, onPick, detail }: {
  foods: FoodWithServings[]
  favoriteIds: Set<string>
  onPick: (food: FoodWithServings) => void
  detail?: (food: FoodWithServings) => string
}) {
  const setFavorite = useSetFavorite()
  const toast = useToast()
  return (
    <ul className="divide-y divide-line">
      {foods.map((f) => {
        const fav = favoriteIds.has(f.id)
        return (
          <li key={f.id} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(f)} className="group min-w-0 flex-1 py-3 text-left">
              <span className="block truncate font-semibold group-hover:text-teal">{f.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                <span className="num">
                  {kcal(f.calories)} kcal, P {grams(f.protein_g)}, C {grams(f.carbs_g)}, F {grams(f.fat_g)} per {formatNumber(f.reference_amount, 1)} {f.base_unit}
                </span>
                <FoodMeta brand={f.brand} provenance={f.provenance} />
              </span>
              {detail && <span className="mt-0.5 block text-xs text-ink-soft">{detail(f)}</span>}
            </button>
            <button
              type="button"
              aria-pressed={fav}
              aria-label={fav ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
              title={fav ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => setFavorite.mutate({ foodId: f.id, favorite: !fav }, { onError: (e) => toast.error(e) })}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface hover:text-ink"
            >
              <Star aria-hidden className={cn('size-4', fav && 'fill-teal text-teal')} strokeWidth={1.75} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function AmountView({ food, initial, date, meal, onMealChange, onBack, onAdded }: {
  food: FoodWithServings
  initial: QuantityValue
  date: string
  meal: Meal
  onMealChange: (m: Meal) => void
  onBack: () => void
  onAdded: (message: string, close: boolean) => void
}) {
  const toast = useToast()
  const add = useAddEntry()
  const [value, setValue] = useState<QuantityValue | null>(initial)
  // One shared in-flight request: repeated clicks or Enter presses cannot log twice.
  const submit = useSingleFlight(async (v: QuantityValue, close: boolean) => {
        try {
          await add.mutateAsync(
            v.mode === 'base'
              ? { entry_date: date, meal, food_id: food.id, quantity: v.quantity }
              : { entry_date: date, meal, food_id: food.id, serving_id: v.servingId, serving_count: v.count },
          )
          const amount = v.mode === 'base' ? `${formatNumber(v.quantity, 1)} ${food.base_unit}` : `${formatNumber(v.count, 2)} × ${food.food_servings.find((s) => s.id === v.servingId)?.label ?? 'serving'}`
          const message = `Logged ${amount} ${food.name} to ${MEALS.find((m) => m.value === meal)?.label}.`
          if (close) toast.success(message)
          onAdded(message, close)
        } catch (error) {
          toast.error(error, 'Could not log the food.')
        }
  })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (value) submit(value, false)
      }}
      className="space-y-8"
    >
      <QuantityForm
        nutrients={food}
        baseUnit={food.base_unit}
        servings={food.food_servings}
        initial={initial}
        onChange={setValue}
        extra={
          <SelectInput label="Meal" value={meal} onChange={(e) => onMealChange(e.target.value as Meal)}>
            {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </SelectInput>
        }
      />
      {food.provenance_note && <p className="text-xs text-ink-muted">{food.provenance_note}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Button variant="quiet" icon={<ChevronLeft className="size-4" strokeWidth={1.75} />} onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!value || add.isPending} onClick={() => value && submit(value, true)}>
            Log and close
          </Button>
          <Button type="submit" disabled={!value} loading={add.isPending}>
            Log
          </Button>
        </div>
      </div>
    </form>
  )
}
