import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NumberInput, SelectInput } from '@/components/ui/Field'
import {
  ACTIVITY_LEVELS, MAX_AGE, MIN_AGE, ageFromBirthYear, birthYearFromAge, cmFromFeetInches, estimateTargets,
  feetInchesFromCm, type TargetEstimate,
} from '@/lib/energy'
import { kcal } from '@/lib/format'
import { formatSigned, fromKg, round, toKg } from '@/lib/units'
import type { ActivityLevel, Goal, Profile, Sex, WeightUnit } from '@/types/database'

export type EnergyProfile = Pick<Profile, 'sex' | 'birth_year' | 'height_cm' | 'activity_level'>

const GOAL_LABELS: Record<Goal, string> = { lose: 'Lose fat', maintain: 'Maintain', gain: 'Build muscle' }

interface Props {
  unit: WeightUnit
  goal: Goal | null | undefined
  today: string
  initial: Partial<EnergyProfile>
  /** Body weight from another field on the page. Leave undefined and set `askWeight` to ask here. */
  weightKg?: number
  /** Where to enter weight when `weightKg` is missing and the calculator does not ask for it. */
  weightHint?: string
  askWeight?: boolean
  initialWeightKg?: number
  onApply: (estimate: TargetEstimate, inputs: EnergyProfile) => void
}

type Errors = Partial<Record<'sex' | 'age' | 'height' | 'weight' | 'activity' | 'goal', string>>

const str = (n: number | null | undefined) => (n == null ? '' : String(n))

