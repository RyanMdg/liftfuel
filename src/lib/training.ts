import type { CompletedSet, ExerciseCategory, SetType } from '@/types/database'
import { round } from './units'
import { startOfWeek } from './dates'

/** Repetition range for which an estimated 1RM is reported. */
export const E1RM_MIN_REPS = 1
export const E1RM_MAX_REPS = 10

export interface SetLike {
  set_type: SetType
  load_kg: number | null
  reps: number | null
  completed_at?: string | null
}

/**
 * Epley estimated one-rep max: load x (1 + reps / 30).
 * Returns null outside the eligible range (1-10 reps, load > 0).
 * A single (1 rep) returns the load itself: it is an actual 1RM performance.
 */
export function epley(loadKg: number | null, reps: number | null): number | null {
  if (loadKg == null || reps == null || !(loadKg > 0)) return null
  if (!Number.isInteger(reps) || reps < E1RM_MIN_REPS || reps > E1RM_MAX_REPS) return null
  if (reps === 1) return loadKg
  return round(loadKg * (1 + reps / 30), 2)
}

export function isCompleted(set: SetLike): boolean {
  return set.completed_at != null && set.reps != null
}

/** Completed sets that count for analytics: working and drop sets, never warm-ups. */
export function countedSets<T extends SetLike>(sets: ReadonlyArray<T>): T[] {
  return sets.filter((s) => isCompleted(s) && s.set_type !== 'warmup')
}

export function e1rmForSet(set: SetLike): number | null {
  if (!isCompleted(set) || set.set_type !== 'working') return null
  return epley(set.load_kg, set.reps)
}

/** Volume load: sum of load x reps over completed non-warm-up sets. */
export function trainingVolume(sets: ReadonlyArray<SetLike>): number {
  return round(countedSets(sets).reduce((sum, s) => sum + (s.load_kg ?? 0) * (s.reps ?? 0), 0), 1)
}

export interface PersonalRecord {
  exerciseId: string
  exerciseName: string
  bestE1rm: { value: number; loadKg: number; reps: number; date: string } | null
  heaviest: { loadKg: number; reps: number; date: string } | null
}

/**
 * Personal records per exercise from completed sets (warm-ups excluded).
 * Ties keep the earliest occurrence: a record is set the first time it is achieved.
 */
export function personalRecords(sets: ReadonlyArray<CompletedSet>): Map<string, PersonalRecord> {
  const sorted = [...sets].sort((a, b) => a.completed_at.localeCompare(b.completed_at))
  const records = new Map<string, PersonalRecord>()
  for (const s of sorted) {
    if (s.set_type === 'warmup' || s.load_kg == null || s.load_kg <= 0 || s.reps < 1) continue
    let pr = records.get(s.exercise_id)
    if (!pr) {
      pr = { exerciseId: s.exercise_id, exerciseName: s.exercise_name, bestE1rm: null, heaviest: null }
      records.set(s.exercise_id, pr)
    }
    if (!pr.heaviest || s.load_kg > pr.heaviest.loadKg) {
      pr.heaviest = { loadKg: s.load_kg, reps: s.reps, date: s.session_date }
    }
    const e = e1rmForSet(s)
    if (e != null && (!pr.bestE1rm || e > pr.bestE1rm.value)) {
      pr.bestE1rm = { value: e, loadKg: s.load_kg, reps: s.reps, date: s.session_date }
    }
  }
  return records
}

export interface RecordEvent {
  kind: 'e1rm' | 'heaviest'
  exerciseId: string
  exerciseName: string
  value: number
  loadKg: number
  reps: number
  date: string
  previous: number | null
}

/**
 * Records that were broken on or after `sinceDate`, compared with everything before them.
 * The first ever performance of an exercise is not reported as a record (no baseline).
 */
export function recentRecords(sets: ReadonlyArray<CompletedSet>, sinceDate: string): RecordEvent[] {
  const sorted = [...sets].sort((a, b) => a.completed_at.localeCompare(b.completed_at))
  const bestE = new Map<string, number>()
  const bestLoad = new Map<string, number>()
  const events: RecordEvent[] = []
  for (const s of sorted) {
    if (s.set_type === 'warmup' || s.load_kg == null || s.load_kg <= 0 || s.reps < 1) continue
    const e = e1rmForSet(s)
    const prevE = bestE.get(s.exercise_id)
    const prevLoad = bestLoad.get(s.exercise_id)
    if (s.session_date >= sinceDate) {
      if (e != null && prevE != null && e > prevE) {
        events.push({ kind: 'e1rm', exerciseId: s.exercise_id, exerciseName: s.exercise_name, value: e, loadKg: s.load_kg, reps: s.reps, date: s.session_date, previous: prevE })
      }
      if (prevLoad != null && s.load_kg > prevLoad) {
        events.push({ kind: 'heaviest', exerciseId: s.exercise_id, exerciseName: s.exercise_name, value: s.load_kg, loadKg: s.load_kg, reps: s.reps, date: s.session_date, previous: prevLoad })
      }
    }
    if (e != null && (prevE == null || e > prevE)) bestE.set(s.exercise_id, e)
    if (prevLoad == null || s.load_kg > prevLoad) bestLoad.set(s.exercise_id, s.load_kg)
  }
  return events
}

