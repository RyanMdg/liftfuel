import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NumberInput, SelectInput, TextInput } from '@/components/ui/Field'
import { PageHeader, SectionHeading } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { tableClasses as t } from '@/components/ui/table'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { signOut, updatePassword } from '@/features/auth/api'
import { useLoadedProfile, useToday, useUpdateProfile } from '@/features/auth/hooks'
import { TargetCalculator, type EnergyProfile } from '@/features/nutrition/components/TargetCalculator'
import { useDeleteGoal, useGoals, useSaveGoal } from '@/features/nutrition/hooks'
import { goalTargetsSchema } from '@/features/nutrition/schemas'
import { useWeights } from '@/features/progress/hooks'
import { cn } from '@/lib/cn'
import { formatDateMedium, isDateString, supportedTimeZones } from '@/lib/dates'
import { gramsWhole, kcal } from '@/lib/format'
import { caloriesFromMacros, macrosMismatch } from '@/lib/nutrition'
import type { NutritionGoal } from '@/types/database'

export default function SettingsPage() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-3xl space-y-16">
        <ProfileSection />
        <TargetsSection />
        <AccountSection />
      </div>
    </>
  )
}

const profileSchema = z.object({
  display_name: z.string().trim().max(80, 'Use at most 80 characters'),
  weight_unit: z.enum(['kg', 'lb']),
  time_zone: z.string().min(1),
  goal: z.enum(['lose', 'maintain', 'gain']),
})

function ProfileSection() {
  const profile = useLoadedProfile()
  const update = useUpdateProfile()
  const toast = useToast()
  const zones = useMemo(() => {
    const z = supportedTimeZones()
    return z.includes(profile.time_zone) ? z : [profile.time_zone, ...z]
  }, [profile.time_zone])
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { display_name: profile.display_name ?? '', weight_unit: profile.weight_unit, time_zone: profile.time_zone, goal: profile.goal ?? 'maintain' },
  })
  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await update.mutateAsync({ ...v, display_name: v.display_name || null })
      reset({ display_name: saved.display_name ?? '', weight_unit: saved.weight_unit, time_zone: saved.time_zone, goal: saved.goal ?? 'maintain' })
      toast.success('Profile saved.')
    } catch (error) {
      toast.error(error, 'Could not save your profile.')
    }
  })
  return (
    <section aria-labelledby="profile-heading">
      <SectionHeading id="profile-heading" title="Profile" />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Name" error={formState.errors.display_name?.message} {...register('display_name')} />
          <SelectInput label="Goal" {...register('goal')}>
            <option value="lose">Lose fat</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Build muscle</option>
          </SelectInput>
          <SelectInput label="Weight unit" hint="Stored in kilograms; only the display changes." {...register('weight_unit')}>
            <option value="kg">Kilograms (kg)</option>
            <option value="lb">Pounds (lb)</option>
          </SelectInput>
          <SelectInput label="Time zone" hint="Decides which calendar day new entries belong to." {...register('time_zone')}>
            {zones.map((z) => <option key={z} value={z}>{z.replaceAll('_', ' ')}</option>)}
          </SelectInput>
        </div>
        <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>Save profile</Button>
      </form>
    </section>
  )
}

