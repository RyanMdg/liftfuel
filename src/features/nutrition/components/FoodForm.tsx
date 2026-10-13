import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NumberInput, SelectInput, TextInput } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { useToast } from '@/components/ui/Toast'
import { caloriesFromMacros } from '@/lib/nutrition'
import type { FoodInput } from '@/types/database'
import { optionalNumber, requiredNumber } from '../schemas'
import type { FoodWithServings } from '../api'
import { useSaveFood } from '../hooks'

const nonNeg = (label: string) => requiredNumber(z.number().min(0, `${label} cannot be negative`).max(100000, 'Too high'), `Enter ${label.toLowerCase()}`)

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
    brand: z.string().trim().max(80, 'Use at most 80 characters'),
    base_unit: z.enum(['g', 'ml']),
    reference_amount: requiredNumber(z.number().gt(0, 'Must be more than 0').max(100000, 'Too high'), 'Enter the reference amount'),
    calories: nonNeg('Calories'),
    protein_g: nonNeg('Protein'),
    carbs_g: nonNeg('Carbohydrates'),
    fat_g: nonNeg('Fat'),
    fiber_g: optionalNumber(z.number().min(0, 'Cannot be negative')),
    preparation: z.enum(['raw', 'cooked', 'not_applicable']),
    provenance: z.enum(['nutrition_label', 'user_entered', 'reference_database', 'estimated']),
    provenance_note: z.string().trim().max(300, 'Use at most 300 characters'),
    barcode: z.string().trim().regex(/^(\d{6,14})?$/, 'Use 6 to 14 digits'),
    servings: z.array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1, 'Name the serving').max(60, 'Too long'),
        amount: requiredNumber(z.number().gt(0, 'Must be more than 0').max(100000, 'Too high'), 'Enter the amount'),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.base_unit === 'g' && v.protein_g + v.carbs_g + v.fat_g > v.reference_amount * 1.02) {
      ctx.addIssue({ code: 'custom', path: ['fat_g'], message: `Protein, carbs and fat add up to more than ${v.reference_amount} g` })
    }
    if (v.fiber_g != null && v.fiber_g > v.carbs_g + 0.5) {
      ctx.addIssue({ code: 'custom', path: ['fiber_g'], message: 'Fiber cannot exceed total carbohydrates' })
    }
    const labels = v.servings.map((s) => s.label.toLowerCase())
    labels.forEach((l, i) => {
      if (labels.indexOf(l) !== i) ctx.addIssue({ code: 'custom', path: ['servings', i, 'label'], message: 'Each serving needs a different name' })
    })
  })

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function toDefaults(food?: FoodWithServings | null): FormInput {
  if (!food) {
    return {
      name: '', brand: '', base_unit: 'g', reference_amount: 100, calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '',
      preparation: 'not_applicable', provenance: 'nutrition_label', provenance_note: '', barcode: '', servings: [],
    }
  }
  return {
    name: food.name, brand: food.brand ?? '', base_unit: food.base_unit, reference_amount: food.reference_amount,
    calories: food.calories, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g, fiber_g: food.fiber_g ?? '',
    preparation: food.preparation,
    provenance: food.provenance === 'recipe_calculated' ? 'user_entered' : food.provenance,
    provenance_note: food.provenance_note ?? '', barcode: food.barcode ?? '',
    servings: food.food_servings.map((s) => ({ id: s.id, label: s.label, amount: s.amount })),
  }
}

interface FoodFormProps {
  food?: FoodWithServings | null
  /** Pre-fill the name when creating from a search with no results. */
  initialName?: string
  onSaved: (foodId: string) => void
  onCancel: () => void
  submitLabel?: string
}