export interface E1rmPoint {
  date: string
  e1rm: number
}

/** Best e1RM per session date for the matching sets. */
export function e1rmSeries(sets: ReadonlyArray<CompletedSet>, match: (s: CompletedSet) => boolean): E1rmPoint[] {
  const byDate = new Map<string, number>()
  for (const s of sets) {
    if (!match(s)) continue
    const e = e1rmForSet(s)
    if (e == null) continue
    byDate.set(s.session_date, Math.max(byDate.get(s.session_date) ?? 0, e))
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, e1rm]) => ({ date, e1rm }))
}

export interface WeeklyPoint {
  week: string
  volume: number
  sessions: number
}

/**
 * Volume and distinct completed sessions per ISO week (Monday start), including
 * empty weeks between the first and last week so gaps are visible, not hidden.
 */
export function weeklyTraining(sets: ReadonlyArray<CompletedSet>, fromDate: string, toDate: string): WeeklyPoint[] {
  const weeks = new Map<string, { volume: number; sessions: Set<string> }>()
  for (let w = startOfWeek(fromDate); w <= toDate; w = addWeek(w)) {
    weeks.set(w, { volume: 0, sessions: new Set() })
  }
  for (const s of sets) {
    if (s.session_date < fromDate || s.session_date > toDate) continue
    const bucket = weeks.get(startOfWeek(s.session_date))
    if (!bucket) continue
    bucket.sessions.add(s.session_id)
    if (s.set_type !== 'warmup') bucket.volume += (s.load_kg ?? 0) * s.reps
  }
  return [...weeks.entries()].map(([week, b]) => ({ week, volume: round(b.volume, 1), sessions: b.sessions.size }))
}

function addWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString().slice(0, 10)
}

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Warm-up',
  working: 'Working',
  drop: 'Drop',
}

export type ExerciseMetric = 'e1rm' | 'heaviest' | 'session_volume' | 'session_reps'

export const EXERCISE_METRICS: ReadonlyArray<{ value: ExerciseMetric; label: string; question: string; unit: 'load' | 'reps' }> = [
  { value: 'e1rm', label: 'Estimated 1RM', question: 'Is my estimated max going up?', unit: 'load' },
  { value: 'heaviest', label: 'Heaviest weight', question: 'Am I lifting heavier?', unit: 'load' },
  { value: 'session_volume', label: 'Session volume', question: 'Am I doing more work?', unit: 'load' },
  { value: 'session_reps', label: 'Total reps', question: 'Am I doing more reps?', unit: 'reps' },
]

export interface SeriesPoint {
  date: string
  value: number
}

/**
 * One value per session date for an exercise, like Hevy's exercise graphs.
 * e1rm: best eligible estimate. heaviest: heaviest completed non-warm-up set.
 * session_volume: sum of load x reps over counted sets. session_reps: sum of reps over counted sets.
 * Dates without a qualifying set are omitted (never zero-filled).
 */
export function exerciseSeries(sets: ReadonlyArray<CompletedSet>, exerciseId: string, metric: ExerciseMetric): SeriesPoint[] {
  const byDate = new Map<string, number>()
  for (const s of sets) {
    if (s.exercise_id !== exerciseId || s.set_type === 'warmup' || s.reps < 1) continue
    const prev = byDate.get(s.session_date)
    let v: number | null = null
    if (metric === 'e1rm') {
      const e = e1rmForSet(s)
      if (e != null) v = Math.max(prev ?? 0, e)
    } else if (metric === 'heaviest') {
      if (s.load_kg != null && s.load_kg > 0) v = Math.max(prev ?? 0, s.load_kg)
    } else if (metric === 'session_volume') {
      if (s.load_kg != null && s.load_kg > 0) v = (prev ?? 0) + s.load_kg * s.reps
    } else {
      v = (prev ?? 0) + s.reps
    }
    if (v != null) byDate.set(s.session_date, round(v, 2))
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
}

/** Completed working and drop sets per body area within a date range (Hevy's muscle distribution). */
export function setsByCategory(sets: ReadonlyArray<CompletedSet>, from: string, to: string): Array<{ category: ExerciseCategory; sets: number }> {
  const counts = new Map<ExerciseCategory, number>()
  for (const s of sets) {
    if (s.session_date < from || s.session_date > to || s.set_type === 'warmup') continue
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1)
  }
  return [...counts.entries()].map(([category, n]) => ({ category, sets: n })).sort((a, b) => b.sets - a.sets)
}
