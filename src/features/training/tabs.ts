import { trainingVolume } from '@/lib/training'
import type { SessionSummary } from './api'

export const TRAINING_TABS = [
  { to: '/training', label: 'Workouts', end: true },
  { to: '/training/templates', label: 'Templates' },
]

/** Counts for a workout list row: exercises, completed sets and volume load in kg. */
export function summarize(s: SessionSummary) {
  const sets = s.workout_exercises.flatMap((we) => we.workout_sets)
  return {
    exercises: s.workout_exercises.length,
    sets: sets.filter((x) => x.completed_at).length,
    volumeKg: trainingVolume(sets),
  }
}
