import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectInput, TextInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { formatDateMedium, isDateString } from '@/lib/dates'
import { amountLabel } from '@/lib/format'
import { MEALS } from '@/lib/nutrition'
import type { FoodEntry, Meal } from '@/types/database'
import { useDuplicateEntry } from '../hooks'

export function DuplicateEntryDialog({ entry, defaultDate, onClose }: { entry: FoodEntry; defaultDate: string; onClose: () => void }) {
  const toast = useToast()
  const duplicate = useDuplicateEntry()
  const [date, setDate] = useState(defaultDate)
  const [meal, setMeal] = useState<Meal>(entry.meal)
  const submit = useSingleFlight(async () => {
    if (!isDateString(date)) return
    try {
      await duplicate.mutateAsync({ id: entry.id, date, meal })
      toast.success(`Copied ${entry.food_name} to ${MEALS.find((m) => m.value === meal)?.label}, ${formatDateMedium(date)}.`)
      onClose()
    } catch (error) {
      toast.error(error, 'Could not copy the entry.')
    }
  })
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title="Copy entry"
      description={`${amountLabel(entry)} ${entry.food_name}, with the same nutrition values.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit()} disabled={!isDateString(date)} loading={duplicate.isPending}>Copy</Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Date" type="date" value={date} className="num" onChange={(e) => setDate(e.target.value)} error={isDateString(date) ? undefined : 'Choose a valid date'} />
        <SelectInput label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </SelectInput>
      </div>
    </Dialog>
  )
}