/** Fills calorie and macro targets from Mifflin-St Jeor and an activity factor. All math is in src/lib/energy.ts. */
export function TargetCalculator({ unit, goal, today, initial, weightKg, weightHint, askWeight = false, initialWeightKg, onApply }: Props) {
  const ft = initial.height_cm == null ? null : feetInchesFromCm(initial.height_cm)
  const [sex, setSex] = useState<Sex | ''>(initial.sex ?? '')
  const [age, setAge] = useState(str(initial.birth_year == null ? null : ageFromBirthYear(initial.birth_year, today)))
  const [heightCm, setHeightCm] = useState(str(initial.height_cm))
  const [feet, setFeet] = useState(str(ft?.feet))
  const [inches, setInches] = useState(str(ft?.inches))
  const [activity, setActivity] = useState<ActivityLevel | ''>(initial.activity_level ?? '')
  const [ownWeight, setOwnWeight] = useState(str(initialWeightKg == null ? null : round(fromKg(initialWeightKg, unit), 1)))
  const [errors, setErrors] = useState<Errors>({})
  const [result, setResult] = useState<TargetEstimate | null>(null)

  const calculate = () => {
    const e: Errors = {}
    const ageN = Number(age)
    if (!sex) e.sex = 'Choose one'
    if (!age || !Number.isInteger(ageN) || ageN < MIN_AGE || ageN > MAX_AGE) e.age = `Enter a whole number from ${MIN_AGE} to ${MAX_AGE}`
    const cm = unit === 'kg' ? Number(heightCm) : cmFromFeetInches(Number(feet), Number(inches || 0))
    const heightMissing = unit === 'kg' ? !heightCm : !feet
    if (heightMissing || !Number.isFinite(cm) || cm < 100 || cm > 250) e.height = unit === 'kg' ? 'Enter a height from 100 to 250 cm' : 'Enter a height from 3 ft 4 in to 8 ft 2 in'
    if (unit === 'lb' && inches && (Number(inches) < 0 || Number(inches) >= 12)) e.height = 'Inches must be from 0 to 11'
    const kg = askWeight ? (ownWeight ? toKg(Number(ownWeight), unit) : NaN) : weightKg
    if (kg == null || !Number.isFinite(kg) || kg < 20 || kg > 400) {
      e.weight = askWeight ? 'Enter a realistic body weight' : (weightHint ?? 'Enter your body weight first')
    }
    if (!activity) e.activity = 'Choose an activity level'
    if (!goal) e.goal = 'Choose a goal first'
    setErrors(e)
    if (Object.keys(e).length > 0 || !sex || !activity || !goal || kg == null) return

    const height = Math.round(cm * 10) / 10
    const estimate = estimateTargets({ sex, age: ageN, heightCm: height, weightKg: kg, activity, goal })
    setResult(estimate)
    onApply(estimate, { sex, birth_year: birthYearFromAge(ageN, today), height_cm: height, activity_level: activity })
  }

  const clear = (key: keyof Errors) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  return (
    <div className="border-b border-line pb-8">
      <h3 className="text-sm font-semibold">Calculate from your body</h3>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">
        Estimates your maintenance calories (TDEE) and fills in the targets below. You can still edit every number.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <SelectInput label="Sex" hint="The formula has separate equations for male and female bodies." error={errors.sex}
          value={sex} onChange={(ev) => { setSex(ev.target.value as Sex | ''); clear('sex') }}>
          <option value="">Choose</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </SelectInput>
        <NumberInput label="Age" unit="years" inputMode="numeric" error={errors.age} value={age}
          onChange={(ev) => { setAge(ev.target.value); clear('age') }} />
        {unit === 'kg' ? (
          <NumberInput label="Height" unit="cm" error={errors.height} value={heightCm}
            onChange={(ev) => { setHeightCm(ev.target.value); clear('height') }} />
        ) : (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Height</legend>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Feet" hideLabel unit="ft" inputMode="numeric" value={feet}
                onChange={(ev) => { setFeet(ev.target.value); clear('height') }} />
              <NumberInput label="Inches" hideLabel unit="in" value={inches}
                onChange={(ev) => { setInches(ev.target.value); clear('height') }} />
            </div>
            {errors.height && <p className="mt-1.5 text-sm text-danger">{errors.height}</p>}
          </fieldset>
        )}
        {askWeight && (
          <NumberInput label="Body weight" unit={unit} hint={initialWeightKg != null ? 'From your latest weigh-in.' : undefined}
            error={errors.weight} value={ownWeight} onChange={(ev) => { setOwnWeight(ev.target.value); clear('weight') }} />
        )}
        <SelectInput label="Activity level" containerClassName="sm:col-span-2" error={errors.activity}
          hint="Count training and daily movement. Most people overestimate this. If unsure, pick the lower level."
          value={activity} onChange={(ev) => { setActivity(ev.target.value as ActivityLevel | ''); clear('activity') }}>
          <option value="">Choose</option>
          {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}: {a.description.toLowerCase()}</option>)}
        </SelectInput>
      </div>

      {(errors.weight || errors.goal) && !askWeight && (
        <p role="alert" className="mt-4 text-sm text-danger">{[errors.goal, errors.weight].filter(Boolean).join('. ')}.</p>
      )}
      {errors.goal && askWeight && <p role="alert" className="mt-4 text-sm text-danger">{errors.goal}.</p>}

      <Button variant="secondary" className="mt-5" icon={<Calculator className="size-4" strokeWidth={1.75} />} onClick={calculate}>
        Calculate targets
      </Button>

      {result && (
        <div aria-live="polite" className="mt-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div>
              <dt className="label-caps">Resting (BMR)</dt>
              <dd className="mt-1 text-lg font-semibold num">{kcal(result.bmr)} <span className="text-sm font-normal text-ink-soft">kcal</span></dd>
            </div>
            <div>
              <dt className="label-caps">Maintenance (TDEE)</dt>
              <dd className="mt-1 text-lg font-semibold num">{kcal(result.tdee)} <span className="text-sm font-normal text-ink-soft">kcal</span></dd>
            </div>
            <div>
              <dt className="label-caps">{goal ? GOAL_LABELS[goal] : 'Goal'}</dt>
              <dd className="mt-1 text-lg font-semibold num">{formatSigned(Math.round(result.adjustment * 100), 0)}%</dd>
            </div>
            <div>
              <dt className="label-caps">Daily target</dt>
              <dd className="mt-1 text-lg font-semibold num text-teal">{kcal(result.calories)} <span className="text-sm font-normal text-ink-soft">kcal</span></dd>
            </div>
          </dl>
          <p className="mt-4 max-w-prose text-sm text-ink-soft">
            Protein {result.proteinPerKg} g per kg of body weight, fat 25% of calories, carbohydrates the rest.
            {result.flooredAtBmr && ' The deficit was reduced so the target does not go below your resting energy.'}
            {' '}This is an estimate. Check your weight trend after 2 to 3 weeks and adjust.
          </p>
        </div>
      )}
    </div>
  )
}
