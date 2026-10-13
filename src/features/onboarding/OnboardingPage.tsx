import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { APP_NAME } from '@/app/config'
import { Button } from '@/components/ui/Button'
import { NumberInput, SelectInput, TextInput } from '@/components/ui/Field'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { signOut } from '@/features/auth/api'
import { useProfile, useUpdateProfile } from '@/features/auth/hooks'
import { TargetCalculator, type EnergyProfile } from '@/features/nutrition/components/TargetCalculator'
import { detectTimeZone, supportedTimeZones, todayInZone } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { caloriesFromMacros, macrosMismatch } from '@/lib/nutrition'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { toKg } from '@/lib/units'
import { goalTargetsSchema, optionalNumber } from '@/features/nutrition/schemas'

const schema = goalTargetsSchema.extend({
  display_name: z.string().trim().max(80, 'Use at most 80 characters'),
  weight_unit: z.enum(['kg', 'lb']),
  time_zone: z.string().min(1, 'Choose a time zone'),
  goal: z.enum(['lose', 'maintain', 'gain'], { message: 'Choose a goal' }),
  body_weight: optionalNumber(z.number().min(20, 'Enter a realistic weight').max(900, 'Enter a realistic weight')),
})
type Values = z.infer<typeof schema>

const GOALS = [
  { value: 'lose', label: 'Lose fat', description: 'Eat below maintenance.' },
  { value: 'maintain', label: 'Maintain', description: 'Hold body weight steady.' },
  { value: 'gain', label: 'Build muscle', description: 'Eat slightly above maintenance.' },
] as const

