import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/ui/Headings'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useLoadedProfile, useToday } from '@/features/auth/hooks'
import { formatDateMedium } from '@/lib/dates'
import { PERIODS, periodFor, type PeriodKey } from './period'
import { NutritionSection } from './sections/NutritionSection'
import { ExerciseSection } from './sections/ExerciseSection'
import { TrainingSection } from './sections/TrainingSection'
import { WeightSection } from './sections/WeightSection'

export default function ProgressPage() {
  const profile = useLoadedProfile()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const key = (PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : '12w') as PeriodKey
  const period = periodFor(key, today)

  return (
    <>
      <PageHeader
        title="Progress"
        description="Body weight, workouts, exercises and nutrition over time. Each chart has a data table underneath."
      />
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <SegmentedControl<PeriodKey>
          label="Time period"
          value={key}
          onChange={(v) => setParams(v === '12w' ? {} : { period: v }, { replace: true })}
          options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
        <p className="num text-sm text-ink-soft">{formatDateMedium(period.from)} to {formatDateMedium(period.to)}</p>
      </div>
      <div className="space-y-16">
        <WeightSection period={period} unit={profile.weight_unit} today={today} />
        <TrainingSection period={period} unit={profile.weight_unit} />
        <ExerciseSection period={period} unit={profile.weight_unit} />
        <NutritionSection period={period} />
      </div>
    </>
  )
}