/** Create or edit a custom food. Nutrients are entered per reference amount, as printed on labels. */
export function FoodForm({ food, initialName, onSaved, onCancel, submitLabel }: FoodFormProps) {
  const toast = useToast()
  const save = useSaveFood()
  const defaults = toDefaults(food)
  if (!food && initialName) defaults.name = initialName
  const { register, handleSubmit, control, watch, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })
  const servings = useFieldArray({ control, name: 'servings' })
  const unit = watch('base_unit')
  const [p, c, f, cal] = watch(['protein_g', 'carbs_g', 'fat_g', 'calories']).map((v) => Number(v) || 0)
  const e = formState.errors

  const onSubmit = handleSubmit(async (v) => {
    const payload: FoodInput = {
      name: v.name, brand: v.brand || null, base_unit: v.base_unit, reference_amount: v.reference_amount,
      calories: v.calories, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g, fiber_g: v.fiber_g ?? null,
      barcode: v.barcode || null, preparation: v.preparation, provenance: v.provenance, provenance_note: v.provenance_note || null,
    }
    try {
      const id = await save.mutateAsync({ id: food?.id ?? null, food: payload, servings: v.servings })
      toast.success(food ? `Saved ${v.name}.` : `Created ${v.name}.`)
      onSaved(id)
    } catch (error) {
      toast.error(error, 'Could not save the food.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="label-caps mb-4">Food</legend>
        <TextInput label="Name" error={e.name?.message} {...register('name')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Brand" hint="Optional." error={e.brand?.message} {...register('brand')} />
          <SelectInput label="Preparation" {...register('preparation')}>
            <option value="not_applicable">Not applicable</option>
            <option value="raw">Raw (as purchased)</option>
            <option value="cooked">Cooked</option>
          </SelectInput>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="label-caps mb-4">Nutrition per reference amount</legend>
        <div className="grid grid-cols-2 gap-5">
          <NumberInput label="Reference amount" unit={unit} hint="As printed, e.g. 100 or one serving's weight." error={e.reference_amount?.message} {...register('reference_amount')} />
          <SelectInput label="Measured in" {...register('base_unit')}>
            <option value="g">Grams (g)</option>
            <option value="ml">Millilitres (ml)</option>
          </SelectInput>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <NumberInput label="Calories" unit="kcal" error={e.calories?.message} {...register('calories')} />
          <NumberInput label="Protein" unit="g" error={e.protein_g?.message} {...register('protein_g')} />
          <NumberInput label="Carbohydrates" unit="g" error={e.carbs_g?.message} {...register('carbs_g')} />
          <NumberInput label="Fat" unit="g" error={e.fat_g?.message} {...register('fat_g')} />
          <NumberInput label="Fiber" unit="g" hint="Optional." error={e.fiber_g?.message} {...register('fiber_g')} />
        </div>
        {cal > 0 && (p || c || f) ? (
          <p className="text-xs text-ink-muted">
            Macros imply <span className="num font-semibold">{caloriesFromMacros(p, c, f)}</span> kcal. Labels often differ slightly because of rounding and fiber.
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="label-caps mb-2">Serving sizes</legend>
        <p className="mb-4 text-sm text-ink-soft">Optional. Lets you log &ldquo;1 slice&rdquo; instead of weighing.</p>
        {servings.fields.length > 0 && (
          <ul className="mb-4 space-y-3">
            {servings.fields.map((field, i) => (
              <li key={field.id} className="grid grid-cols-[1fr_8rem_auto] items-start gap-3">
                <TextInput label={`Serving ${i + 1} name`} placeholder="1 slice" error={e.servings?.[i]?.label?.message} {...register(`servings.${i}.label`)} />
                <NumberInput label="Amount" unit={unit} error={e.servings?.[i]?.amount?.message} {...register(`servings.${i}.amount`)} />
                <IconButton label={`Remove serving ${i + 1}`} tone="danger" className="mt-7" icon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={() => servings.remove(i)} />
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" size="sm" icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => servings.append({ label: '', amount: '' })}>
          Add serving size
        </Button>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="label-caps mb-4">Source</legend>
        <SelectInput label="Where the values come from" hint="Estimates are labelled wherever this food appears." {...register('provenance')}>
          <option value="nutrition_label">Package nutrition label</option>
          <option value="reference_database">Reference database (e.g. USDA)</option>
          <option value="user_entered">Entered by me</option>
          <option value="estimated">Estimate</option>
        </SelectInput>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Source note" hint="Optional, e.g. database entry or label date." error={e.provenance_note?.message} {...register('provenance_note')} />
          <TextInput label="Barcode" inputMode="numeric" hint="Optional." error={e.barcode?.message} {...register('barcode')} />
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>{submitLabel ?? (food ? 'Save food' : 'Create food')}</Button>
      </div>
    </form>
  )
}
