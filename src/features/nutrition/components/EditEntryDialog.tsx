import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectInput, TextInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { isDateString } from '@/lib/dates'
import { MEALS } from '@/lib/nutrition'
import { queryKeys } from '@/lib/queryKeys'
import type { FoodEntry, Meal } from '@/types/database'
import { fetchFood } from '../api'
import { useUpdateEntry } from '../hooks'
import { FoodMeta } from './FoodMeta'
import { QuantityForm, type QuantityValue, type ServingOption } from './QuantityForm'

/**
 * Edits amount, meal or date. Nutrients are recalculated from the entry's own snapshot,
 * so editing an old entry never pulls in later changes to the food.
 */
export function EditEntryDialog({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdateEntry()
  const [meal, setMeal] = useState<Meal>(entry.meal)
  const [date, setDate] = useState(entry.entry_date)
  const food = useQuery({
    queryKey: queryKeys.foods.detail(entry.food_id ?? 'deleted'),
    queryFn: () => fetchFood(entry.food_id!),
    enabled: !!entry.food_id,
    retry: false,
  })

  const servings: ServingOption[] = (food.data?.food_servings ?? []).map((s) => ({ id: s.id, label: s.label, amount: s.amount }))
  if (entry.serving_count != null && entry.serving_label && entry.serving_amount != null && !servings.some((s) => s.id === entry.serving_id)) {
    servings.unshift({ id: entry.serving_id ?? '__current', label: entry.serving_label, amount: entry.serving_amount })
  }
  const initial: QuantityValue =
    entry.serving_count != null && entry.serving_amount != null
      ? { mode: 'serving', servingId: entry.serving_id ?? '__current', count: entry.serving_count, amount: entry.serving_amount }
      : { mode: 'base', quantity: entry.quantity }
  const [value, setValue] = useState<QuantityValue | null>(initial)
  const ready = !entry.food_id || !food.isPending

  const save = useSingleFlight(async () => {
    if (!value || !isDateString(date)) return
    const patch =
      value.mode === 'base'
        ? { quantity: value.quantity, serving_id: null, serving_count: null }
        : value.servingId === '__current' || value.servingId === entry.serving_id
          ? { serving_count: value.count }
          : { serving_id: value.servingId, serving_count: value.count }
    try {
      await update.mutateAsync({ id: entry.id, patch: { ...patch, meal, entry_date: date }, previousDate: entry.entry_date })
      toast.success(`Updated ${entry.food_name}.`)
      onClose()
    } catch (error) {
      toast.error(error, 'Could not update the entry.')
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${entry.food_name}`}
      description={<FoodMeta brand={entry.food_brand} provenance={entry.snapshot_provenance} showSource />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save()} disabled={!value || !isDateString(date)} loading={update.isPending}>Save changes</Button>
        </>
      }
    >
      {ready && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-6">
          <QuantityForm
            nutrients={{
              reference_amount: entry.snapshot_reference_amount,
              calories: entry.snapshot_calories,
              protein_g: entry.snapshot_protein_g,
              carbs_g: entry.snapshot_carbs_g,
              fat_g: entry.snapshot_fat_g,
              fiber_g: entry.snapshot_fiber_g,
            }}
            baseUnit={entry.base_unit}
            servings={servings}
            initial={initial}
            onChange={setValue}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
              {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </SelectInput>
            <TextInput label="Date" type="date" value={date} className="num" onChange={(e) => setDate(e.target.value)} error={isDateString(date) ? undefined : 'Choose a valid date'} />
          </div>
          {!entry.food_id && <p className="text-xs text-ink-muted">The original food was deleted. This entry keeps the nutrition values it was logged with.</p>}
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  )
}