function TargetsSection() {
  const today = useToday()
  const profile = useLoadedProfile()
  const goals = useGoals()
  const weights = useWeights()
  const updateProfile = useUpdateProfile()
  const [energy, setEnergy] = useState<EnergyProfile | null>(null)
  const save = useSaveGoal()
  const remove = useDeleteGoal()
  const toast = useToast()
  const [deleting, setDeleting] = useState<NutritionGoal | null>(null)
  const schema = goalTargetsSchema.extend({
    effective_date: z.string().refine(isDateString, 'Choose a valid date'),
  })
  const current = goals.data?.find((g) => g.effective_date <= today) ?? goals.data?.at(-1)
  const { register, handleSubmit, formState, watch, setValue } = useForm({
    resolver: zodResolver(schema),
    values: {
      effective_date: today,
      calories: current?.calories ?? '',
      protein_g: current?.protein_g ?? '',
      carbs_g: current?.carbs_g ?? '',
      fat_g: current?.fat_g ?? '',
    },
  })
  const [cal, p, c, f] = watch(['calories', 'protein_g', 'carbs_g', 'fat_g']).map((v) => Number(v) || 0)

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync(v)
      if (energy) {
        await updateProfile.mutateAsync(energy)
        setEnergy(null)
      }
      toast.success(`Targets saved, effective ${formatDateMedium(v.effective_date)}.`)
    } catch (error) {
      toast.error(error, 'Could not save targets.')
    }
  })

  return (
    <section aria-labelledby="targets-heading" id="targets" className="scroll-mt-20">
      <SectionHeading id="targets-heading" title="Nutrition targets" />
      <p className="mb-6 max-w-prose text-sm text-ink-soft">
        New targets apply from the date you choose onward. Days before that keep the targets they had, so your history is never rewritten.
      </p>
      {goals.isError ? (
        <ErrorState error={goals.error} onRetry={() => goals.refetch()} />
      ) : goals.isPending ? (
        <LoadingState label="Loading targets" />
      ) : (
        <>
          {!weights.isPending && (
            <div className="mb-8">
              <TargetCalculator
                unit={profile.weight_unit}
                goal={profile.goal}
                today={today}
                initial={profile}
                askWeight
                initialWeightKg={weights.data?.at(-1)?.weight_kg}
                onApply={(est, inputs) => {
                  const opts = { shouldDirty: true, shouldValidate: true }
                  setValue('calories', est.calories, opts)
                  setValue('protein_g', est.protein_g, opts)
                  setValue('carbs_g', est.carbs_g, opts)
                  setValue('fat_g', est.fat_g, opts)
                  setEnergy(inputs)
                }}
              />
              {!profile.goal && <p className="mt-2 text-sm text-ink-soft">Set a goal under Profile above to use the calculator.</p>}
            </div>
          )}
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextInput label="Effective from" type="date" className="num" error={formState.errors.effective_date?.message} {...register('effective_date')} />
              <NumberInput label="Calories" unit="kcal" error={formState.errors.calories?.message} {...register('calories')} />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <NumberInput label="Protein" unit="g" error={formState.errors.protein_g?.message} {...register('protein_g')} />
              <NumberInput label="Carbohydrates" unit="g" error={formState.errors.carbs_g?.message} {...register('carbs_g')} />
              <NumberInput label="Fat" unit="g" error={formState.errors.fat_g?.message} {...register('fat_g')} />
            </div>
            <p className={cn('text-sm', macrosMismatch(cal, p, c, f) ? 'text-danger' : 'text-ink-soft')} aria-live="polite">
              Macros add up to <span className="num font-semibold">{kcal(caloriesFromMacros(p, c, f))}</span> kcal.
              {macrosMismatch(cal, p, c, f) && ' That differs from the calorie target by more than 5%.'}
            </p>
            <Button type="submit" loading={formState.isSubmitting}>Save targets</Button>
          </form>

          {goals.data.length > 0 && (
            <div className="mt-10">
              <h3 className="label-caps mb-3">Target history</h3>
              <div className={t.wrapper}>
                <table className={t.table}>
                  <caption className="sr-only">Nutrition target history</caption>
                  <thead><tr>
                    <th scope="col" className={t.th}>From</th>
                    <th scope="col" className={t.thNum}>Calories</th>
                    <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Protein</th>
                    <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Carbs</th>
                    <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Fat</th>
                    <th scope="col" className={cn(t.th, 'w-0')}><span className="sr-only">Actions</span></th>
                  </tr></thead>
                  <tbody>
                    {goals.data.map((g) => (
                      <tr key={g.id} className={t.row}>
                        <td className={cn(t.td, 'num')}>
                          {formatDateMedium(g.effective_date)}
                          {g.id === current?.id && <span className="ml-2 text-xs font-semibold text-teal">Current</span>}
                        </td>
                        <td className={t.tdNum}>{kcal(g.calories)} kcal</td>
                        <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{gramsWhole(g.protein_g)} g</td>
                        <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{gramsWhole(g.carbs_g)} g</td>
                        <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{gramsWhole(g.fat_g)} g</td>
                        <td className={t.td}>
                          <IconButton size="sm" tone="danger" label={`Delete targets from ${formatDateMedium(g.effective_date)}`} disabled={goals.data.length === 1}
                            icon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={() => setDeleting(g)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <ConfirmDialog
            open={deleting !== null}
            title="Delete these targets?"
            description="Days from this date will use the previous targets instead."
            confirmLabel="Delete targets"
            loading={remove.isPending}
            onCancel={() => setDeleting(null)}
            onConfirm={() => deleting && remove.mutate(deleting.id, { onError: (e) => toast.error(e), onSettled: () => setDeleting(null) })}
          />
        </>
      )}
    </section>
  )
}

function AccountSection() {
  const { user } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (password.length < 8) return setError('Use at least 8 characters')
    setSaving(true)
    try {
      await updatePassword(password)
      setPassword('')
      toast.success('Password changed.')
    } catch (e) {
      toast.error(e, 'Could not change the password.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section aria-labelledby="account-heading">
      <SectionHeading id="account-heading" title="Account" />
      <dl className="mb-8">
        <dt className="label-caps">Email</dt>
        <dd className="mt-1">{user?.email}</dd>
      </dl>
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-wrap items-start gap-4">
        <TextInput label="New password" type="password" autoComplete="new-password" containerClassName="w-full sm:w-72" value={password} error={error}
          onChange={(e) => { setPassword(e.target.value); setError(undefined) }} />
        <Button type="submit" variant="secondary" className="sm:mt-7" loading={saving}>Change password</Button>
      </form>
      <div className="mt-10 border-t border-line pt-6">
        <Button variant="secondary" onClick={() => signOut().catch((e) => toast.error(e))}>Sign out</Button>
      </div>
    </section>
  )
}