export default function OnboardingPage() {
  const { user } = useAuth()
  const profile = useProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [energy, setEnergy] = useState<EnergyProfile | null>(null)
  const updateProfile = useUpdateProfile()
  const zones = useMemo(() => supportedTimeZones(), [])
  const detected = useMemo(() => detectTimeZone(), [])

  const { register, handleSubmit, watch, setValue, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { display_name: '', weight_unit: 'kg', time_zone: zones.includes(detected) ? detected : 'UTC' },
  })

  if (profile.isPending) return <main className="mx-auto max-w-md px-4 py-16"><LoadingState label="Loading your profile" /></main>
  if (profile.isError) return <main className="mx-auto max-w-md px-4 py-16"><ErrorState error={profile.error} onRetry={() => profile.refetch()} /></main>
  if (profile.data.onboarding_completed_at) return <Navigate to="/dashboard" replace />

  const unit = watch('weight_unit')
  const goal = watch('goal')
  const bodyWeight = Number(watch('body_weight'))
  const timeZone = watch('time_zone')
  const [cal, p, c, f] = watch(['calories', 'protein_g', 'carbs_g', 'fat_g']).map((v) => Number(v) || 0)
  const macroKcal = caloriesFromMacros(p, c, f)
  const mismatch = cal > 0 && (p || c || f) ? macrosMismatch(cal, p, c, f) : false

  const onSubmit = handleSubmit(async (v: Values) => {
    setFormError(null)
    try {
      if (energy) await updateProfile.mutateAsync(energy)
      const { error } = await supabase().rpc('complete_onboarding', {
        p_display_name: v.display_name,
        p_weight_unit: v.weight_unit,
        p_time_zone: v.time_zone,
        p_goal: v.goal,
        p_start_date: todayInZone(v.time_zone),
        p_calories: v.calories,
        p_protein_g: v.protein_g,
        p_carbs_g: v.carbs_g,
        p_fat_g: v.fat_g,
        p_weight_kg: v.body_weight == null ? null : Math.round(toKg(v.body_weight, v.weight_unit) * 100) / 100,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: queryKeys.profile(user!.id) })
      qc.invalidateQueries({ queryKey: queryKeys.goals() })
      qc.invalidateQueries({ queryKey: queryKeys.weights() })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not save your details. Please try again.'))
    }
  })

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <p className="text-base font-bold tracking-[0.18em] text-navy uppercase">{APP_NAME}</p>
        <Button variant="text" onClick={() => signOut()}>Sign out</Button>
      </div>
      <header className="mt-12 border-b border-line pb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-display">Set up your tracking</h1>
        <p className="mt-2 max-w-prose text-ink-soft">
          Two short sections. You can change everything later in Settings. Target changes apply from the date you choose, so past days keep the targets they had.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-14">
        {formError && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{formError}</p>}

        <section aria-labelledby="about-heading" className="grid gap-8 md:grid-cols-[12rem_1fr]">
          <div>
            <p className="label-caps">Step 1</p>
            <h2 id="about-heading" className="mt-1 text-lg font-semibold">About you</h2>
          </div>
          <div className="space-y-6">
            <TextInput label="Name" hint="Optional. Shown in the sidebar." autoComplete="given-name" error={formState.errors.display_name?.message} {...register('display_name')} />
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Goal</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {GOALS.map((g) => (
                  <label key={g.value} className="flex cursor-pointer gap-3 rounded-sm border border-line-strong p-3 has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
                    <input type="radio" value={g.value} className="mt-1 accent-teal" {...register('goal')} />
                    <span>
                      <span className="block text-sm font-semibold">{g.label}</span>
                      <span className="block text-xs text-ink-soft">{g.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {formState.errors.goal && <p className="mt-1.5 text-sm text-danger">{formState.errors.goal.message}</p>}
            </fieldset>
            <div className="grid gap-6 sm:grid-cols-2">
              <SelectInput label="Weight unit" {...register('weight_unit')}>
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </SelectInput>
              <NumberInput label="Current body weight" unit={unit} hint="Saved as today's weigh-in. Needed to calculate targets." error={formState.errors.body_weight?.message} {...register('body_weight')} />
            </div>
            <SelectInput label="Time zone" hint="Decides when your diary day starts and ends." error={formState.errors.time_zone?.message} {...register('time_zone')}>
              {zones.map((z) => <option key={z} value={z}>{z.replaceAll('_', ' ')}</option>)}
            </SelectInput>
          </div>
        </section>

        <section aria-labelledby="targets-heading" className="grid gap-8 md:grid-cols-[12rem_1fr]">
          <div>
            <p className="label-caps">Step 2</p>
            <h2 id="targets-heading" className="mt-1 text-lg font-semibold">Daily targets</h2>
          </div>
          <div className="space-y-6">
            <TargetCalculator
              unit={unit}
              goal={goal}
              today={todayInZone(timeZone || 'UTC')}
              initial={{}}
              weightKg={bodyWeight > 0 ? toKg(bodyWeight, unit) : undefined}
              weightHint="Enter your current body weight in step 1 first"
              onApply={(est, inputs) => {
                const opts = { shouldDirty: true, shouldValidate: true }
                setValue('calories', est.calories, opts)
                setValue('protein_g', est.protein_g, opts)
                setValue('carbs_g', est.carbs_g, opts)
                setValue('fat_g', est.fat_g, opts)
                setEnergy(inputs)
              }}
            />
            <NumberInput label="Calories" unit="kcal" inputMode="numeric" error={formState.errors.calories?.message} {...register('calories')} />
            <div className="grid gap-6 sm:grid-cols-3">
              <NumberInput label="Protein" unit="g" error={formState.errors.protein_g?.message} {...register('protein_g')} />
              <NumberInput label="Carbohydrates" unit="g" error={formState.errors.carbs_g?.message} {...register('carbs_g')} />
              <NumberInput label="Fat" unit="g" error={formState.errors.fat_g?.message} {...register('fat_g')} />
            </div>
            <p className={mismatch ? 'text-sm text-danger' : 'text-sm text-ink-soft'} aria-live="polite">
              Your macros add up to <span className="num font-semibold">{macroKcal.toLocaleString()}</span> kcal (4 kcal per gram of protein and carbs, 9 per gram of fat).
              {mismatch && ' That differs from your calorie target by more than 5%.'}
            </p>
          </div>
        </section>

        <div className="flex justify-end border-t border-line pt-6">
          <Button type="submit" loading={formState.isSubmitting}>Start tracking</Button>
        </div>
      </form>
    </main>
  )
}
