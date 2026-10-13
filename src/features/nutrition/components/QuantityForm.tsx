import { useId, useState, type ReactNode } from 'react'
import { NumberInput, SelectInput } from '@/components/ui/Field'
import { grams, kcal } from '@/lib/format'
import { scaleNutrients } from '@/lib/nutrition'
import { formatNumber } from '@/lib/units'
import type { BaseUnit, Food } from '@/types/database'

export interface ServingOption {
  /** Serving id, or '__current' for an entry's own serving snapshot whose source was deleted. */
  id: string
  label: string
  amount: number
}

export type QuantityValue =
  | { mode: 'base'; quantity: number }
  | { mode: 'serving'; servingId: string; count: number; amount: number }

export const BASE = '__base'

interface QuantityFormProps {
  nutrients: Pick<Food, 'reference_amount' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>
  baseUnit: BaseUnit
  servings: ServingOption[]
  initial: QuantityValue
  onChange: (value: QuantityValue | null) => void
  /** Rendered beside the inputs, e.g. a meal select. */
  extra?: ReactNode
}

/** Amount input with unit or serving selection and a live nutrient preview. */
export function QuantityForm({ nutrients, baseUnit, servings, initial, onChange, extra }: QuantityFormProps) {
  const previewId = useId()
  const [unitChoice, setUnitChoice] = useState(initial.mode === 'base' ? BASE : initial.servingId)
  const [raw, setRaw] = useState(String(initial.mode === 'base' ? initial.quantity : initial.count))
  const serving = servings.find((s) => s.id === unitChoice)
  const value = Number(raw)
  const valid = raw.trim() !== '' && Number.isFinite(value) && value > 0 && value <= (serving ? 1000 : 100000)
  const quantity = valid ? (serving ? value * serving.amount : value) : 0
  const preview = scaleNutrients(nutrients, quantity)

  function emit(choice: string, text: string) {
    const n = Number(text)
    const s = servings.find((x) => x.id === choice)
    const ok = text.trim() !== '' && Number.isFinite(n) && n > 0 && n <= (s ? 1000 : 100000)
    if (!ok) return onChange(null)
    onChange(s ? { mode: 'serving', servingId: s.id, count: n, amount: s.amount } : { mode: 'base', quantity: n })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberInput
          label={serving ? 'Number of servings' : 'Amount'}
          unit={serving ? undefined : baseUnit}
          value={raw}
          autoFocus
          min={0}
          aria-describedby={previewId}
          error={raw.trim() !== '' && !valid ? 'Enter an amount greater than 0' : undefined}
          onChange={(e) => {
            setRaw(e.target.value)
            emit(unitChoice, e.target.value)
          }}
        />
        <SelectInput
          label="Measure"
          value={unitChoice}
          onChange={(e) => {
            const next = e.target.value
            const nextServing = servings.find((s) => s.id === next)
            // Keep the same real-world amount when switching between grams and servings.
            const nextRaw = !valid ? raw : nextServing
              ? formatNumber(quantity / nextServing.amount, 2).replaceAll(',', '')
              : formatNumber(quantity, 1).replaceAll(',', '')
            setUnitChoice(next)
            setRaw(nextRaw)
            emit(next, nextRaw)
          }}
        >
          <option value={BASE}>{baseUnit === 'g' ? 'Grams (g)' : 'Millilitres (ml)'}</option>
          {servings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({formatNumber(s.amount, 1)} {baseUnit})
            </option>
          ))}
        </SelectInput>
        {extra}
      </div>

      <div id={previewId} aria-live="polite">
        <p className="label-caps mb-2">
          For {valid ? `${formatNumber(quantity, 1)} ${baseUnit}` : 'this amount'}
        </p>
        <dl className="grid grid-cols-4 gap-4 border-t border-line pt-3">
          {[
            ['Calories', kcal(preview.calories), 'kcal'],
            ['Protein', grams(preview.protein_g), 'g'],
            ['Carbs', grams(preview.carbs_g), 'g'],
            ['Fat', grams(preview.fat_g), 'g'],
          ].map(([label, v, u]) => (
            <div key={label}>
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="num text-lg font-semibold">
                {v}
                <span className="ml-0.5 text-xs font-medium text-ink-soft">{u}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
